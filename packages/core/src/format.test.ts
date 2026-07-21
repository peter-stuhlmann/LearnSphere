import { describe, expect, it } from "vitest";
import { formatDuration, formatMoney, formatPrice } from "./format";

describe("formatPrice", () => {
  it("formats free courses as a label", () => {
    expect(formatPrice(0, "EUR", "de")).toBe("Kostenlos");
    expect(formatPrice(0, "EUR", "en")).toBe("Free");
  });

  it("formats euro cents in German notation", () => {
    expect(formatPrice(4999, "EUR", "de")).toMatch(/49,99/);
  });

  it("formats euro cents in English notation", () => {
    expect(formatPrice(4999, "EUR", "en")).toMatch(/49\.99/);
  });

  it("falls back to the English label for unknown locales", () => {
    expect(formatPrice(0, "EUR", "fr")).toBe("Free");
  });
});

describe("formatMoney", () => {
  it("formats zero as a real amount, not a label", () => {
    expect(formatMoney(0, "EUR", "de")).toMatch(/0,00/);
    expect(formatMoney(0, "EUR", "en")).toMatch(/0\.00/);
  });

  it("formats cents like formatPrice for non-zero amounts", () => {
    expect(formatMoney(4999, "EUR", "de")).toBe(formatPrice(4999, "EUR", "de"));
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(303)).toBe("5:03");
  });

  it("formats hours when needed", () => {
    expect(formatDuration(3903)).toBe("1:05:03");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("clamps negative input to zero", () => {
    expect(formatDuration(-10)).toBe("0:00");
  });
});
