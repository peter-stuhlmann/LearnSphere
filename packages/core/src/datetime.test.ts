import { describe, expect, it } from "vitest";
import {
  calendarCells,
  fromInputValue,
  isSameDay,
  toInputValue,
  withDay,
  withTime,
  wrapClock,
} from "./datetime";

describe("toInputValue", () => {
  it("formats a date as local datetime-local value", () => {
    expect(toInputValue(new Date(2026, 6, 8, 9, 5))).toBe("2026-07-08T09:05");
  });

  it("pads single-digit parts", () => {
    expect(toInputValue(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01T00:00");
  });
});

describe("fromInputValue", () => {
  it("parses a datetime-local value as local time", () => {
    const date = fromInputValue("2026-07-08T09:05");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(6);
    expect(date?.getDate()).toBe(8);
    expect(date?.getHours()).toBe(9);
    expect(date?.getMinutes()).toBe(5);
  });

  it("returns null for empty or invalid input", () => {
    expect(fromInputValue("")).toBeNull();
    expect(fromInputValue("nope")).toBeNull();
    expect(fromInputValue("2026-13-40T99:99")).toBeNull();
  });

  it("round-trips with toInputValue", () => {
    const value = "2026-02-28T23:59";
    expect(toInputValue(fromInputValue(value)!)).toBe(value);
  });
});

describe("calendarCells", () => {
  it("returns 42 cells covering the whole month", () => {
    const cells = calendarCells(2026, 6); // Juli 2026
    expect(cells).toHaveLength(42);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("starts the week on Monday", () => {
    // 1. Juli 2026 ist ein Mittwoch → davor Mo 29.6. + Di 30.6.
    const cells = calendarCells(2026, 6);
    expect(cells[0]).toMatchObject({ day: 29, monthIndex: 5, inMonth: false });
    expect(cells[1]).toMatchObject({ day: 30, monthIndex: 5, inMonth: false });
    expect(cells[2]).toMatchObject({ day: 1, monthIndex: 6, inMonth: true });
  });

  it("fills trailing days from the next month", () => {
    const cells = calendarCells(2026, 6);
    const last = cells[41];
    expect(last.inMonth).toBe(false);
    expect(last.monthIndex).toBe(7);
  });

  it("handles a month starting on Monday without leading fillers", () => {
    // Juni 2026 beginnt an einem Montag
    const cells = calendarCells(2026, 5);
    expect(cells[0]).toMatchObject({ day: 1, monthIndex: 5, inMonth: true });
  });

  it("handles year wrap for January and December", () => {
    const january = calendarCells(2026, 0);
    expect(january[0].year).toBe(2025); // Füller aus Dezember 2025
    const december = calendarCells(2026, 11);
    expect(december[41].year).toBe(2027); // Füller aus Januar 2027
  });
});

describe("withDay", () => {
  it("keeps the time when a day is picked", () => {
    expect(withDay("2026-07-08T09:05", 2026, 6, 20)).toBe("2026-07-20T09:05");
  });

  it("uses the fallback time when no value exists yet", () => {
    expect(withDay("", 2026, 6, 20, "12:00")).toBe("2026-07-20T12:00");
  });

  it("defaults the fallback time to 12:00", () => {
    expect(withDay("", 2026, 0, 3)).toBe("2026-01-03T12:00");
  });
});

describe("withTime", () => {
  it("keeps the day when the time changes", () => {
    expect(withTime("2026-07-08T09:05", "18:30")).toBe("2026-07-08T18:30");
  });

  it("uses the fallback date when no value exists yet", () => {
    const fallback = new Date(2026, 6, 8, 0, 0);
    expect(withTime("", "18:30", fallback)).toBe("2026-07-08T18:30");
  });

  it("ignores an invalid time", () => {
    expect(withTime("2026-07-08T09:05", "")).toBe("2026-07-08T09:05");
  });
});

describe("wrapClock", () => {
  it("keeps values inside the range", () => {
    expect(wrapClock(5, 24)).toBe(5);
    expect(wrapClock(0, 24)).toBe(0);
  });

  it("wraps forwards past the maximum", () => {
    expect(wrapClock(24, 24)).toBe(0);
    expect(wrapClock(61, 60)).toBe(1);
  });

  it("wraps backwards below zero", () => {
    expect(wrapClock(-1, 24)).toBe(23);
    expect(wrapClock(-5, 60)).toBe(55);
  });
});

describe("isSameDay", () => {
  it("compares only the calendar day", () => {
    expect(
      isSameDay(new Date(2026, 6, 8, 1, 0), new Date(2026, 6, 8, 23, 59))
    ).toBe(true);
    expect(
      isSameDay(new Date(2026, 6, 8), new Date(2026, 6, 9))
    ).toBe(false);
    expect(
      isSameDay(new Date(2026, 6, 8), new Date(2025, 6, 8))
    ).toBe(false);
  });
});
