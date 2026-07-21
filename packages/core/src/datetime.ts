/**
 * Helfer für den DateTimePicker: alle Werte im lokalen
 * datetime-local-Format "YYYY-MM-DDTHH:mm" (leer = kein Datum).
 */

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function fromInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const date = new Date(y, m - 1, d, h, min);
  // JS "repariert" Überläufe (32.13. → Februar) – das werten wir als ungültig
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== min
  ) {
    return null;
  }
  return date;
}

export interface CalendarCell {
  day: number;
  monthIndex: number;
  year: number;
  inMonth: boolean;
}

/** 6 Wochen à 7 Tage (Montag als Wochenstart) rund um den Monat. */
export function calendarCells(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1);
  // getDay(): So=0 … Sa=6 → Offset bis zum Montag davor
  const lead = (first.getDay() + 6) % 7;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, monthIndex, 1 - lead + i);
    cells.push({
      day: date.getDate(),
      monthIndex: date.getMonth(),
      year: date.getFullYear(),
      inMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
    });
  }
  return cells;
}

/** Gewählten Tag übernehmen, Uhrzeit (falls vorhanden) beibehalten. */
export function withDay(
  value: string,
  year: number,
  monthIndex: number,
  day: number,
  fallbackTime = "12:00"
): string {
  const current = fromInputValue(value);
  const time = current
    ? `${pad2(current.getHours())}:${pad2(current.getMinutes())}`
    : fallbackTime;
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}T${time}`;
}

/** Uhrzeit ändern, Tag beibehalten (bzw. Fallback-Datum nutzen). */
export function withTime(
  value: string,
  time: string,
  fallbackDate: Date = new Date()
): string {
  if (!/^\d{2}:\d{2}$/.test(time)) return value;
  const current = fromInputValue(value) ?? fallbackDate;
  return `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(
    current.getDate()
  )}T${time}`;
}

/** Uhr-Arithmetik: hält Stunden/Minuten im Bereich [0, size) mit Überlauf. */
export function wrapClock(n: number, size: number): number {
  return ((n % size) + size) % size;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
