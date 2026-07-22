import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ensureCourseIndex,
  embedQuery,
  loadCourseChunks,
} from "@/lib/assistant/indexer";
import { rankChunks, queryTerms } from "@/lib/assistant/retrieval";
import { buildCourseMap } from "@/lib/assistant/summaries";
import { ASSISTANT_MODEL, buildSystemPrompt } from "@/lib/assistant/prompt";
import { AI_GENERATED_HEADER } from "@/lib/ai-marking";
import { recordAiUsage } from "@/lib/ai-usage-server";

/**
 * Lernassistent: kennt genau einen Kurs (courseId wird serverseitig aus der
 * Lektion abgeleitet – nie vom Client), kennt keine Prüfungsinhalte und ist
 * während einer laufenden Prüfung gesperrt. Antworten streamen als SSE.
 */

const MAX_MESSAGE_CHARS = 2000;
/** Zeichenbudget der Auszüge je Frage – siehe retrieval.ts */
const RETRIEVAL_CHAR_BUDGET = 25_000;
const HISTORY_TURNS = 12;

interface AccessResult {
  ok: true;
  userId: string;
  course: { id: string; title: string };
  lesson: { id: string; title: string };
}

async function checkAccess(
  lessonId: string
): Promise<AccessResult | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      section: {
        select: {
          course: { select: { id: true, title: true, creatorId: true } },
        },
      },
    },
  });
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const course = lesson.section.course;

  if (course.creatorId !== session.user.id) {
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session.user.id, courseId: course.id },
      },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "not_enrolled" }, { status: 403 });
    }

    // Prüfungsmodus: läuft für diese Einschreibung eine Prüfung mit
    // Zeitlimit, ist der Assistent gesperrt
    const timer = await db.quizTimer.findFirst({
      where: { enrollmentId: enrollment.id },
      include: { quiz: { select: { timeLimitMinutes: true } } },
    });
    if (timer?.quiz.timeLimitMinutes) {
      const endsAt =
        timer.startedAt.getTime() + timer.quiz.timeLimitMinutes * 60_000;
      if (Date.now() < endsAt) {
        return NextResponse.json({ error: "exam_active" }, { status: 403 });
      }
    }
  }

  return {
    ok: true,
    userId: session.user.id,
    course: { id: course.id, title: course.title },
    lesson: { id: lesson.id, title: lesson.title },
  };
}

/** Verlauf laden (neueste zuerst, Cursor für Lazy-Load älterer Einträge). */
export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get("lessonId");
  if (!lessonId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const access = await checkAccess(lessonId);
  if (access instanceof NextResponse) return access;

  const before = request.nextUrl.searchParams.get("before");
  const messages = await db.assistantMessage.findMany({
    where: {
      userId: access.userId,
      courseId: access.course.id,
      archivedAt: null,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      role: true,
      content: true,
      sources: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    messages: messages.reverse(),
    hasMore: messages.length === 30,
  });
}

/** Neues Gespräch: bisherigen Verlauf archivieren (nicht löschen). */
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    lessonId?: string;
  } | null;
  if (!body?.lessonId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const access = await checkAccess(body.lessonId);
  if (access instanceof NextResponse) return access;

  await db.assistantMessage.updateMany({
    where: {
      userId: access.userId,
      courseId: access.course.id,
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    lessonId?: string;
    lang?: string;
    message?: string;
  } | null;
  const message = body?.message?.trim();
  if (!body?.lessonId || !message || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "de";

  const access = await checkAccess(body.lessonId);
  if (access instanceof NextResponse) return access;

  // Spam-Bremse: großzügig für echte Gespräche, blockt Nachrichten-Salven
  if (
    !(await checkRateLimit(`assistant-burst:${access.userId}`, {
      limit: 6,
      windowMs: 30_000,
    })) ||
    !(await checkRateLimit(`assistant-hour:${access.userId}`, {
      limit: 60,
      windowMs: 60 * 60_000,
    }))
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // Memory aktuell halten (inkrementell, meist ein No-Op)
  await ensureCourseIndex(access.course.id);

  /* Retrieval – hart auf DIESEN Kurs begrenzt. Die Chunks kommen aus dem
     Prozess-Cache, die Landkarte (Zusammenfassung jeder Lektion) immer
     vollständig aus der Datenbank: Sie ist klein und muss jede Frage
     begleiten, damit der Assistent den ganzen Kurs überblickt. */
  const [queryEmbedding, candidates, summaryRows, history] = await Promise.all([
    embedQuery(message),
    loadCourseChunks(access.course.id, lang),
    db.knowledgeSummary.findMany({
      where: { courseId: access.course.id, lang },
      orderBy: { order: "asc" },
      select: { sectionTitle: true, lessonTitle: true, order: true, text: true },
    }),
    db.assistantMessage.findMany({
      where: {
        userId: access.userId,
        courseId: access.course.id,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
      select: { role: true, content: true },
    }),
  ]);

  const ranked = rankChunks(queryEmbedding, candidates, {
    charBudget: RETRIEVAL_CHAR_BUDGET,
    currentLessonId: access.lesson.id,
    terms: queryTerms(message),
  });
  // Die aktuelle Lektion immer beilegen ("fasse zusammen", "erklär nochmal")
  const currentLesson = candidates
    .filter((chunk) => chunk.lessonId === access.lesson.id)
    .slice(0, 6);
  const contextChunks = [
    ...new Map(
      [...ranked, ...currentLesson].map((chunk) => [chunk.text, chunk])
    ).values(),
  ];
  const courseMap = buildCourseMap(summaryRows);

  const sources = [
    ...new Map(
      contextChunks
        .filter((chunk) => chunk.lessonId)
        .map((chunk) => [
          chunk.lessonId,
          {
            lessonId: chunk.lessonId,
            sectionTitle: chunk.sectionTitle,
            lessonTitle: chunk.lessonTitle,
          },
        ])
    ).values(),
  ].slice(0, 4);

  const systemPrompt = buildSystemPrompt({
    courseTitle: access.course.title,
    lang,
    currentLessonTitle: access.lesson.title,
    courseMap,
    chunks: contextChunks,
  });

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      stream: true,
      // liefert im letzten Stream-Chunk die Token-Zahlen (Verbrauchsprotokoll)
      stream_options: { include_usage: true },
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.reverse().map((entry) => ({
          role: entry.role === "USER" ? "user" : "assistant",
          content: entry.content,
        })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const { userId } = access;
  const courseId = access.course.id;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      let full = "";
      let buffer = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number } | null =
        null;
      const reader = upstream.body!.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const data = line.replace(/^data: ?/, "").trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                choices?: { delta?: { content?: string } }[];
                usage?: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                } | null;
              };
              if (parsed.usage) usage = parsed.usage;
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                send({ type: "delta", text: delta });
              }
            } catch {
              // unvollständige SSE-Zeile – kommt mit dem nächsten Chunk
            }
          }
        }

        // Verbrauchsprotokoll: System = Prompt + Kurskontext, User = Frage/Verlauf
        void recordAiUsage({
          activity: "ASSISTANT",
          model: ASSISTANT_MODEL,
          inputTokens: usage?.prompt_tokens,
          outputTokens: usage?.completion_tokens,
          systemChars: systemPrompt.length,
          userChars:
            message.length +
            history.reduce((sum, entry) => sum + entry.content.length, 0),
          userId,
          courseId,
        });

        // Verlauf persistieren (Frage + Antwort mit Fundstellen)
        if (full) {
          await db.assistantMessage.createMany({
            data: [
              { userId, courseId, role: "USER", content: message },
              {
                userId,
                courseId,
                role: "ASSISTANT",
                content: full,
                sources,
              },
            ],
          });
        }
        send({ type: "done", sources });
      } catch (error) {
        console.error("[assistant] Stream-Fehler:", error);
        send({ type: "error" });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // Stream liefert KI-generierte Antworten (Art. 50 Abs. 2 KI-VO)
      [AI_GENERATED_HEADER]: "true",
    },
  });
}
