import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/**
 * OAuth-Handoff: OAuth läuft immer auf der Hauptdomain (dort ist die
 * redirect_uri registriert). Danach wird per kurzlebigem Einmal-Token eine
 * host-only Session auf dem Whitelabel-Mandanten-Host etabliert – ohne die
 * Mandanten-Isolation aufzuweichen.
 */

const TTL_MS = 2 * 60 * 1000; // 2 Minuten

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Einmal-Token für (userId → host) erzeugen; nur der Hash wird gespeichert. */
export async function mintOAuthHandoff(
  userId: string,
  host: string
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.oAuthHandoff.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      host: host.toLowerCase(),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return token;
}

/**
 * Token einlösen: prüft Existenz, Ablauf, Host-Bindung und markiert es atomar
 * als verbraucht (Replay-Schutz). Liefert den User oder null.
 */
export async function consumeOAuthHandoff(
  token: string,
  host: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!token) return null;
  const rec = await db.oAuthHandoff.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!rec || rec.usedAt) return null;
  if (rec.expiresAt.getTime() < Date.now()) return null;
  if (rec.host !== host.toLowerCase()) return null;

  // Atomar als verbraucht markieren – nur der erste Einlöser gewinnt.
  const claimed = await db.oAuthHandoff.updateMany({
    where: { id: rec.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  return db.user.findUnique({
    where: { id: rec.userId },
    select: { id: true, email: true, name: true },
  });
}
