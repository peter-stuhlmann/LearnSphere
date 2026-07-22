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
  const cached = await db.ttsSegment.findMany({
    where: { hash: { in: hashes } },
    select: { hash: true, url: true },
  });
  const urlByHash = new Map(cached.map((row) => [row.hash, row.url]));

  // Fehlende Segmente einmalig generieren – nur die geänderten/neuen
  for (let i = 0; i < chunks.length; i++) {
    const hash = hashes[i];
    if (urlByHash.has(hash)) continue;
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
          input: chunks[i].text,
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
      urlByHash.set(hash, url);

      // Verbrauchsprotokoll: der Speech-Endpoint meldet keine Usage –
      // Tokens ≈ Zeichen/4, Sprechdauer ≈ Zeichen/15 (Schätzwerte)
      const chars = chunks[i].text.length;
      void recordAiUsage({
        activity: "TTS",
        model: TTS_MODEL,
        inputTokens: Math.ceil(chars / 4),
        audioSeconds: chars / 15,
        userChars: chars,
        userId: session.user.id,
        courseId: course.id,
      });
    } catch (error) {
      console.error("[tts] Generierung fehlgeschlagen:", error);
      // sanfter Rückfall: lieber Browser-Stimme als gar kein Vorlesen
      return NextResponse.json({ mode: "browser", segments: chunks });
    }
  }

  return NextResponse.json(
    {
      mode: "openai",
      segments: chunks.map((chunk, i) => ({
        ...chunk,
        url: urlByHash.get(hashes[i]),
      })),
    },
    // Antwort liefert Links auf KI-generierte Audios
    { headers: { [AI_GENERATED_HEADER]: "true" } }
  );
}
