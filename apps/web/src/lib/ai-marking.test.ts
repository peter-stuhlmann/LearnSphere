import { describe, expect, it } from "vitest";
import {
  AI_GENERATED_ATTR,
  AI_GENERATED_HEADER,
  AI_SOURCE_TYPE,
  aiGeneratedProps,
  withAiAudioTag,
} from "./ai-marking";

describe("DOM-Kennzeichnung", () => {
  it("liefert das data-Attribut als Props-Spread", () => {
    expect(AI_GENERATED_ATTR).toBe("data-ai-generated");
    expect(aiGeneratedProps).toEqual({ "data-ai-generated": "true" });
  });

  it("nutzt das IPTC-Vokabular für die Quellenangabe", () => {
    expect(AI_SOURCE_TYPE).toContain("trainedAlgorithmicMedia");
  });

  it("definiert den HTTP-Header für KI-Endpunkte", () => {
    expect(AI_GENERATED_HEADER).toBe("X-AI-Generated");
  });
});

describe("withAiAudioTag (ID3v2-Kennzeichnung für MP3)", () => {
  // Minimale MP3-Attrappe: Frame-Sync-Bytes + Füllung
  const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4]);

  it("stellt einen ID3v2.3-Tag mit TXXX-Frame voran", () => {
    const tagged = withAiAudioTag(mp3);
    // "ID3" Magic + Version 2.3
    expect([...tagged.slice(0, 5)]).toEqual([0x49, 0x44, 0x33, 0x03, 0x00]);
    const text = new TextDecoder("latin1").decode(tagged);
    expect(text).toContain("TXXX");
    expect(text).toContain("DigitalSourceType");
    expect(text).toContain("trainedAlgorithmicMedia");
  });

  it("hängt die Original-Audiodaten unverändert an", () => {
    const tagged = withAiAudioTag(mp3);
    expect([...tagged.slice(tagged.length - mp3.length)]).toEqual([...mp3]);
  });

  it("kodiert die Tag-Größe syncsafe (kein Byte ≥ 0x80)", () => {
    const tagged = withAiAudioTag(mp3);
    // Bytes 6–9 sind die syncsafe-Größe des Tags
    for (const byte of tagged.slice(6, 10)) {
      expect(byte).toBeLessThan(0x80);
    }
    // Größe stimmt: Header (10) + Größe = Beginn der Audiodaten
    const size =
      (tagged[6] << 21) | (tagged[7] << 14) | (tagged[8] << 7) | tagged[9];
    expect(tagged.length).toBe(10 + size + mp3.length);
  });

  it("taggt nicht doppelt, wenn schon ein ID3-Tag vorhanden ist", () => {
    const once = withAiAudioTag(mp3);
    const twice = withAiAudioTag(once);
    expect(twice).toBe(once);
  });
});
