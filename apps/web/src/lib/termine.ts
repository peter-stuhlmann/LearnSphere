import { z } from "zod";

/**
 * Live-Termine via termine.lol: Creator verbinden ihren Kalender per
 * Connect-Flow ("Mit termine.lol verbinden", lib/termine-connect.ts) –
 * Kalender-ID + API-Key landen dabei serverseitig am Kurs. Kalender/Slots
 * laufen über unseren Proxy (der Key bleibt serverseitig), Reservieren/
 * Buchen geht direkt an die öffentliche Buchungs-API (kein Key nötig,
 * IP-Rate-Limit bleibt beim Lernenden statt bei unserem Server).
 */

/**
 * Basis-URL von termine.lol – per NEXT_PUBLIC_TERMINE_BASE_URL übersteuerbar
 * (z. B. lokale Instanz für End-zu-End-Tests). NEXT_PUBLIC, weil auch der
 * Client direkt bucht (Reserve/Submit).
 */
export const TERMINE_BASE_URL = (
  process.env.NEXT_PUBLIC_TERMINE_BASE_URL || "https://termine.lol"
).replace(/\/+$/, "");

/** Öffentliche Buchungs-Endpunkte (Client-direkt, ohne API-Key). */
export const TERMINE_RESERVE_URL = `${TERMINE_BASE_URL}/api/public/bookings/reserve`;
export const TERMINE_SUBMIT_URL = `${TERMINE_BASE_URL}/api/public/bookings/submit`;

/** Ein Tag hat 96 Viertelstunden-Slots (startSlot 0–95). */
export const SLOTS_PER_DAY = 96;

const appointmentTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  durationMin: z.number().int().positive(),
  mode: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  memberIds: z.array(z.string()).default([]),
});

const calendarSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  timezone: z.string().default("Europe/Berlin"),
  appointmentTypes: z.array(appointmentTypeSchema).default([]),
});

export type TermineAppointmentType = z.infer<typeof appointmentTypeSchema>;
export type TermineCalendar = z.infer<typeof calendarSchema>;

const slotSchema = z.object({
  slotIndex: z.number().int().min(0).max(SLOTS_PER_DAY - 1),
  time: z.string().min(1),
});

const slotsSchema = z.object({
  date: z.string(),
  availableSlots: z.array(slotSchema).default([]),
});

export type TermineSlot = z.infer<typeof slotSchema>;
export type TermineSlots = z.infer<typeof slotsSchema>;

const bookingFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.string().default("text"),
  required: z.boolean().default(false),
});

const reserveResultSchema = z.object({
  bookingId: z.string().min(1),
  reservationExpiresAt: z.string(),
  fields: z.array(bookingFieldSchema).default([]),
});

export type TermineBookingField = z.infer<typeof bookingFieldSchema>;
export type TermineReserveResult = z.infer<typeof reserveResultSchema>;

/** Antworten kommen teils als `{ data: … }`-Hülle – transparent auspacken. */
function unwrapData(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "data" in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

/** Kalender-Antwort → validiertes Objekt (null bei kaputter Antwort). */
export function parseCalendarResponse(raw: unknown): TermineCalendar | null {
  const parsed = calendarSchema.safeParse(unwrapData(raw));
  return parsed.success ? parsed.data : null;
}

/** Slots-Antwort → validiertes Objekt (null bei kaputter Antwort). */
export function parseSlotsResponse(raw: unknown): TermineSlots | null {
  const parsed = slotsSchema.safeParse(unwrapData(raw));
  return parsed.success ? parsed.data : null;
}

/** Reserve-Antwort → Buchungs-Hold inkl. dynamischer Formularfelder. */
export function parseReserveResponse(
  raw: unknown
): TermineReserveResult | null {
  const parsed = reserveResultSchema.safeParse(unwrapData(raw));
  return parsed.success ? parsed.data : null;
}

/** Fehlermeldung aus einer termine.lol-Fehlerantwort (`{ error }`). */
export function extractTermineError(raw: unknown): string | null {
  if (raw && typeof raw === "object") {
    const { error } = raw as { error?: unknown };
    if (typeof error === "string" && error.trim()) return error.trim();
  }
  return null;
}

/**
 * Buchung nur anbieten, wenn der Creator "Termine anbieten" aktiviert hat
 * UND die termine.lol-Verbindung (Connect-Flow) besteht.
 */
export function isBookingConfigured(course: {
  bookingEnabled: boolean;
  bookingCalendarId: string | null;
  bookingApiKey: string | null;
}): boolean {
  return Boolean(
    course.bookingEnabled &&
      course.bookingCalendarId?.trim() &&
      course.bookingApiKey?.trim()
  );
}

/** Striktes Buchungsdatum: YYYY-MM-DD und ein realer Kalendertag. */
export function isValidBookingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** startSlot (0–95, Viertelstunden-Raster) → "HH:MM". */
export function slotIndexToTime(slotIndex: number): string {
  const clamped = Math.min(SLOTS_PER_DAY - 1, Math.max(0, Math.trunc(slotIndex)));
  const hours = Math.floor(clamped / 4);
  const minutes = (clamped % 4) * 15;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Upstream-Pfad für die Kalender-Konfiguration (Embed-API, mit x-api-key). */
export function buildCalendarUrl(calendarId: string): string {
  return `${TERMINE_BASE_URL}/api/embed/calendars/${encodeURIComponent(calendarId)}`;
}

/** Upstream-Pfad für freie Slots eines Tages und einer Terminart. */
export function buildSlotsUrl(
  calendarId: string,
  date: string,
  appointmentTypeId: string
): string {
  const params = new URLSearchParams({
    date,
    appointmentTypeId,
  });
  return `${buildCalendarUrl(calendarId)}/slots?${params.toString()}`;
}

/**
 * Pflichtfelder des dynamischen Buchungsformulars, die noch leer sind –
 * Basis für die Client-Validierung vor dem Submit.
 */
export function missingRequiredFields(
  fields: TermineBookingField[],
  data: Record<string, string>
): string[] {
  return fields
    .filter((field) => field.required && !data[field.key]?.trim())
    .map((field) => field.key);
}
