import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  splitChunksForBrowserSpeech,
  ttsChunksFromHtml,
  ttsSegmentHash,
  TTS_MODEL,
  TTS_VOICE,
  type TtsChunk,
} from "@/lib/tts";
import { AI_GENERATED_HEADER, withAiAudioTag } from "@/lib/ai-marking";
import { recordAiUsage } from "@/lib/ai-usage-server";
import { publicUploadsDir } from "@/lib/storage";

/** Kostenbremse: mehr Segmente liest sinnvollerweise niemand am Stück */
const MAX_SEGMENTS = 150;

/**
 * Vorlesen einer Lektion. Liefert je nach Plan des Kurs-Creators:
 * - "openai": gecachte Audio-URLs je Text-Segment (bezahltes Creator-Abo;
 *   fehlende Segmente werden einmalig generiert und gespeichert)
 * - "browser": den Klartext für die Web Speech API (kostenloser Account
 *   oder OpenAI nicht verfügbar) – der Client wechselt automatisch.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    lessonId?: string;
    lang?: string;
    /** gesetzt: nur dieses eine Segment erzeugen (siehe unten) */
    index?: number;
  } | null;
  if (!body?.lessonId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const lang = typeof body.lang === "string" ? body.lang : "de";

  const lesson = await db.lesson.findUnique({
    where: { id: body.lessonId },
    include: {
      blocks: { orderBy: { order: "asc" } },
      section: {
        select: {
          course: {
            select: { id: true, creatorId: true },
          },
        },
      },
    },
  });
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Zugriff wie beim Lernfortschritt: eingeschrieben oder eigener Kurs
  const course = lesson.section.course;
  if (course.creatorId !== session.user.id) {
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: course.id,
        },
      },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "not_enrolled" }, { status: 403 });
    }
  }

  // Textblöcke in der gewünschten Kurssprache (Fallback: Basissprache),
  // strukturiert in Überschriften/Absätze für natürliche Sprechpausen
  const chunks: TtsChunk[] = lesson.blocks
    .filter((block) => block.type === "TEXT")
    .flatMap((block) => {
      const translated = (
        block.translations as Record<string, { content?: string }> | null
      )?.[lang]?.content;
      return ttsChunksFromHtml(translated ?? block.content ?? "");
    });

  if (chunks.length === 0) {
    return NextResponse.json({ error: "no_text" }, { status: 422 });
  }

  // Vorlesen ist ein Werkzeug der Lernenden, nicht des Creators – deshalb
  // steht die Sprachausgabe allen Eingeschriebenen offen, sobald ein
  // OpenAI-Schlüssel konfiguriert ist. Ohne Schlüssel und bei absurd langen
  // Lektionen übernimmt die kostenlose Browser-Stimme.
  if (!process.env.OPENAI_API_KEY || chunks.length > MAX_SEGMENTS) {
    // Kleinteiliger für die Browser-Stimme: Chrome bricht Äußerungen über
    // ~15 Sekunden stumm ab, ohne das Ende-Ereignis zu senden
    return NextResponse.json({
      mode: "browser",
      segments: splitChunksForBrowserSpeech(chunks),
    });
  }

  const hashes = chunks.map((chunk) => ttsSegmentHash(chunk.text));

  /* Einzelnes Segment erzeugen. Der Client fragt es an, kurz bevor es
     gespielt wird – so entstehen nur Kosten für das, was tatsächlich
     gehört wird. Der Text kommt dabei nie vom Client, sondern aus der
     Lektion; der Index wählt lediglich aus. */
  if (typeof body.index === "number") {
    const i = body.index;
    if (!Number.isInteger(i) || i < 0 || i >= chunks.length) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const url = await ensureSegment(chunks[i].text, hashes[i], {
      userId: session.user.id,
      courseId: course.id,
    });
    if (!url) {
      // sanfter Rückfall: lieber Browser-Stimme als gar kein Vorlesen
      return NextResponse.json({ error: "tts_failed" }, { status: 503 });
    }
    return NextResponse.json(
      { url },
      { headers: { [AI_GENERATED_HEADER]: "true" } }
    );
  }

  /* Übersicht: Was liegt schon vor? Hier wird bewusst NICHTS erzeugt.
     Früher wurde beim Druck auf "Vorlesen" die ganze Lektion generiert –
     wer nach zehn Sekunden abbrach, hatte trotzdem alles bezahlt. */
  const cached = await db.ttsSegment.findMany({
    where: { hash: { in: hashes } },
    select: { hash: true, url: true },
  });
  const urlByHash = new Map(cached.map((row) => [row.hash, row.url]));

  return NextResponse.json(
    {
      mode: "openai",
      segments: chunks.map((chunk, i) => ({
        ...chunk,
        url: urlByHash.get(hashes[i]) ?? null,
      })),
    },
    // Antwort liefert Links auf KI-generierte Audios
    { headers: { [AI_GENERATED_HEADER]: "true" } }
  );
}

/**
 * Audio eines Segments liefern – aus dem Cache oder einmalig erzeugt.
 * Der Cache ist global über den Texthash: Dasselbe Segment wird für alle
 * Lernenden und alle Kurse nur ein einziges Mal bezahlt.
 */
async function ensureSegment(
  text: string,
  hash: string,
  who: { userId: string; courseId: string }
): Promise<string | null> {
  const existing = await db.ttsSegment.findUnique({
    where: { hash },
    select: { url: true },
  });
  if (existing) return existing.url;

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: text,
        response_format: "mp3",
      }),
    });
    if (!response.ok) {
      throw new Error(`openai_tts_${response.status}`);
    }
    // KI-Kennzeichnung (Art. 50 Abs. 2 KI-VO): ID3-Tag mit
    // DigitalSourceType=trainedAlgorithmicMedia in die Datei einbetten
    const buffer = Buffer.from(
      withAiAudioTag(new Uint8Array(await response.arrayBuffer()))
    );

    const directory = path.join(publicUploadsDir(), "tts");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `${hash}.mp3`), buffer);

    const url = `/uploads/tts/${hash}.mp3`;
    // upsert: parallele Anfragen desselben Segments dürfen nicht kollidieren
    await db.ttsSegment.upsert({
      where: { hash },
      create: { hash, url },
      update: {},
    });

    // Verbrauchsprotokoll: der Speech-Endpoint meldet keine Usage –
    // Tokens ≈ Zeichen/4, Sprechdauer ≈ Zeichen/15 (Schätzwerte)
    void recordAiUsage({
      activity: "TTS",
      model: TTS_MODEL,
      inputTokens: Math.ceil(text.length / 4),
      audioSeconds: text.length / 15,
      userChars: text.length,
      userId: who.userId,
      courseId: who.courseId,
    });
    return url;
  } catch (error) {
    console.error("[tts] Generierung fehlgeschlagen:", error);
    return null;
  }
}
