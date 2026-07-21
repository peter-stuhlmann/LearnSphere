/**
 * Gesetzliche Aufbewahrung (§ 147 AO / § 257 HGB): Belegdaten gelöschter
 * Konten wandern ins SalesArchive und dürfen erst nach Fristablauf entsorgt
 * werden. Die Frist läuft ab dem ENDE des Kalenderjahres, in dem der
 * Geschäftsvorfall lag; wir rechnen einheitlich mit 10 Jahren (sichere
 * Obergrenze – für reine Belege gälten seit BEG IV auch 8).
 */

export const RETENTION_YEARS = 10;

/** Frühester Zeitpunkt, zu dem ein Beleg gelöscht werden darf. */
export function retentionPurgeDate(
  occurredAt: Date,
  years: number = RETENTION_YEARS
): Date {
  // Jahresende des Vorfalls + Frist (UTC, Mitternacht nach dem 31.12.)
  return new Date(Date.UTC(occurredAt.getUTCFullYear() + years + 1, 0, 1));
}

/** Platzhaltername anonymisierter Creator (Katalog, Kursseiten, Zertifikate). */
export const ANONYMIZED_CREATOR_NAME = "Gelöschter Creator";

/** Nicht zustellbare, eindeutige Tombstone-Adresse fürs anonymisierte Konto. */
export function anonymizedEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`;
}
