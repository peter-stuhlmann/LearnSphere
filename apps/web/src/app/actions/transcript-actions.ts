"use server";

import { auth } from "@/auth";
import { transcribeUpload, type TimedSegment } from "@/lib/transcribe";
import {
  isModerationEnabled,
  moderateText,
  saveModerationResult,
} from "@/lib/moderation";
import {
  isTranslationEnabled,
  translateSegments,
  translateTranscript,
} from "@/lib/translate";
import type { ActionResult } from "./auth-actions";

/**
 * Transkribiert eine eigene hochgeladene Video-/Audiodatei. Das Ergebnis
 * (Text + zeitgestempelte Segmente für die Karaoke-Anzeige) landet im
 * Editor-Formular und wird erst mit der Lektion gespeichert.
 */
export async function transcribeBlockMedia(input: {
  url: string;
}): Promise<
  ActionResult & {
    text?: string;
    language?: "de" | "en";
    segments?: TimedSegment[];
  }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const result = await transcribeUpload(input.url, session.user.id);
  if (!result.ok) return { ok: false, error: result.error };

  // Gesprochene Inhalte prüfen (FSK-18/Hass): Treffer flaggen den Upload –
  // das Publish-Gate blockiert dann die Veröffentlichung (Admin-Review)
  if (isModerationEnabled()) {
    const verdict = await moderateText(result.text);
    if (verdict.flagged) {
      await saveModerationResult(
        input.url,
        session.user.id,
        "transcript",
        verdict
      ).catch((err) =>
        console.error("[moderation] Speichern fehlgeschlagen:", err)
      );
    }
  }

  return {
    ok: true,
    text: result.text,
    language: result.language,
    segments: result.segments,
  };
}

/** Übersetzt ein Transkript DE ↔ EN (Ergebnis geht zurück ins Formular). */
export async function translateBlockTranscript(input: {
  text: string;
  target: "de" | "en";
}): Promise<ActionResult & { text?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!isTranslationEnabled()) {
    return { ok: false, error: "translation_unavailable" };
  }

  const translated = await translateTranscript(input.text, input.target, {
    userId: session.user.id,
  });
  if (!translated) return { ok: false, error: "translate_failed" };
  return { ok: true, text: translated };
}

/**
 * Übersetzt die Texte der zeitgestempelten Segmente (gleiche Reihenfolge,
 * gleiche Länge), damit die Karaoke-Anzeige in beiden Sprachen läuft.
 */
export async function translateBlockSegments(input: {
  texts: string[];
  target: "de" | "en";
}): Promise<ActionResult & { texts?: string[] }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!isTranslationEnabled()) {
    return { ok: false, error: "translation_unavailable" };
  }
  // Grenzen wie beim Block-Schema (Anzahl/Segmentlänge)
  if (
    input.texts.length === 0 ||
    input.texts.length > 7_500 ||
    input.texts.some((t) => typeof t !== "string" || t.length > 2_000)
  ) {
    return { ok: false, error: "translate_failed" };
  }

  const translated = await translateSegments(input.texts, input.target, {
    userId: session.user.id,
  });
  if (!translated) return { ok: false, error: "translate_failed" };
  return { ok: true, texts: translated };
}
