import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  extensionForMime,
  isAllowedUpload,
  type UploadKind,
} from "@/lib/upload";
import { generateVideoPoster, resolveFfmpeg } from "@/lib/transcribe";
import { protectedUploadsDir, publicUploadsDir } from "@/lib/storage";
import { protectedVideoUrl } from "@elearning/core/media-url";
import { db } from "@/lib/db";
import {
  imageBufferToDataUrl,
  isModerationEnabled,
  moderateImages,
  moderateVideoFrames,
} from "@/lib/moderation";

const KINDS: UploadKind[] = ["video", "audio", "image", "file"];

/**
 * Nimmt Creator-Uploads entgegen. Ablageorte kommen aus lib/storage –
 * im Docker-Deployment sind das persistente Volumes (UPLOADS_DIR /
 * PROTECTED_UPLOADS_DIR), ausgeliefert wird über /uploads/[...path] bzw.
 * die zugriffsgeprüfte Video-Route /api/media/v/….
 */
export async function POST(request: NextRequest) {
  try {
    return await handleUpload(request);
  } catch (err) {
    // Bisher fiel hier eine unbehandelte Ausnahme durch und wurde ein
    // nackter 500 ohne Grund – der Client zeigte nur "Upload fehlgeschlagen",
    // die Ursache stand nirgends. Jetzt landet sie im Server-Log, und der
    // Client bekommt einen Code, mit dem sich etwas anfangen lässt.
    console.error("[upload] fehlgeschlagen:", err);
    // Node meldet einen vollen Datenträger als ENOSPC – der häufigste
    // Betriebsgrund, und einer, den nur der Betreiber lösen kann.
    const code = (err as { code?: string } | null)?.code;
    if (code === "ENOSPC") {
      return NextResponse.json({ error: "storage_full" }, { status: 507 });
    }
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}

async function handleUpload(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Bricht die Verbindung mitten im Upload ab (Timeout, Größenlimit des
  // Reverse-Proxy), scheitert schon das Einlesen des Formulars.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error("[upload] Formular unvollständig empfangen:", err);
    return NextResponse.json({ error: "upload_incomplete" }, { status: 400 });
  }
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File) || typeof kind !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!KINDS.includes(kind as UploadKind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (!isAllowedUpload(kind as UploadKind, file.type, file.size)) {
    return NextResponse.json({ error: "file_not_allowed" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Bilder synchron prüfen (FSK-18/Hass) – abgelehnte werden nie gespeichert
  if (kind === "image" && isModerationEnabled()) {
    const verdict = await moderateImages([
      imageBufferToDataUrl(buffer, file.type),
    ]);
    if (verdict.flagged) {
      return NextResponse.json(
        { error: "content_flagged", reason: verdict.reason },
        { status: 422 }
      );
    }
  }

  const extension = extensionForMime(file.type);
  const name = `${randomBytes(12).toString("hex")}.${extension}`;
  const userId = session.user.id;

  /* Videos landen NICHT unter public/ (dort wäre jede URL ungeschützt
     abrufbar), sondern im geschützten Ordner – ausgeliefert wird nur über
     die zugriffsgeprüfte Streaming-Route /api/media/v/… */
  const isProtected = kind === "video";
  const directory = isProtected
    ? path.join(protectedUploadsDir(), userId)
    : path.join(publicUploadsDir(), userId);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, name);
  await writeFile(filePath, buffer);

  const url = isProtected
    ? protectedVideoUrl(userId, name)
    : `/uploads/${userId}/${name}`;

  // Videos asynchron prüfen (Keyframes) – bis dahin Status PENDING;
  // das Publish-Gate blockiert Veröffentlichung, solange nicht APPROVED
  if (kind === "video" && isModerationEnabled()) {
    await db.mediaModeration
      .upsert({
        where: { url },
        create: { url, userId, kind, status: "PENDING" },
        update: { status: "PENDING" },
      })
      .catch(() => {});
    after(async () => {
      try {
        const ffmpegPath = await resolveFfmpeg();
        const verdict = ffmpegPath
          ? await moderateVideoFrames(ffmpegPath, filePath)
          : { flagged: false, reason: "", categories: [] };
        await db.mediaModeration.update({
          where: { url },
          data: {
            status: verdict.flagged ? "FLAGGED" : "APPROVED",
            reason: verdict.reason || null,
            categories: verdict.categories,
          },
        });
      } catch (err) {
        console.error("[moderation] Video-Prüfung fehlgeschlagen:", err);
        // fail-open: nicht ewig PENDING lassen
        await db.mediaModeration
          .update({ where: { url }, data: { status: "APPROVED" } })
          .catch(() => {});
      }
    });
  }

  // Videos: Poster aus dem 1. Frame vorbelegen (Creator kann es ersetzen).
  // Das Poster ist unkritisch und bleibt öffentlich unter public/uploads.
  let poster: string | null = null;
  if (kind === "video") {
    const posterName = await generateVideoPoster(filePath);
    if (posterName) {
      const publicDir = path.join(publicUploadsDir(), userId);
      await mkdir(publicDir, { recursive: true });
      await rename(
        path.join(directory, posterName),
        path.join(publicDir, posterName)
      );
      poster = `/uploads/${userId}/${posterName}`;
    }
  }

  return NextResponse.json({ url, fileName: file.name, poster });
}
