/**
 * Maschinenlesbare Kennzeichnung KI-erzeugter Inhalte (Art. 50 Abs. 2
 * EU-KI-VO, "auf Nummer sicher" auch in der Betreiber-Rolle):
 *
 * - HTML/DOM: `data-ai-generated="true"` an Containern KI-erzeugter Inhalte
 *   (Transkripte, Selbsttests, Assistent-Antworten) – automatisiert
 *   auslesbar, ohne visuelles Gewicht.
 * - MP3: generierte Audiodateien (Vorlesefunktion) bekommen einen
 *   ID3v2.3-Tag mit dem IPTC-Vokabular "trainedAlgorithmicMedia" – das
 *   ist der etablierte Metadaten-Standard für synthetische Medien.
 *
 * Für kurzen Fließtext existiert kein belastbarer Wasserzeichen-Standard;
 * die Verordnung verlangt Kennzeichnung nur "soweit technisch machbar".
 */

export const AI_GENERATED_ATTR = "data-ai-generated";

/** IPTC Digital Source Type für vollständig KI-generierte Medien. */
export const AI_SOURCE_TYPE =
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";

/** Props-Spread für React-Container mit KI-erzeugtem Inhalt. */
export const aiGeneratedProps = { [AI_GENERATED_ATTR]: "true" } as const;

/** HTTP-Header für Endpunkte, die KI-erzeugte Inhalte ausliefern. */
export const AI_GENERATED_HEADER = "X-AI-Generated";

/* ---------- ID3v2.3-Tag für generierte MP3s ---------- */

const encoder = new TextEncoder();

/** 28-Bit-Zahl syncsafe kodieren (je Byte nur 7 Bit, MSB = 0). */
function syncsafe(value: number): [number, number, number, number] {
  return [
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ];
}

/** TXXX-Frame (ID3v2.3, Latin-1): benutzerdefiniertes Text-Feld. */
function txxxFrame(description: string, value: string): Uint8Array {
  // Body: Encoding-Byte 0x00 (Latin-1) + Beschreibung + 0x00 + Wert
  const body = new Uint8Array([
    0x00,
    ...encoder.encode(description),
    0x00,
    ...encoder.encode(value),
  ]);
  const frame = new Uint8Array(10 + body.length);
  frame.set(encoder.encode("TXXX"), 0);
  // Frame-Größe: reguläre Big-Endian-Zahl (erst v2.4 nutzt syncsafe)
  frame[4] = (body.length >> 24) & 0xff;
  frame[5] = (body.length >> 16) & 0xff;
  frame[6] = (body.length >> 8) & 0xff;
  frame[7] = body.length & 0xff;
  // frame[8..9] = Flags 0x0000
  frame.set(body, 10);
  return frame;
}

/**
 * Generierte MP3-Daten als KI-erzeugt kennzeichnen: stellt einen
 * ID3v2.3-Tag mit `TXXX:DigitalSourceType = trainedAlgorithmicMedia`
 * voran. Trägt die Datei bereits einen ID3-Tag, bleibt sie unverändert
 * (mehrere v2-Tags wären nicht standardkonform).
 */
export function withAiAudioTag(mp3: Uint8Array): Uint8Array {
  if (mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33) {
    return mp3;
  }
  const frame = txxxFrame("DigitalSourceType", AI_SOURCE_TYPE);
  const header = new Uint8Array(10);
  header.set(encoder.encode("ID3"), 0);
  header[3] = 0x03; // Version 2.3.0
  header[4] = 0x00;
  header[5] = 0x00; // keine Flags
  header.set(syncsafe(frame.length), 6);

  const tagged = new Uint8Array(header.length + frame.length + mp3.length);
  tagged.set(header, 0);
  tagged.set(frame, header.length);
  tagged.set(mp3, header.length + frame.length);
  return tagged;
}
