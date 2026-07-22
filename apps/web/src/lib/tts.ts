import { createHash } from "node:crypto";
import { htmlToPlainText } from "@elearning/core/html-text";

/**
 * Vorlesen-Feature: Lektionstexte werden in satzweise Chunks zerlegt und je
 * Chunk gehasht. Generiertes Audio wird pro Hash gecacht – ändert sich ein
 * Satz, muss nur sein Segment neu generiert werden, nicht der ganze Text.
 * Absätze sind harte Grenzen, damit Änderungen lokal bleiben.
 */

export const TTS_MODEL = "gpt-4o-mini-tts";
export const TTS_VOICE = "alloy";

/** Maximale Segmentlänge – klein genug für feines Caching, groß genug
 *  gegen Request-Overhead. */
export const TTS_MAX_SEGMENT_CHARS = 600;

/** Absatz in Sätze teilen (Satzzeichen bleiben am Satz). */
function splitSentences(paragraph: string): string[] {
  const matches = paragraph.match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g);
  return (matches ?? [paragraph]).map((s) => s.trim()).filter(Boolean);
}

/** Überlange Stücke ohne Satzgrenzen an Wortgrenzen hart teilen. */
function hardSplit(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  // text ist nie leer (nur für überlange Stücke aufgerufen) → Rest anhängen
  chunks.push(current);
  return chunks;
}

/**
 * Klartext in TTS-Segmente zerlegen: Absätze sind harte Grenzen; innerhalb
 * eines Absatzes werden Sätze greedy bis TTS_MAX_SEGMENT_CHARS gebündelt.
 */
export function splitIntoTtsSegments(
  text: string,
  maxChars: number = TTS_MAX_SEGMENT_CHARS
): string[] {
  const segments: string[] = [];

  for (const rawParagraph of text.split(/\n{2,}/)) {
    const paragraph = rawParagraph.replace(/\s+/g, " ").trim();
    if (!paragraph) continue;
    if (paragraph.length <= maxChars) {
      segments.push(paragraph);
      continue;
    }

    let current = "";
    for (const sentence of splitSentences(paragraph)) {
      const pieces =
        sentence.length > maxChars ? hardSplit(sentence, maxChars) : [sentence];
      for (const piece of pieces) {
        const candidate = current ? `${current} ${piece}` : piece;
        if (candidate.length > maxChars && current) {
          segments.push(current);
          current = piece;
        } else {
          current = candidate;
        }
      }
    }
    segments.push(current);
  }

  // Schutznetz gegen Leersegmente aus Grenzfällen (z. B. reine Satzzeichen)
  return segments.filter((segment) => segment.length > 0);
}

/** HTML direkt in Segmente überführen (Strip + Split). */
export function ttsSegmentsFromHtml(html: string): string[] {
  return splitIntoTtsSegments(htmlToPlainText(html));
}

export interface TtsChunk {
  text: string;
  /** Überschriften bekommen beim Vorlesen längere Pausen */
  kind: "heading" | "paragraph";
}

/**
 * Maximale Segmentlänge für die Browser-Stimme (Web Speech API).
 *
 * Chrome beendet eine einzelne Äußerung nach etwa 15 Sekunden Sprechzeit,
 * ohne das "end"-Ereignis auszulösen: Die Stimme verstummt, der Player
 * wartet weiter auf ein Signal, das nie kommt. Bei rund 950 Zeichen pro
 * Minute entsprechen 180 Zeichen etwa 11 Sekunden – mit Sicherheitsabstand
 * unterhalb der Grenze, auch bei langsamer Wiedergabegeschwindigkeit.
 *
 * Für die OpenAI-Stimme bleibt es bei TTS_MAX_SEGMENT_CHARS: dort spricht
 * nichts gegen längere Abschnitte, und größere Segmente bedeuten weniger
 * Cache-Einträge und weniger Anfragen.
 */
export const BROWSER_MAX_SEGMENT_CHARS = 180;

/**
 * Segmente für die Browser-Stimme kleinteiliger machen. Die Einteilung in
 * Überschrift/Absatz bleibt erhalten, damit die Sprechpausen stimmen.
 */
export function splitChunksForBrowserSpeech(
  chunks: TtsChunk[],
  maxChars: number = BROWSER_MAX_SEGMENT_CHARS
): TtsChunk[] {
  return chunks.flatMap((chunk) =>
    chunk.text.length <= maxChars
      ? [chunk]
      : splitIntoTtsSegments(chunk.text, maxChars).map((text) => ({
          text,
          kind: chunk.kind,
        }))
  );
}

/**
 * HTML strukturiert zerlegen: Überschriften (h1–h6) werden eigene Chunks
 * vom Typ "heading", alles andere absatzweise "paragraph" – der Player
 * setzt daraus natürliche Sprechpausen. Der Typ steckt bewusst nicht im
 * Audio-Hash, damit der Segment-Cache davon unberührt bleibt.
 */
export function ttsChunksFromHtml(html: string): TtsChunk[] {
  const chunks: TtsChunk[] = [];
  // Überschriften herauslösen; der Rest wird absatzweise behandelt
  const parts = html.split(/(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)/gi);
  for (const part of parts) {
    if (!part) continue;
    const kind: TtsChunk["kind"] = /^<h[1-6]/i.test(part)
      ? "heading"
      : "paragraph";
    for (const text of splitIntoTtsSegments(htmlToPlainText(part))) {
      chunks.push({ text, kind });
    }
  }
  return chunks;
}

/**
 * Cache-Schlüssel eines Segments: bindet Modell und Stimme ein, damit ein
 * späterer Wechsel automatisch neue Audios erzeugt.
 */
export function ttsSegmentHash(text: string): string {
  return createHash("sha256")
    .update(`${TTS_MODEL}|${TTS_VOICE}|${text}`)
    .digest("hex");
}
