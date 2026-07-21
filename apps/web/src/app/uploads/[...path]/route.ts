import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { resolvePublicUploadPath, uploadContentType } from "@/lib/storage";

/**
 * Liefert öffentliche Uploads (Bilder, Audio, Dateien, TTS) aus dem
 * Upload-Verzeichnis aus. Nötig fürs Self-Hosting: Next serviert nur
 * public/-Dateien, die zum Build-Zeitpunkt existierten – zur Laufzeit
 * hochgeladene Dateien liefen sonst ins Leere. Im Dev greifen vorhandene
 * public/-Dateien weiterhin direkt (statische Auslieferung hat Vorrang).
 * Dateinamen sind zufällig (randomBytes) → aggressiv cachebar.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const filePath = resolvePublicUploadPath(segments);
  if (!filePath) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not_a_file");
    size = info.size;
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const stream = Readable.toWeb(
    createReadStream(filePath)
  ) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": uploadContentType(filePath),
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
