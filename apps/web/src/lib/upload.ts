export type UploadKind = "video" | "audio" | "image" | "file";

export const UPLOAD_LIMITS: Record<
  UploadKind,
  { maxBytes: number; mimeTypes: Set<string> }
> = {
  video: {
    maxBytes: 200 * 1024 * 1024, // 200 MB
    mimeTypes: new Set(["video/mp4", "video/webm", "video/quicktime"]),
  },
  audio: {
    maxBytes: 50 * 1024 * 1024, // 50 MB
    mimeTypes: new Set([
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
      "audio/x-m4a",
    ]),
  },
  image: {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    // kein SVG: kann Skripte enthalten
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  },
  file: {
    maxBytes: 50 * 1024 * 1024, // 50 MB
    mimeTypes: new Set([
      "application/pdf",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/json",
    ]),
  },
};

export function isAllowedUpload(
  kind: UploadKind,
  mimeType: string,
  sizeBytes: number
): boolean {
  const limits = UPLOAD_LIMITS[kind];
  return (
    limits.mimeTypes.has(mimeType) &&
    sizeBytes > 0 &&
    sizeBytes <= limits.maxBytes
  );
}

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
};

export function extensionForMime(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? "bin";
}

export function uploadKindForBlockType(blockType: string): UploadKind | null {
  switch (blockType) {
    case "VIDEO":
      return "video";
    case "AUDIO":
      return "audio";
    case "IMAGE":
      return "image";
    case "FILE":
      return "file";
    default:
      return null;
  }
}
