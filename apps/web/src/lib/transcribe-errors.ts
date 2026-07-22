export type TranscribeError =
  | "transcription_unavailable"
  | "url_not_upload"
  | "file_too_large"
  | "video_needs_ffmpeg"
  /** Schlüssel abgelehnt (401/403) – falscher oder gesperrter Key */
  | "transcribe_unauthorized"
  /** Limit oder Guthaben erschöpft (429) */
  | "transcribe_rate_limited"
  /** Datei von OpenAI abgelehnt (400) – Format, Codec oder leere Tonspur */
  | "transcribe_rejected"
  /** Zeitüberschreitung oder Netzfehler */
  | "transcribe_timeout"
  /** alles Übrige */
  | "transcribe_failed";


/**
 * HTTP-Status von OpenAI in einen aussagekräftigen Fehler übersetzen.
 *
 * Vorher endete jeder Fehlschlag als "transcribe_failed" – für den Creator
 * ein nichtssagendes "bitte erneut versuchen", und der Grund stand nur im
 * Server-Log. Ein erschöpftes Guthaben sieht damit genauso aus wie eine
 * kaputte Datei, obwohl das eine der Betreiber lösen muss und das andere
 * der Creator.
 */
export function classifyTranscribeStatus(status: number): TranscribeError {
  if (status === 401 || status === 403) return "transcribe_unauthorized";
  if (status === 429) return "transcribe_rate_limited";
  if (status === 413) return "file_too_large";
  if (status >= 400 && status < 500) return "transcribe_rejected";
  return "transcribe_failed";
}

/** Ausnahme einordnen: Zeitüberschreitungen sind kein Programmfehler. */
export function classifyTranscribeError(error: unknown): TranscribeError {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError") {
    return "transcribe_timeout";
  }
  return "transcribe_failed";
}
