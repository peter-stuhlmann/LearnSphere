import { describe, expect, it } from "vitest";
import {
  decodeEmbedding,
  encodeEmbedding,
  EMBEDDING_DIMENSIONS,
} from "./embedding-codec";

describe("Embedding-Kodierung", () => {
  it("überlebt Kodieren und Dekodieren", () => {
    const values = [0, 1, -1, 0.5, -0.0123456];
    const decoded = decodeEmbedding(encodeEmbedding(values));
    expect(decoded).toHaveLength(values.length);
    for (const [i, value] of values.entries()) {
      // Float32 rundet – auf sechs Stellen genau reicht für Cosinus
      expect(decoded[i]).toBeCloseTo(value, 6);
    }
  });

  it("belegt 4 Byte je Dimension – ein Bruchteil von JSON", () => {
    /* Echte Embedding-Werte sehen aus wie -0.023456789012345 und belegen
       als JSON-Text rund 18 Zeichen. Genau daher kam die alte Last. */
    const values = Array.from(
      { length: EMBEDDING_DIMENSIONS },
      (_, i) => (i % 2 === 0 ? 1 : -1) * (0.0234567890123 + i * 1e-9)
    );
    const binary = encodeEmbedding(values);
    expect(binary.byteLength).toBe(EMBEDDING_DIMENSIONS * 4);
    // mindestens viermal kleiner als die JSON-Darstellung
    expect(binary.byteLength * 4).toBeLessThan(JSON.stringify(values).length);
  });

  it("liest auch einen nicht ausgerichteten Puffer korrekt", () => {
    /* Prisma kann Blobs als Sicht in einen größeren Puffer liefern. Ohne
       Umkopieren würde Float32Array dann falsche Werte lesen. */
    const source = encodeEmbedding([1, 2, 3]);
    const padded = new Uint8Array(source.byteLength + 1);
    padded.set(source, 1);
    const shifted = padded.subarray(1);
    expect(shifted.byteOffset % 4).not.toBe(0);

    const decoded = decodeEmbedding(shifted);
    expect([...decoded]).toEqual([1, 2, 3]);
  });

  it("leeres Embedding ergibt ein leeres Array", () => {
    expect(decodeEmbedding(encodeEmbedding([]))).toHaveLength(0);
  });
});
