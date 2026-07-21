import { describe, expect, it } from "vitest";
import { makeSerial } from "./serial";

describe("makeSerial", () => {
  it("matches the LS-XXXX-XXXX-XXXX format", () => {
    expect(makeSerial()).toMatch(/^LS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("avoids ambiguous characters (0, O, 1, I)", () => {
    for (let i = 0; i < 50; i++) {
      expect(makeSerial()).not.toMatch(/[01OI]/);
    }
  });

  it("is unique across invocations", () => {
    const serials = new Set(Array.from({ length: 100 }, () => makeSerial()));
    expect(serials.size).toBe(100);
  });
});
