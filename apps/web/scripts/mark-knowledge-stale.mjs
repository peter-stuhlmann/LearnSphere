/**
 * Kurs-Memory des Lernassistenten zur Neuindexierung vormerken.
 *
 * Nötig, wenn sich die Indexierungsregeln geändert haben (nicht der
 * Kursinhalt) – etwa als HTML-Blöcke neu aufgenommen wurden. Der Lazy-
 * Reindex läuft dann bei der nächsten Assistenten-Frage je Kurs und bettet
 * dank Hash-Diff nur die tatsächlich neuen Chunks ein; alles Bestehende
 * bleibt unangetastet, es entstehen also keine Kosten für bereits
 * indexierte Inhalte.
 *
 * Aufruf:  node --env-file=.env scripts/mark-knowledge-stale.mjs
 *          node --env-file=.env scripts/mark-knowledge-stale.mjs <courseId>
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const courseId = process.argv[2] ?? null;

const courses = await db.course.findMany({
  where: courseId ? { id: courseId } : {},
  select: { id: true, title: true },
});

if (courses.length === 0) {
  console.error(
    courseId ? `Kurs ${courseId} nicht gefunden.` : "Keine Kurse gefunden."
  );
  process.exit(1);
}

const now = new Date();
for (const course of courses) {
  await db.knowledgeIndexState.upsert({
    where: { courseId: course.id },
    create: { courseId: course.id, staleAt: now },
    update: { staleAt: now },
  });
  console.log(`vorgemerkt: ${course.title}`);
}

console.log(
  `\n${courses.length} Kurs(e) vorgemerkt. Die Neuindexierung läuft je Kurs ` +
    `bei der nächsten Frage an den Lernassistenten.`
);

await db.$disconnect();
