import { describe, expect, it } from "vitest";
import {
  classifyTranscribeError,
  classifyTranscribeStatus,
} from "./transcribe-errors";

describe("classifyTranscribeStatus", () => {
  it("unterscheidet die Fälle, die verschiedene Leute lösen müssen", () => {
    // Betreiber: Schlüssel bzw. Guthaben
    expect(classifyTranscribeStatus(401)).toBe("transcribe_unauthorized");
    expect(classifyTranscribeStatus(403)).toBe("transcribe_unauthorized");
    expect(classifyTranscribeStatus(429)).toBe("transcribe_rate_limited");
    // Creator: Datei
    expect(classifyTranscribeStatus(413)).toBe("file_too_large");
    expect(classifyTranscribeStatus(400)).toBe("transcribe_rejected");
    expect(classifyTranscribeStatus(422)).toBe("transcribe_rejected");
  });

  it("Serverfehler bei OpenAI bleiben der allgemeine Fall", () => {
    expect(classifyTranscribeStatus(500)).toBe("transcribe_failed");
    expect(classifyTranscribeStatus(503)).toBe("transcribe_failed");
  });
});

describe("classifyTranscribeError", () => {
  it("erkennt Zeitüberschreitungen – kein Programmfehler", () => {
    const timeout = new Error("zu lang");
    timeout.name = "TimeoutError";
    expect(classifyTranscribeError(timeout)).toBe("transcribe_timeout");

    const abort = new Error("abgebrochen");
    abort.name = "AbortError";
    expect(classifyTranscribeError(abort)).toBe("transcribe_timeout");
  });

  it("alles andere ist der allgemeine Fehlschlag", () => {
    expect(classifyTranscribeError(new Error("kaputt"))).toBe(
      "transcribe_failed"
    );
    expect(classifyTranscribeError(null)).toBe("transcribe_failed");
    expect(classifyTranscribeError("Zeichenkette")).toBe("transcribe_failed");
  });
});
