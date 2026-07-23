import { execFile } from "node:child_process";
import { access, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ownedMediaFsPath } from "./protected-media";
import { recordAiUsage } from "./ai-usage-server";
import {
  classifyTranscribeError,
  classifyTranscribeStatus,
  type TranscribeError,
} from "./transcribe-errors";

const execFileAsync = promisify(execFile);

/**
 * Automatische Transkription hochgeladener Video-/Audiodateien via OpenAI.
 * Bevorzugt läuft das Diarization-Modell (erkennt Sprecher: "Person 1/2"),
 * bei Problemen fällt alles auf Whisper zurück. Nur für eigene Uploads
 * (/uploads/<userId>/…) – externe Quellen wie YouTube liefern uns keine
 * Mediendatei (und Download wäre ein ToS-Verstoß); dort pflegen Creator
 * das Transkript manuell.
 *
 * Mit ffmpeg (Normalfall, via ffmpeg-static) wird IMMER erst das Audio als
 * MP3 extrahiert (mono, 16 kHz) und in 10-Minuten-Segmente geschnitten –
 * das umgeht Whispers 25-MB-Limit UND normalisiert Container/Codec
 * (Whisper prüft die Datei-Endung; z. B. M4A-Inhalt mit .mp4-Endung wird
 * sonst abgelehnt). Deckel: MAX_CHUNKS Segmente.
 * Ohne ffmpeg: kleine Dateien gehen unverändert raus, große Audiodateien
 * werden byte-weise in ~24-MB-Stücke geteilt (MP3/OGG verkraften das),
 * große Videos bekommen eine klare Fehlermeldung.
 */

/** Whisper akzeptiert Dateien bis 25 MB pro Request. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

/** Byte-Chunks etwas unter dem Limit lassen (Header/Formdata-Overhead). */
const CHUNK_BYTES = 24 * 1024 * 1024;

/** Obergrenze an Chunks (à 10 min ≙ 4 Stunden Material). */
const MAX_CHUNKS = 24;

/** OpenAI-Transkription mit Sprecher-Erkennung; Fallback ist whisper-1. */
const DIARIZE_MODEL = "gpt-4o-transcribe-diarize";

const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".ogg", ".wav", ".weba"]);

export function isTranscriptionEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Zeitgestempeltes Segment (Sekunden) – Basis für die Karaoke-Anzeige. */
export interface TimedSegment {
  start: number;
  end: number;
  text: string;
  /** Sprecher-Nummer ("1", "2", …); "" wenn keine Diarization lief */
  speaker?: string;
}

export type TranscribeResult =
  | { ok: true; text: string; language: "de" | "en"; segments: TimedSegment[] }
  | { ok: false; error: TranscribeError };

/**
 * ffmpeg auflösen: bevorzugt das mitgelieferte Binary aus `ffmpeg-static`
 * (funktioniert ohne Systeminstallation), sonst ein System-ffmpeg im PATH.
 */
export async function resolveFfmpeg(): Promise<string | null> {
  try {
    const mod = (await import("ffmpeg-static")) as {
      default?: string | null;
    };
    // Nur zurückgeben, wenn das Binary auch wirklich ausführbar dort liegt.
    // ffmpeg-static meldet einen Pfad, selbst wenn das Binary fehlt (etwa
    // weil sein Download-Skript beim Install übersprungen wurde) – dann
    // gäbe es zur Laufzeit ein ENOENT statt des System-Fallbacks darunter.
    if (mod.default) {
      await access(mod.default, fsConstants.X_OK);
      return mod.default;
    }
  } catch {
    // Paket fehlt oder Binary nicht ausführbar → System-ffmpeg probieren
  }
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 10_000 });
    return "ffmpeg";
  } catch {
    return null;
  }
}

/**
 * Poster (Vorschaubild) aus dem 1. Frame eines Videos erzeugen. Die JPG
 * landet neben der Videodatei (<name>-poster.jpg). Gibt den Dateinamen
 * zurück; null, wenn ffmpeg fehlt oder die Extraktion scheitert.
 */
export async function generateVideoPoster(
  videoPath: string
): Promise<string | null> {
  const ffmpegPath = await resolveFfmpeg();
  if (!ffmpegPath) return null;

  const posterName = `${path.basename(videoPath, path.extname(videoPath))}-poster.jpg`;
  const posterPath = path.join(path.dirname(videoPath), posterName);
  try {
    await execFileAsync(
      ffmpegPath,
      ["-y", "-i", videoPath, "-frames:v", "1", "-q:v", "3", posterPath],
      { timeout: 60_000 }
    );
    return posterName;
  } catch (err) {
    console.error("[poster] Erzeugung fehlgeschlagen:", err);
    return null;
  }
}

/** Audio extrahieren (mono, 16 kHz, 48 kbit/s) und in 20-min-Stücke teilen. */
async function extractAudioChunks(
  ffmpegPath: string,
  filePath: string
): Promise<{
  dir: string;
  files: string[];
  cleanup: () => Promise<void>;
}> {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "ls-transcribe-"));
  const cleanup = () => rm(outDir, { recursive: true, force: true });

  await execFileAsync(
    ffmpegPath,
    [
      "-i",
      filePath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "48k",
      "-f",
      "segment",
      "-segment_time",
      // 10-min-Stücke: klein genug, dass das Diarization-Modell einen Chunk
      // sicher innerhalb des 300-s-Header-Timeouts von fetch verarbeitet
      // (Modell-Limit wäre 1400 s Audio, aber 20-min-Chunks liefen in Tests
      // in ebendieses Timeout) – und weit unter Whispers 25-MB-Limit
      "600",
      path.join(outDir, "chunk%03d.mp3"),
    ],
    { timeout: 600_000 }
  );

  const files = (await readdir(outDir))
    .filter((f) => f.endsWith(".mp3"))
    .sort()
    .map((f) => path.join(outDir, f));
  return { dir: outDir, files, cleanup };
}

/**
 * Grobe DE/EN-Erkennung über häufige Funktionswörter – das
 * Diarization-Modell liefert (anders als Whisper) keine Sprache mit.
 */
function detectLanguage(text: string): "de" | "en" {
  const sample = ` ${text.toLowerCase().slice(0, 4_000)} `;
  const count = (words: string[]) =>
    words.reduce(
      (sum, word) => sum + (sample.split(` ${word} `).length - 1),
      0
    );
  const de = count(["und", "ich", "nicht", "das", "die", "der", "ist", "auch"]);
  const en = count(["the", "and", "you", "that", "not", "is", "of", "have"]);
  return en > de ? "en" : "de";
}

/** Referenz-Sprecher für konsistente Labels über Chunk-Grenzen hinweg. */
interface KnownSpeaker {
  name: string;
  dataUrl: string;
}

/**
 * Ein Stück an das Diarization-Modell schicken: liefert zeitgestempelte
 * Segmente MIT Sprecher-Labels. Ohne Referenzen vergibt das Modell eigene
 * Labels (A, B, … – nur pro Request gültig); mit `known` bekommen erkannte
 * Sprecher die Namen der übergebenen Referenz-Audios.
 */
async function diarizeChunk(
  apiKey: string,
  buffer: Buffer,
  fileName: string,
  known: KnownSpeaker[]
): Promise<{ segments: TimedSegment[]; duration: number } | null> {
  const formData = new FormData();
  formData.set("file", new File([new Uint8Array(buffer)], fileName));
  formData.set("model", DIARIZE_MODEL);
  formData.set("response_format", "diarized_json");
  formData.set("chunking_strategy", "auto");
  for (const speaker of known) {
    formData.append("known_speaker_names[]", speaker.name);
    formData.append("known_speaker_references[]", speaker.dataUrl);
  }

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(300_000),
    }
  );
  if (!response.ok) {
    console.error(
      "[transcribe] Diarization-Fehler (Fallback Whisper):",
      response.status,
      (await response.text()).slice(0, 300)
    );
    return null;
  }
  const body = (await response.json()) as {
    segments?: { start?: number; end?: number; text?: string; speaker?: string }[];
    usage?: { seconds?: number };
  };
  const segments = (body.segments ?? [])
    .map((s) => ({
      start: Math.max(0, s.start ?? 0),
      end: Math.max(0, s.end ?? 0),
      text: (s.text ?? "").trim(),
      speaker: (s.speaker ?? "").trim(),
    }))
    .filter((s) => s.text && s.end > s.start);
  if (segments.length === 0) return null;
  return {
    segments,
    duration: body.usage?.seconds ?? segments[segments.length - 1].end,
  };
}

/**
 * Schneidet pro Sprecher einen kurzen Referenz-Schnipsel (≤ 8 s) aus dem
 * ersten Chunk – damit spätere Chunks dieselben Sprecher-Namen vergeben.
 */
async function buildSpeakerRefs(
  ffmpegPath: string,
  dir: string,
  chunkFile: string,
  segments: TimedSegment[],
  rename: Map<string, string>
): Promise<KnownSpeaker[]> {
  // längstes Segment je Sprecher als Referenz wählen
  const bestBySpeaker = new Map<string, TimedSegment>();
  for (const segment of segments) {
    if (!segment.speaker) continue;
    const best = bestBySpeaker.get(segment.speaker);
    if (!best || segment.end - segment.start > best.end - best.start) {
      bestBySpeaker.set(segment.speaker, segment);
    }
  }

  const known: KnownSpeaker[] = [];
  for (const [label, segment] of bestBySpeaker) {
    const out = path.join(dir, `ref-${known.length}.mp3`);
    const duration = Math.min(8, Math.max(2, segment.end - segment.start));
    try {
      await execFileAsync(
        ffmpegPath,
        ["-ss", String(segment.start), "-i", chunkFile, "-t", String(duration), out],
        { timeout: 60_000 }
      );
      known.push({
        name: rename.get(label) ?? label,
        dataUrl: `data:audio/mp3;base64,${(await readFile(out)).toString("base64")}`,
      });
    } catch {
      // Referenz ist optional – ohne sie sind Labels ggf. nur chunk-lokal
    }
  }
  return known;
}

/**
 * Diarization über alle Chunks: Der erste Chunk liefert die Sprecher; aus
 * ihm werden Referenz-Schnipsel geschnitten, die allen weiteren Chunks als
 * known_speakers mitgegeben werden – so bleibt "Person 1" dieselbe Person.
 * null = nicht möglich (Modell nicht verfügbar, oder mehrere Chunks ohne
 * ffmpeg-Dateien) → Aufrufer fällt auf Whisper zurück.
 */
async function diarizeAll(
  apiKey: string,
  sources: (Buffer | string)[],
  chunkName: string,
  refCtx: { ffmpegPath: string; dir: string } | null
): Promise<TimedSegment[] | null> {
  // Ohne Chunk-Dateien lassen sich keine Referenzen schneiden →
  // Sprecher wären über Chunk-Grenzen nicht konsistent
  if (sources.length > 1 && !refCtx) return null;

  let known: KnownSpeaker[] = [];
  const merged: TimedSegment[] = [];
  let offset = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const buffer = typeof source === "string" ? await readFile(source) : source;
    const result = await diarizeChunk(apiKey, buffer, chunkName, known);
    if (!result) return null;

    for (const segment of result.segments) {
      merged.push({
        ...segment,
        start: segment.start + offset,
        end: segment.end + offset,
      });
    }
    offset += result.duration;

    if (i === 0 && sources.length > 1 && refCtx && typeof source === "string") {
      // Labels des ersten Chunks auf stabile Namen (P1, P2, …) umschreiben
      // und Referenzen mit genau diesen Namen schneiden
      const order: string[] = [];
      for (const segment of result.segments) {
        if (segment.speaker && !order.includes(segment.speaker)) {
          order.push(segment.speaker);
        }
      }
      const rename = new Map(
        order.map((label, index) => [label, `P${index + 1}`] as const)
      );
      for (const segment of merged) {
        if (segment.speaker) {
          segment.speaker = rename.get(segment.speaker) ?? segment.speaker;
        }
      }
      known = await buildSpeakerRefs(
        refCtx.ffmpegPath,
        refCtx.dir,
        source,
        result.segments,
        rename
      );
    }
  }
  return merged;
}

/**
 * Ein Stück an Whisper schicken; verbose_json liefert Sprache, Dauer und
 * zeitgestempelte Segmente mit (Timestamps relativ zum Chunk-Anfang).
 */
async function whisperChunk(
  apiKey: string,
  buffer: Buffer,
  fileName: string
): Promise<
  | {
      ok: true;
      text: string;
      language: string;
      duration: number;
      segments: TimedSegment[];
    }
  | { ok: false; error: TranscribeError }
> {
  const formData = new FormData();
  formData.set("file", new File([new Uint8Array(buffer)], fileName));
  formData.set("model", "whisper-1");
  formData.set("response_format", "verbose_json");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(180_000),
    }
  );
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    console.error("[transcribe] Whisper-Fehler:", response.status, body);
    return { ok: false, error: classifyTranscribeStatus(response.status) };
  }
  const body = (await response.json()) as {
    text?: string;
    language?: string;
    duration?: number;
    segments?: { start?: number; end?: number; text?: string }[];
  };
  // Leere Antwort: Tonspur ohne erkennbare Sprache (Musik, Stille, Rauschen)
  if (!body.text) return { ok: false, error: "transcribe_rejected" };
  return {
    ok: true,
    text: body.text.trim(),
    language: body.language ?? "",
    duration: body.duration ?? 0,
    segments: (body.segments ?? [])
      .map((s) => ({
        start: Math.max(0, s.start ?? 0),
        end: Math.max(0, s.end ?? 0),
        text: (s.text ?? "").trim(),
      }))
      .filter((s) => s.text && s.end > s.start),
  };
}

/**
 * Sprecher-Labels (A, B, …) → "1", "2", … in Reihenfolge des ersten
 * Auftretens. Spricht nur eine Person, entfallen die Labels ganz.
 * Zeiten werden auf 0,1 s gerundet.
 */
function withSpeakerNumbers(segments: TimedSegment[]): TimedSegment[] {
  const order: string[] = [];
  for (const segment of segments) {
    if (segment.speaker && !order.includes(segment.speaker)) {
      order.push(segment.speaker);
    }
  }
  const multi = order.length > 1;
  return segments.map((segment) => ({
    start: Math.round(segment.start * 10) / 10,
    end: Math.round(segment.end * 10) / 10,
    text: segment.text,
    speaker:
      multi && segment.speaker
        ? String(order.indexOf(segment.speaker) + 1)
        : "",
  }));
}

/**
 * Fließtext fürs Transkript-Feld: mit Sprechern ein Absatz je Redebeitrag
 * ("Person 1: …"), ohne Sprecher einfach der zusammengesetzte Text.
 */
function speakerText(segments: TimedSegment[]): string {
  if (!segments.some((segment) => segment.speaker)) {
    return segments.map((segment) => segment.text).join(" ").trim();
  }
  const turns: string[] = [];
  let current = "";
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length > 0) {
      turns.push(`Person ${current}: ${buffer.join(" ")}`);
    }
  };
  for (const segment of segments) {
    if ((segment.speaker ?? "") !== current) {
      flush();
      current = segment.speaker ?? "";
      buffer = [];
    }
    buffer.push(segment.text);
  }
  flush();
  return turns.join("\n\n").trim();
}

/**
 * Transkribiert eine hochgeladene Datei des Nutzers. Der Pfad muss im
 * eigenen Upload-Ordner liegen (verhindert Fremdzugriff und Traversal).
 */
export async function transcribeUpload(
  relativeUrl: string,
  userId: string
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "transcription_unavailable" };

  // Ownership + Pfad-Sicherheit: nur eigene Uploads (öffentlich unter
  // /uploads/<userId>/… oder geschützt unter /api/media/v/<userId>/…)
  const filePath = ownedMediaFsPath(relativeUrl, userId, process.cwd());
  if (!filePath) {
    return { ok: false, error: "url_not_upload" };
  }
  const extension = path.extname(filePath).toLowerCase();

  try {
    const info = await stat(filePath);

    // Stücke vorbereiten: mit ffmpeg IMMER erst Audio als MP3 extrahieren –
    // das normalisiert Container/Codec (Whisper prüft die Datei-Endung und
    // lehnt z. B. M4A-Inhalte mit .mp4-Endung ab) und teilt lange Dateien.
    let sources: (Buffer | string)[];
    let cleanup: (() => Promise<void>) | null = null;
    let chunkName = path.basename(filePath);
    let refCtx: { ffmpegPath: string; dir: string } | null = null;

    const ffmpegPath = await resolveFfmpeg();

    if (ffmpegPath) {
      const extracted = await extractAudioChunks(ffmpegPath, filePath);
      sources = extracted.files;
      cleanup = extracted.cleanup;
      chunkName = "chunk.mp3";
      refCtx = { ffmpegPath, dir: extracted.dir };
    } else if (info.size <= MAX_TRANSCRIBE_BYTES) {
      // Fallback ohne ffmpeg: kleine Dateien unverändert schicken
      sources = [await readFile(filePath)];
    } else if (AUDIO_EXTENSIONS.has(extension)) {
      // Fallback ohne ffmpeg: großes Audio byte-weise teilen
      const buffer = await readFile(filePath);
      sources = [];
      for (let offset = 0; offset < buffer.length; offset += CHUNK_BYTES) {
        sources.push(buffer.subarray(offset, offset + CHUNK_BYTES));
      }
    } else {
      // großes Video ohne ffmpeg: ehrlich sagen, was fehlt
      return { ok: false, error: "video_needs_ffmpeg" };
    }

    try {
      if (sources.length === 0 || sources.length > MAX_CHUNKS) {
        return { ok: false, error: "file_too_large" };
      }

      // Zuerst mit Sprecher-Erkennung versuchen; klappt das nicht
      // (Modell nicht verfügbar o. Ä.), unten der Whisper-Fallback
      // Aktivität fürs Verbrauchsprotokoll: Video- vs. Audio-Transkription
      const activity = AUDIO_EXTENSIONS.has(extension)
        ? ("TRANSCRIBE_AUDIO" as const)
        : ("TRANSCRIBE_VIDEO" as const);

      const diarized = await diarizeAll(apiKey, sources, chunkName, refCtx);
      if (diarized) {
        const segments = withSpeakerNumbers(diarized);
        void recordAiUsage({
          activity,
          model: DIARIZE_MODEL,
          audioSeconds: segments[segments.length - 1]?.end ?? 0,
          userId,
        });
        return {
          ok: true,
          text: speakerText(segments),
          language: detectLanguage(
            segments.map((segment) => segment.text).join(" ")
          ),
          segments,
        };
      }

      const texts: string[] = [];
      const segments: TimedSegment[] = [];
      let language = "";
      // Segment-Zeiten sind relativ zum Chunk → Offset über die Chunk-Dauern
      // aufaddieren, damit die Timestamps zur Gesamtdatei passen
      let offset = 0;
      for (const source of sources) {
        const chunk =
          typeof source === "string" ? await readFile(source) : source;
        const result = await whisperChunk(apiKey, chunk, chunkName);
        if (!result.ok) return result;
        texts.push(result.text);
        if (!language) language = result.language;
        for (const segment of result.segments) {
          segments.push({
            start: Math.round((segment.start + offset) * 10) / 10,
            end: Math.round((segment.end + offset) * 10) / 10,
            text: segment.text,
          });
        }
        offset += result.duration;
      }

      void recordAiUsage({
        activity,
        model: "whisper-1",
        audioSeconds: offset,
        userId,
      });
      return {
        ok: true,
        text: texts.join("\n\n").trim(),
        language: language === "english" ? "en" : "de",
        segments,
      };
    } finally {
      await cleanup?.();
    }
  } catch (err) {
    // Serverseitig protokollieren – der Client bekommt nur den Fehlercode
    console.error("[transcribe] fehlgeschlagen:", err);
    return { ok: false, error: classifyTranscribeError(err) };
  }
}
