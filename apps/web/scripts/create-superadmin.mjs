/**
 * Legt den Superadmin-Account an (oder hebt einen bestehenden Account auf
 * die ADMIN-Rolle). Aufruf:
 *
 *   node scripts/create-superadmin.mjs <email> <passwort>
 *
 * Ohne Argumente werden SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD aus der .env
 * gelesen. Der Admin-Bereich liegt unter /de/admin bzw. /en/admin.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

// .env laden (DATABASE_URL + optionale Zugangsdaten). Im Docker-Container
// gibt es keine .env-Datei – dort kommt alles aus echten Umgebungsvariablen,
// eine fehlende Datei ist deshalb kein Fehler.
const envPath = path.join(process.cwd(), ".env");
let env = "";
try {
  env = readFileSync(envPath, "utf8");
} catch {
  env = "";
}
const readVar = (name) =>
  env.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"))?.[1]?.trim();
process.env.DATABASE_URL = process.env.DATABASE_URL ?? readVar("DATABASE_URL");

const email =
  process.argv[2] ?? process.env.SUPERADMIN_EMAIL ?? readVar("SUPERADMIN_EMAIL");
const password =
  process.argv[3] ??
  process.env.SUPERADMIN_PASSWORD ??
  readVar("SUPERADMIN_PASSWORD");
if (!email || !password) {
  console.error(
    "Nutzung: node scripts/create-superadmin.mjs <email> <passwort>"
  );
  process.exit(1);
}

const db = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);

const user = await db.user.upsert({
  where: { email },
  create: {
    email,
    name: "Superadmin",
    passwordHash,
    role: "ADMIN",
    emailVerified: new Date(),
  },
  update: { role: "ADMIN", passwordHash },
});

console.log(`Superadmin bereit: ${user.email} (Rolle ${user.role})`);
console.log("Admin-Bereich: /de/admin");
await db.$disconnect();
