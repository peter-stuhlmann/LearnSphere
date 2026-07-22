/**
 * Verwaiste Vorlese-Audios entfernen.
 *
 * Der TTS-Cache ist nach dem Texthash eines Segments aufgebaut. Ändert ein
 * Creator einen Absatz, bekommt der neue Text einen neuen Hash – das alte
 * MP3 bleibt liegen und wird nie wieder abgerufen. Über Jahre summiert sich
 * das auf der Platte, ohne dass es jemandem auffällt.
 *
 * Das Skript baut die Menge aller derzeit erreichbaren Hashes aus den
 * Textblöcken aller Kurse (inklusive Übersetzungen) und löscht alles, was
 * nicht darin vorkommt.
 *
 * Zwei Sicherungen:
 * - Nur Einträge, die älter als KARENZ_TAGE sind. Ein Segment, das gerade
 *   erst erzeugt wurde, während jemand die Lektion bearbeitet, überlebt.
 * - Ohne --apply wird nur gezählt, nichts gelöscht.
 *
 * Aufruf:  node --env-file=.env scripts/prune-tts-cache.mjs
 *          node --env-file=.env scripts/prune-tts-cache.mjs --apply
 */
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const KARENZ_TAGE = 7;
const apply = process.argv.includes("--apply");
const db = new PrismaClient();

/* Muss mit lib/tts.ts übereinstimmen – bewusst dupliziert, damit das
   Skript ohne TypeScript-Build läuft. Weicht es ab, löscht es zu viel;
   deshalb der Trockenlauf als Voreinstellung. */
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "alloy";
const MAX_CHARS = 600;

const hashOf = (text) =>
  createHash("sha256")
    .update(`${TTS_MODEL}|${TTS_VOICE}|${text}`)
    .digest("hex");

function htmlToPlainText(html) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(?:\/p|\/li|\/h[1-6]|\/div|\/blockquote|br\s*\/?)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function splitSegments(text) {
  const segments = [];
  for (const raw of text.split(/\n{2,}/)) {
    const paragraph = raw.replace(/\s+/g, " ").trim();
    if (!paragraph) continue;
    if (paragraph.length <= MAX_CHARS) {
      segments.push(paragraph);
      continue;
    }
    const sentences =
      paragraph.match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g) ?? [paragraph];
    let current = "";
    for (const sentence of sentences.map((s) => s.trim()).filter(Boolean)) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length > MAX_CHARS && current) {
        segments.push(current);
        current = sentence;
      } else {
        current = candidate;
      }
    }
    if (current) segments.push(current);
  }
  return segments;
}

/* Erreichbare Hashes einsammeln: alle Textblöcke, alle Sprachfassungen.
   Die Überschriften-Zerlegung des Servers ändert die Segmenttexte nicht,
   nur ihre Gruppierung – für die Hashes genügt der Klartext. */
const blocks = await db.lessonBlock.findMany({
  where: { type: "TEXT" },
  select: { content: true, translations: true },
});

const live = new Set();
let texts = 0;
for (const block of blocks) {
  const variants = [block.content ?? ""];
  const translations = block.translations ?? {};
  for (const value of Object.values(translations)) {
    if (value && typeof value.content === "string") variants.push(value.content);
  }
  for (const html of variants) {
    for (const part of html.split(/(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)/gi)) {
      if (!part) continue;
      for (const segment of splitSegments(htmlToPlainText(part))) {
        live.add(hashOf(segment));
        texts += 1;
      }
    }
  }
}

const cutoff = new Date(Date.now() - KARENZ_TAGE * 24 * 60 * 60 * 1000);
const rows = await db.ttsSegment.findMany({
  where: { createdAt: { lt: cutoff } },
  select: { id: true, hash: true },
});
const orphans = rows.filter((row) => !live.has(row.hash));

console.log(`erreichbare Segmente: ${live.size} (aus ${texts} Textstücken)`);
console.log(`Cache-Einträge älter als ${KARENZ_TAGE} Tage: ${rows.length}`);
console.log(`davon verwaist: ${orphans.length}`);

const directory = path.join(
  process.env.UPLOADS_DIR?.trim() ||
    path.join(process.cwd(), "public", "uploads"),
  "tts"
);

let bytes = 0;
for (const orphan of orphans) {
  const file = path.join(directory, `${orphan.hash}.mp3`);
  try {
    bytes += (await stat(file)).size;
  } catch {
    // Datei bereits weg – der Datenbankeintrag muss trotzdem verschwinden
  }
}
console.log(`Speicherplatz: ${(bytes / 1024 / 1024).toFixed(1)} MB`);

if (!apply) {
  console.log("\nTrockenlauf. Zum tatsächlichen Löschen: --apply");
  await db.$disconnect();
  process.exit(0);
}

for (const orphan of orphans) {
  await rm(path.join(directory, `${orphan.hash}.mp3`), { force: true });
}
await db.ttsSegment.deleteMany({
  where: { id: { in: orphans.map((o) => o.id) } },
});
console.log(`\n${orphans.length} verwaiste Segmente gelöscht.`);

// Hinweis, falls das Verzeichnis Dateien ohne Datenbankeintrag enthält
try {
  const files = await readdir(directory);
  const known = new Set(
    (await db.ttsSegment.findMany({ select: { hash: true } })).map((r) => r.hash)
  );
  const strays = files.filter(
    (name) => name.endsWith(".mp3") && !known.has(name.replace(/\.mp3$/, ""))
  );
  if (strays.length > 0) {
    console.log(
      `Hinweis: ${strays.length} MP3-Dateien ohne Datenbankeintrag in ${directory}`
    );
  }
} catch {
  // Verzeichnis existiert nicht – dann gibt es auch nichts zu melden
}

await db.$disconnect();
