"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled, { keyframes } from "styled-components";
import { toIsoDay } from "@/lib/usage-range";

/**
 * Zeitraum frei wählen – zwei Monate nebeneinander, Auswahl durch Klick auf
 * Beginn und Ende.
 *
 * Bewusst selbst gebaut statt Bibliothek: Ein fremder Datepicker bringt sein
 * eigenes Aussehen mit und lässt sich nur mit viel Gegen-CSS ins dunkle
 * Design zwingen. Hier sind es rund 200 Zeilen, dafür passt jede Farbe und
 * jeder Radius zum Rest der Oberfläche.
 *
 * Bedienung mit der Tastatur: Der Auslöser öffnet und schließt, Escape
 * schließt, jeder Tag ist ein eigener Knopf mit vorgelesener Beschriftung.
 */

const DAY_MS = 86_400_000;

const drop = keyframes`
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: none; }
`;

const Wrap = styled.div`
  position: relative;
`;

const Trigger = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.42rem 0.95rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.85rem;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.45)" : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : theme.colors.bgElevated};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};
  transition: color 140ms ease, border-color 140ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Popover = styled.div`
  position: absolute;
  z-index: 40;
  top: calc(100% + 0.5rem);
  left: 0;
  padding: 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  animation: ${drop} 160ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  /* Auf schmalen Displays darf das Feld nicht aus dem Bild ragen */
  @media (max-width: 560px) {
    left: 50%;
    transform: translateX(-50%);
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const NavButton = styled.button`
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.35;
    pointer-events: none;
  }
`;

const Months = styled.div`
  display: grid;
  gap: 1.25rem;

  @media (min-width: 560px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const MonthLabel = styled.p`
  text-align: center;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-bottom: 0.5rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 32px);
  gap: 2px;
`;

const WeekDay = styled.span`
  display: grid;
  place-items: center;
  height: 24px;
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Day = styled.button<{
  $selected: boolean;
  $inRange: boolean;
  $edge: "start" | "end" | "both" | null;
}>`
  height: 32px;
  font-size: 0.8rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme, $selected, $inRange }) =>
    $selected
      ? theme.colors.onAccent
      : $inRange
        ? theme.colors.text
        : theme.colors.textMuted};
  background: ${({ theme, $selected, $inRange }) =>
    $selected
      ? theme.colors.accent
      : $inRange
        ? theme.colors.accentSoft
        : "transparent"};
  /* Die Enden runden nach außen – dazwischen bleibt das Band durchgehend */
  border-radius: ${({ $edge }) =>
    $edge === "both"
      ? "8px"
      : $edge === "start"
        ? "8px 0 0 8px"
        : $edge === "end"
          ? "0 8px 8px 0"
          : "0"};

  &:hover:not(:disabled) {
    color: ${({ theme, $selected }) =>
      $selected ? theme.colors.onAccent : theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -2px;
  }

  &:disabled {
    opacity: 0.25;
    pointer-events: none;
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Apply = styled.button`
  padding: 0.4rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-size: 0.82rem;
  font-weight: 650;

  &:disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

/** Alle Tage eines Monats plus Auffüllung bis zum Wochenbeginn (Montag). */
function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  // getUTCDay: 0 = Sonntag → auf Montag als ersten Wochentag umrechnen
  const lead = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => new Date(Date.UTC(year, month, i + 1))),
  ];
}

export function DateRangePicker({
  from,
  to,
  active,
  maxDay,
  onApply,
}: {
  /** aktuell gewählter Beginn (ISO-Tag) */
  from: string;
  to: string;
  /** ist gerade ein frei gewählter Zeitraum aktiv? */
  active: boolean;
  /** spätester wählbarer Tag (ISO) – in der Zukunft gibt es keine Daten */
  maxDay: string;
  onApply: (range: { from: string; to: string }) => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(active ? from : null);
  const [end, setEnd] = useState<string | null>(active ? to : null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const max = useMemo(() => new Date(`${maxDay}T00:00:00.000Z`), [maxDay]);
  const [cursor, setCursor] = useState(() => {
    const base = new Date(`${to}T00:00:00.000Z`);
    // linker Monat ist der Vormonat des Endes – rechts steht der aktuelle
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1));
  });

  // Klick nach außen und Escape schließen das Feld
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const weekDays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    });
    // 2026-01-05 war ein Montag
    return Array.from({ length: 7 }, (_, i) =>
      formatter.format(new Date(Date.UTC(2026, 0, 5 + i)))
    );
  }, [locale]);

  const monthName = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

  const dayLabel = (date: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(
      date
    );

  /** Klick auf einen Tag: erst Beginn, dann Ende, dann wieder von vorn. */
  function pick(iso: string) {
    if (!start || (start && end)) {
      setStart(iso);
      setEnd(null);
      return;
    }
    if (iso < start) {
      setEnd(start);
      setStart(iso);
      return;
    }
    setEnd(iso);
  }

  const canApply = Boolean(start && end);
  const label =
    active && from && to
      ? `${formatShort(from, locale)} – ${formatShort(to, locale)}`
      : t("aiRangeCustom");

  const months = [0, 1].map((offset) => {
    const date = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + offset, 1)
    );
    return { date, cells: monthGrid(date.getUTCFullYear(), date.getUTCMonth()) };
  });

  // Vorschau beim Überfahren wäre Zierrat – das Band zeigt die Auswahl
  const rangeEnd = end ?? start;

  return (
    <Wrap ref={wrapRef}>
      <Trigger
        type="button"
        $active={active}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>🗓</span>
        {label}
      </Trigger>

      {open ? (
        <Popover role="dialog" aria-label={t("aiRangeCustom")}>
          <Head>
            <NavButton
              type="button"
              aria-label={t("aiRangePrevMonth")}
              onClick={() =>
                setCursor(
                  new Date(
                    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1)
                  )
                )
              }
            >
              ‹
            </NavButton>
            <span style={{ fontSize: "0.8rem" }}>
              {start ? formatShort(start, locale) : t("aiRangePickStart")}
              {start && end ? ` – ${formatShort(end, locale)}` : ""}
            </span>
            <NavButton
              type="button"
              aria-label={t("aiRangeNextMonth")}
              disabled={
                months[1].date.getUTCFullYear() === max.getUTCFullYear() &&
                months[1].date.getUTCMonth() >= max.getUTCMonth()
              }
              onClick={() =>
                setCursor(
                  new Date(
                    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
                  )
                )
              }
            >
              ›
            </NavButton>
          </Head>

          <Months>
            {months.map(({ date, cells }) => (
              <div key={date.toISOString()}>
                <MonthLabel>{monthName(date)}</MonthLabel>
                <Grid role="grid">
                  {weekDays.map((day) => (
                    <WeekDay key={day} aria-hidden>
                      {day}
                    </WeekDay>
                  ))}
                  {cells.map((cell, i) =>
                    cell === null ? (
                      <span key={`pad-${i}`} />
                    ) : (
                      <Day
                        key={cell.toISOString()}
                        type="button"
                        disabled={cell > max}
                        aria-label={dayLabel(cell)}
                        aria-pressed={
                          toIsoDay(cell) === start || toIsoDay(cell) === end
                        }
                        $selected={
                          toIsoDay(cell) === start || toIsoDay(cell) === end
                        }
                        $inRange={Boolean(
                          start &&
                            rangeEnd &&
                            toIsoDay(cell) > start &&
                            toIsoDay(cell) < rangeEnd
                        )}
                        $edge={edgeOf(toIsoDay(cell), start, end)}
                        onClick={() => pick(toIsoDay(cell))}
                      >
                        {cell.getUTCDate()}
                      </Day>
                    )
                  )}
                </Grid>
              </div>
            ))}
          </Months>

          <Footer>
            <span>
              {canApply
                ? t("aiRangeDays", {
                    count:
                      Math.round(
                        (new Date(`${end}T00:00:00Z`).getTime() -
                          new Date(`${start}T00:00:00Z`).getTime()) /
                          DAY_MS
                      ) + 1,
                  })
                : t("aiRangePickEnd")}
            </span>
            <Apply
              type="button"
              disabled={!canApply}
              onClick={() => {
                if (!start || !end) return;
                onApply({ from: start, to: end });
                setOpen(false);
              }}
            >
              {t("aiRangeApply")}
            </Apply>
          </Footer>
        </Popover>
      ) : null}
    </Wrap>
  );
}

/** Rundung der Bandenden: Anfang, Ende, beides (ein Tag) oder mittendrin. */
function edgeOf(
  iso: string,
  start: string | null,
  end: string | null
): "start" | "end" | "both" | null {
  if (!start) return null;
  if (iso === start && (iso === end || !end)) return "both";
  if (iso === start) return "start";
  if (iso === end) return "end";
  return null;
}

function formatShort(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}
