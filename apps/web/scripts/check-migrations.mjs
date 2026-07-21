/**
 * Prüft, ob die Migrationshistorie das Prisma-Schema vollständig abbildet.
 *
 * Hintergrund: Lokal wird mit "prisma db push" gearbeitet (die Entwicklungs-
 * DB hat Drift, "migrate dev" würde sie zurücksetzen). Dabei können
 * Schema-Änderungen entstehen, für die niemand eine Migration schreibt –
 * lokal fällt das nie auf, aber eine frische Produktions-Datenbank bekommt
 * die Tabelle bzw. Spalte dann nie und die App scheitert zur Laufzeit.
 *
 * Das Skript vergleicht rein textuell: Welche Tabellen und Spalten erwartet
 * das Schema, und welche erzeugen die Migrationen? Es braucht keine
 * Datenbank und läuft deshalb auch in der CI.
 *
 * Aufruf:  node scripts/check-migrations.mjs
 * Exit 1, wenn etwas fehlt.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const PRISMA_DIR = path.join(process.cwd(), "prisma");
const schema = readFileSync(path.join(PRISMA_DIR, "schema.prisma"), "utf8");

/* ---------- Erwartung aus dem Schema ---------- */
const modelBlocks = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
const modelNames = new Set(modelBlocks.map((m) => m[1]));

/** @type {Map<string, string[]>} Modell → erwartete Spalten */
const expected = new Map();
for (const [, name, body] of modelBlocks) {
  const columns = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s{2}(\w+)\s+(\w+)(\[\])?/);
    if (!m) continue;
    const [, field, type, isList] = m;
    // Relationsfelder und Listen bilden keine eigene Spalte
    if (modelNames.has(type) || isList) continue;
    columns.push(field);
  }
  expected.set(name, columns);
}

/* ---------- Wirklichkeit aus den Migrationen ---------- */
/** @type {Map<string, Set<string>>} Tabelle (klein) → Spalten */
const built = new Map();
const ensure = (table) => {
  const key = table.toLowerCase();
  if (!built.has(key)) built.set(key, new Set());
  return built.get(key);
};

const dirs = readdirSync(path.join(PRISMA_DIR, "migrations")).sort();
for (const dir of dirs) {
  const file = path.join(PRISMA_DIR, "migrations", dir, "migration.sql");
  if (!existsSync(file)) continue;
  const sql = readFileSync(file, "utf8");

  // CREATE TABLE `X` ( ... ) – Spalten sind die Zeilen mit `spalte` TYP
  for (const m of sql.matchAll(
    /CREATE TABLE\s+`(\w+)`\s*\(([\s\S]*?)\)\s*(?:DEFAULT|ENGINE|;)/gi
  )) {
    const cols = ensure(m[1]);
    for (const line of m[2].split(/\r?\n/)) {
      const c = line.match(/^\s*`(\w+)`\s+[A-Za-z]/);
      if (c) cols.add(c[1]);
    }
  }

  // ALTER TABLE `X` ADD COLUMN `y` … , ADD COLUMN `z` …
  for (const m of sql.matchAll(
    /ALTER TABLE\s+`(\w+)`([\s\S]*?);/gi
  )) {
    const cols = ensure(m[1]);
    for (const c of m[2].matchAll(/ADD COLUMN\s+`(\w+)`/gi)) cols.add(c[1]);
    for (const c of m[2].matchAll(/DROP COLUMN\s+`(\w+)`/gi)) cols.delete(c[1]);
    // RENAME COLUMN `alt` TO `neu`
    for (const c of m[2].matchAll(
      /RENAME COLUMN\s+`(\w+)`\s+TO\s+`(\w+)`/gi
    )) {
      cols.delete(c[1]);
      cols.add(c[2]);
    }
  }

  for (const m of sql.matchAll(/DROP TABLE\s+(?:IF EXISTS\s+)?`(\w+)`/gi)) {
    built.delete(m[1].toLowerCase());
  }

  // ALTER TABLE `alt` RENAME TO `neu`
  for (const m of sql.matchAll(
    /ALTER TABLE\s+`(\w+)`\s+RENAME TO\s+`(\w+)`/gi
  )) {
    const from = m[1].toLowerCase();
    if (built.has(from)) {
      built.set(m[2].toLowerCase(), built.get(from));
      built.delete(from);
    }
  }
}

/* ---------- Vergleich ---------- */
const problems = [];
for (const [model, columns] of expected) {
  const have = built.get(model.toLowerCase());
  if (!have) {
    problems.push(`Tabelle fehlt in den Migrationen: ${model}`);
    continue;
  }
  for (const column of columns) {
    if (!have.has(column)) problems.push(`Spalte fehlt: ${model}.${column}`);
  }
}

/* Schreibweise: MySQL unter Linux ist case-sensitiv – Migrationen müssen
   die Tabellen exakt so ansprechen wie das Schema sie anlegt. */
const byLower = new Map([...modelNames].map((m) => [m.toLowerCase(), m]));
for (const dir of dirs) {
  const file = path.join(PRISMA_DIR, "migrations", dir, "migration.sql");
  if (!existsSync(file)) continue;
  const sql = readFileSync(file, "utf8");
  for (const m of sql.matchAll(
    /(?:ALTER TABLE|CREATE TABLE|REFERENCES|DROP TABLE)\s+`(\w+)`/gi
  )) {
    const real = byLower.get(m[1].toLowerCase());
    if (real && real !== m[1]) {
      problems.push(
        `Falsche Schreibweise in ${dir}: \`${m[1]}\` sollte \`${real}\` sein`
      );
    }
  }
}

if (problems.length > 0) {
  console.error("Migrationen bilden das Schema NICHT vollständig ab:\n");
  for (const p of [...new Set(problems)]) console.error("  - " + p);
  console.error(
    "\nEine frische Produktions-Datenbank bekäme diese Struktur nicht.\n" +
      "Migration nachtragen (von Hand unter prisma/migrations/<zeitstempel>_<name>/migration.sql)."
  );
  process.exit(1);
}

console.log(
  `✓ Migrationen decken alle ${expected.size} Modelle vollständig ab (${dirs.length} Migrationen geprüft)`
);
