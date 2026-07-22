/**
 * Embeddings als rohes Float32-Array statt als JSON.
 *
 * Vor jeder Frage werden sämtliche Chunks eines Kurses geladen. Als
 * JSON-Text belegt ein Embedding mit 1536 Dimensionen rund 23 KB und muss
 * geparst werden; bei einem zehnstündigen Videokurs (~650 Chunks) sind das
 * ~15 MB Parsing pro Frage. Binär sind es 6 KB je Embedding, und das
 * Dekodieren ist ein Blick auf denselben Speicher – kein Parsen.
 *
 * Little Endian ist festgelegt, damit die Daten zwischen Architekturen
 * austauschbar bleiben (ein Dump von einem ARM-Server muss auf x86 lesbar
 * sein). Auf beiden üblichen Plattformen ist das ohnehin die native
 * Reihenfolge, es kostet also nichts.
 */

/** Dimensionen von text-embedding-3-small – dient nur der Plausibilitätsprüfung. */
export const EMBEDDING_DIMENSIONS = 1536;

export function encodeEmbedding(values: number[]): Uint8Array<ArrayBuffer> {
  const floats = Float32Array.from(values);
  const bytes = new Uint8Array(new ArrayBuffer(floats.length * 4));
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < floats.length; i += 1) {
    view.setFloat32(i * 4, floats[i], true);
  }
  return bytes;
}

/**
 * Dekodiert ohne zu kopieren, solange der Puffer ausgerichtet ist – der
 * Normalfall. Prisma kann Blobs mit ungeradem Offset liefern; dann wird
 * einmal umkopiert, statt falsche Werte zu lesen.
 */
export function decodeEmbedding(data: Uint8Array): Float32Array {
  const aligned = data.byteOffset % 4 === 0;
  const bytes = aligned ? data : Uint8Array.from(data);
  return new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    Math.floor(bytes.byteLength / 4)
  );
}
