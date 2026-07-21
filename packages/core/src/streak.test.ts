import { describe, expect, it } from "vitest";
import {
  computeStreak,
  shiftDay,
  utcDayString,
  weekActivity,
} from "./streak";

describe("utcDayString", () => {
  it("formats the UTC calendar day", () => {
    expect(utcDayString(new Date("2026-07-18T23:59:59Z"))).toBe("2026-07-18");
    expect(utcDayString(new Date("2026-07-18T00:00:00Z"))).toBe("2026-07-18");
  });
});

describe("shiftDay", () => {
  it("moves across month and year boundaries", () => {
    expect(shiftDay("2026-07-18", -1)).toBe("2026-07-17");
    expect(shiftDay("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-07-18", 2)).toBe("2026-07-20");
  });
});

describe("computeStreak", () => {
  it("is 0 without recent activity", () => {
    expect(computeStreak([], "2026-07-18")).toBe(0);
    expect(computeStreak(["2026-07-10"], "2026-07-18")).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(
      computeStreak(["2026-07-16", "2026-07-17", "2026-07-18"], "2026-07-18")
    ).toBe(3);
  });

  it("keeps the streak alive when today has no activity yet", () => {
    expect(
      computeStreak(["2026-07-16", "2026-07-17"], "2026-07-18")
    ).toBe(2);
  });

  it("breaks on a gap", () => {
    expect(
      computeStreak(["2026-07-14", "2026-07-16", "2026-07-18"], "2026-07-18")
    ).toBe(1);
  });

  it("ignores duplicate and unordered days", () => {
    expect(
      computeStreak(
        ["2026-07-18", "2026-07-17", "2026-07-17", "2026-07-16"],
        "2026-07-18"
      )
    ).toBe(3);
  });
});

describe("weekActivity", () => {
  it("returns the last 7 days, oldest first", () => {
    const week = weekActivity(["2026-07-18", "2026-07-15"], "2026-07-18");
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ day: "2026-07-12", active: false });
    expect(week[3]).toEqual({ day: "2026-07-15", active: true });
    expect(week[6]).toEqual({ day: "2026-07-18", active: true });
  });
});
