import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimitMemory,
  fixedWindowKey,
  resetRateLimits,
} from "./rate-limit-core";

const NOW = 1_700_000_000_000;

describe("checkRateLimitMemory", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests below the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(
        checkRateLimitMemory("login:a@b.de", {
          limit: 5,
          windowMs: 60_000,
          now: NOW + i,
        })
      ).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimitMemory("login:a@b.de", {
        limit: 5,
        windowMs: 60_000,
        now: NOW,
      });
    }
    expect(
      checkRateLimitMemory("login:a@b.de", {
        limit: 5,
        windowMs: 60_000,
        now: NOW + 1,
      })
    ).toBe(false);
  });

  it("frees the window after windowMs", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimitMemory("login:a@b.de", {
        limit: 5,
        windowMs: 60_000,
        now: NOW,
      });
    }
    expect(
      checkRateLimitMemory("login:a@b.de", {
        limit: 5,
        windowMs: 60_000,
        now: NOW + 60_001,
      })
    ).toBe(true);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimitMemory("login:a@b.de", {
        limit: 5,
        windowMs: 60_000,
        now: NOW,
      });
    }
    expect(
      checkRateLimitMemory("login:c@d.de", {
        limit: 5,
        windowMs: 60_000,
        now: NOW,
      })
    ).toBe(true);
  });

  it("uses a sliding window (old hits fall out one by one)", () => {
    checkRateLimitMemory("k", { limit: 2, windowMs: 1000, now: NOW });
    checkRateLimitMemory("k", { limit: 2, windowMs: 1000, now: NOW + 900 });
    // Fenster voll
    expect(
      checkRateLimitMemory("k", { limit: 2, windowMs: 1000, now: NOW + 950 })
    ).toBe(false);
    // erster Hit fällt raus
    expect(
      checkRateLimitMemory("k", { limit: 2, windowMs: 1000, now: NOW + 1001 })
    ).toBe(true);
  });

  it("defaults auf die aktuelle Zeit", () => {
    expect(checkRateLimitMemory("now-key", { limit: 1, windowMs: 1000 })).toBe(
      true
    );
    expect(checkRateLimitMemory("now-key", { limit: 1, windowMs: 1000 })).toBe(
      false
    );
  });
});

describe("fixedWindowKey", () => {
  // am Fensterraster ausgerichteter Startzeitpunkt
  const WINDOW_START = Math.floor(NOW / 60_000) * 60_000;

  it("bildet pro Zeitfenster denselben Schlüssel", () => {
    expect(fixedWindowKey("login:a", 60_000, WINDOW_START)).toBe(
      fixedWindowKey("login:a", 60_000, WINDOW_START + 59_999)
    );
  });

  it("wechselt den Schlüssel im nächsten Fenster", () => {
    const bucket = WINDOW_START / 60_000;
    expect(fixedWindowKey("login:a", 60_000, WINDOW_START)).toBe(
      `rl:login:a:${bucket}`
    );
    expect(fixedWindowKey("login:a", 60_000, WINDOW_START + 60_000)).toBe(
      `rl:login:a:${bucket + 1}`
    );
  });
});
