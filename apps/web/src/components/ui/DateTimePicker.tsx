"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import {
  calendarCells,
  fromInputValue,
  isSameDay,
  toInputValue,
  withDay,
  withTime,
  wrapClock,
} from "@elearning/core/datetime";

const Root = styled.div`
  position: relative;
`;

const LabelText = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  display: block;
  margin-bottom: 0.4rem;
`;

const Segment = styled.div`
  display: flex;
  padding: 0.25rem;
  gap: 0.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.bgElevated};
`;

const SegButton = styled.button<{ $active: boolean }>`
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 160ms ease, color 160ms ease;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onAccent : theme.colors.textMuted};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover {
    color: ${({ theme, $active }) =>
      $active ? theme.colors.onAccent : theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const Popover = styled(motion.div)`
  position: absolute;
  z-index: 30;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  max-width: 340px;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const MonthRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const MonthLabel = styled.span`
  font-weight: 600;
  font-size: 0.95rem;
  text-transform: capitalize;
`;

const NavButton = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
  transition: border-color 160ms ease, color 160ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const WeekHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 0.25rem;

  span {
    text-align: center;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${({ theme }) => theme.colors.textFaint};
    padding: 0.25rem 0;
  }
`;

const DayGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
`;

const DayButton = styled.button<{
  $inMonth: boolean;
  $selected: boolean;
  $today: boolean;
}>`
  aspect-ratio: 1;
  border-radius: 50%;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $inMonth, $selected }) =>
    $selected
      ? theme.colors.onAccent
      : $inMonth
        ? theme.colors.text
        : theme.colors.textFaint};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accent : "transparent"};
  font-weight: ${({ $selected }) => ($selected ? 700 : 400)};
  box-shadow: ${({ theme, $today, $selected }) =>
    $today && !$selected ? `inset 0 0 0 1px ${theme.colors.violet}` : "none"};
  transition: background 140ms ease, color 140ms ease;

  &:hover {
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.accent : theme.colors.surfaceHover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const TimeGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const TimeColon = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 1.15rem;
  color: ${({ theme }) => theme.colors.textFaint};
  padding-bottom: 0.1rem;
`;

const StepperWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StepButton = styled.button`
  width: 30px;
  height: 20px;
  border-radius: ${({ theme }) => theme.radii.sm};
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 0.6rem;
  line-height: 1;
  transition: color 140ms ease, background 140ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

const StepValue = styled.div`
  min-width: 44px;
  padding: 0.2rem 0.4rem;
  text-align: center;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.text};
  cursor: ns-resize;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

interface TimeStepperProps {
  value: number;
  size: number;
  step: number;
  label: string;
  onChange: (next: number) => void;
}

/** Spinbutton mit Pfeil-Buttons: ▲/▼, Pfeiltasten und Zifferneingabe. */
function TimeStepper({ value, size, step, label, onChange }: TimeStepperProps) {
  function nudge(delta: number) {
    onChange(wrapClock(value + delta, size));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudge(step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudge(-step);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(size - step);
    } else if (/^\d$/.test(event.key)) {
      event.preventDefault();
      // klassische Uhr-Eingabe: letzte Ziffer nachschieben, sonst neu beginnen
      const shifted = (value % 10) * 10 + Number(event.key);
      onChange(shifted < size ? shifted : Number(event.key));
    }
  }

  return (
    <StepperWrap>
      <StepButton
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => nudge(step)}
      >
        ▲
      </StepButton>
      <StepValue
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={size - 1}
        aria-valuenow={value}
        aria-valuetext={value.toString().padStart(2, "0")}
        onKeyDown={onKeyDown}
        onWheel={(e) => nudge(e.deltaY < 0 ? step : -step)}
      >
        {value.toString().padStart(2, "0")}
      </StepValue>
      <StepButton
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => nudge(-step)}
      >
        ▼
      </StepButton>
    </StepperWrap>
  );
}

const SmallButton = styled.button`
  padding: 0.45rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: border-color 160ms ease, color 160ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const DoneButton = styled(SmallButton)`
  margin-left: auto;
  border-color: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`;

export interface DateTimePickerProps {
  label: string;
  /** datetime-local-Wert ("YYYY-MM-DDTHH:mm") oder "" für den Leer-Modus. */
  value: string;
  onChange: (value: string) => void;
  /** Bedeutung des Leer-Modus, z. B. „Sofort" oder „Unbegrenzt". */
  emptyLabel: string;
}

export function DateTimePicker({
  label,
  value,
  onChange,
  emptyLabel,
}: DateTimePickerProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const labelId = useId();
  const [open, setOpen] = useState(false);

  const selected = fromInputValue(value);
  const [view, setView] = useState(() => {
    const base = selected ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale]
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "full" }),
    [locale]
  );
  const displayFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  );
  const weekdays = useMemo(() => {
    // 5.1.2026 ist ein Montag → 7 Tage ab dort für Mo–So-Kürzel
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2026, 0, 5 + i))
    );
  }, [locale]);

  const cells = calendarCells(view.year, view.month);
  const today = new Date();
  const timeValue = value ? value.slice(11, 16) : "12:00";

  // Popover bei Klick außerhalb schließen
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openPicker() {
    const base = fromInputValue(value) ?? new Date();
    setView({ year: base.getFullYear(), month: base.getMonth() });
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function onGridKeyDown(event: KeyboardEvent, index: number) {
    const jumps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const jump = jumps[event.key];
    if (jump === undefined) return;
    event.preventDefault();
    const next = index + jump;
    if (next < 0) {
      shiftMonth(-1);
    } else if (next >= 42) {
      shiftMonth(1);
    } else {
      dayRefs.current[next]?.focus();
    }
  }

  return (
    <Root
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <LabelText id={labelId}>{label}</LabelText>
      <Segment role="group" aria-labelledby={labelId}>
        <SegButton
          type="button"
          $active={!value}
          aria-pressed={!value}
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          {emptyLabel}
        </SegButton>
        <SegButton
          ref={triggerRef}
          type="button"
          $active={!!value}
          aria-pressed={!!value}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => (open ? close() : openPicker())}
        >
          {selected ? displayFormat.format(selected) : t("pickDateTime")}
        </SegButton>
      </Segment>

      <AnimatePresence>
        {open ? (
          <Popover
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <MonthRow>
              <NavButton
                type="button"
                aria-label={t("prevMonth")}
                onClick={() => shiftMonth(-1)}
              >
                ←
              </NavButton>
              <MonthLabel aria-live="polite">
                {monthFormat.format(new Date(view.year, view.month, 1))}
              </MonthLabel>
              <NavButton
                type="button"
                aria-label={t("nextMonth")}
                onClick={() => shiftMonth(1)}
              >
                →
              </NavButton>
            </MonthRow>

            <WeekHeader aria-hidden="true">
              {weekdays.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </WeekHeader>

            <DayGrid>
              {cells.map((cell, i) => {
                const cellDate = new Date(cell.year, cell.monthIndex, cell.day);
                const isSelected = selected
                  ? isSameDay(cellDate, selected)
                  : false;
                return (
                  <DayButton
                    key={`${cell.year}-${cell.monthIndex}-${cell.day}`}
                    ref={(el) => {
                      dayRefs.current[i] = el;
                    }}
                    type="button"
                    tabIndex={
                      isSelected || (!selected && cell.inMonth && cell.day === 1)
                        ? 0
                        : -1
                    }
                    $inMonth={cell.inMonth}
                    $selected={isSelected}
                    $today={isSameDay(cellDate, today)}
                    aria-label={dayFormat.format(cellDate)}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => onGridKeyDown(e, i)}
                    onClick={() =>
                      onChange(
                        withDay(value, cell.year, cell.monthIndex, cell.day)
                      )
                    }
                  >
                    {cell.day}
                  </DayButton>
                );
              })}
            </DayGrid>

            <FooterRow>
              <TimeGroup role="group" aria-label={t("time")}>
                <TimeStepper
                  value={Number(timeValue.slice(0, 2))}
                  size={24}
                  step={1}
                  label={t("hours")}
                  onChange={(h) =>
                    onChange(
                      withTime(
                        value,
                        `${h.toString().padStart(2, "0")}:${timeValue.slice(3, 5)}`
                      )
                    )
                  }
                />
                <TimeColon aria-hidden="true">:</TimeColon>
                <TimeStepper
                  value={Number(timeValue.slice(3, 5))}
                  size={60}
                  step={5}
                  label={t("minutes")}
                  onChange={(m) =>
                    onChange(
                      withTime(
                        value,
                        `${timeValue.slice(0, 2)}:${m.toString().padStart(2, "0")}`
                      )
                    )
                  }
                />
              </TimeGroup>
              <SmallButton
                type="button"
                onClick={() => onChange(toInputValue(new Date()))}
              >
                {t("now")}
              </SmallButton>
              <DoneButton type="button" onClick={() => close()}>
                {t("done")}
              </DoneButton>
            </FooterRow>
          </Popover>
        ) : null}
      </AnimatePresence>
    </Root>
  );
}
