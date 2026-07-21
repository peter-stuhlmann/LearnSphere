import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { protectedVideoUrl } from "@elearning/core/media-url";
import {
  parseRangeHeader,
  protectedVideoFsPath,
  videoContentType,
} from "@/lib/protected-media";
import { mediaSignSecret, verifyMediaSignature } from "@/lib/media-sign";

/**
 * Geschützte Video-Auslieferung: Kursvideos liegen außerhalb von public/
 * und werden nur nach Berechtigungsprüfung gestreamt (Range-Requests wie
 * bei Streaming-Anbietern). Zugriff hat, wer das Video hochgeladen hat
 * (Creator im Editor), Admin ist, in den Kurs eingeschrieben ist – oder
 * jeder bei kostenlosen Vorschau-Lektionen. Direktaufrufe in der
 * Adresszeile ("Speichern unter …") werden über Sec-Fetch-Dest geblockt.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; file: string }> }
) {
  const { userId, file } = await params;
  const url = protectedVideoUrl(userId, file);

  // Mobile-App: signierte URL (se/st) statt Session-Cookie. Die Einschreibung
  // wurde beim Signieren geprüft (Lesson-Endpoint); hier zählt nur noch
  // Signatur + Ablauf – native Player senden weder Cookies noch Sec-Fetch-Dest.
  const se = request.nextUrl.searchParams.get("se");
  const st = request.nextUrl.searchParams.get("st");
  if (se || st) {
    let signedOk = false;
    try {
      signedOk = verifyMediaSignature({
        path: url,
        se,
        st,
        secret: mediaSignSecret(),
      });
    } catch {
      // Secret nicht konfiguriert → signierter Zugriff deaktiviert
    }
    if (!signedOk) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return streamVideo(request, userId, file);
  }

  // Nur Einbettung als Medium (Sec-Fetch-Dest: video/empty), keine
  // Direktnavigation – blockt Adresszeilen-Download im Browser
  const fetchDest = request.headers.get("sec-fetch-dest");
  if (fetchDest === "document") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "ADMIN";

  let allowed = isAdmin || viewerId === userId;

  if (!allowed) {
    // Block über die URL finden (Basissprache oder Übersetzung) und die
    // Berechtigung aus Kurskontext ableiten
    const block = await db.lessonBlock.findFirst({
      where: {
        type: "VIDEO",
        OR: [
          { url },
          { translations: { path: "$.en.url", equals: url } },
          { translations: { path: "$.de.url", equals: url } },
        ],
      },
      select: {
        lesson: {
          select: {
            isPreview: true,
            section: { select: { courseId: true } },
          },
        },
      },
    });

    if (block?.lesson.isPreview) {
      allowed = true;
    } else if (block && viewerId) {
      const enrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: viewerId,
            courseId: block.lesson.section.courseId,
          },
        },
        select: { id: true },
      });
      allowed = Boolean(enrollment);
    }
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: viewerId ? 403 : 401 }
    );
  }

  return streamVideo(request, userId, file);
}

/** Datei mit Range-Support ausliefern (Berechtigung ist bereits geprüft). */
async function streamVideo(
  request: NextRequest,
  userId: string,
  file: string
): Promise<Response> {
  const filePath = protectedVideoFsPath(process.cwd(), { userId, file });
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": videoContentType(file),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, no-store",
    "Content-Disposition": "inline",
  };

  const range = parseRangeHeader(request.headers.get("range"), size);
  if (range) {
    const stream = Readable.toWeb(
      createReadStream(filePath, { start: range.start, end: range.end })
    ) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(range.end - range.start + 1),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
