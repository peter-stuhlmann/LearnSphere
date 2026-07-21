import { afterEach, describe, expect, it } from "vitest";
import { getEnv, parseEnv, resetEnvCache } from "./env";

const BASE = {
  NODE_ENV: "test",
  DATABASE_URL: "mysql://user:pass@localhost:3306/db",
};

afterEach(() => resetEnvCache());

describe("parseEnv", () => {
  it("akzeptiert eine minimale gültige Konfiguration", () => {
    const env = parseEnv(BASE);
    expect(env.DATABASE_URL).toBe(BASE.DATABASE_URL);
    expect(env.NODE_ENV).toBe("test");
    // Default-Basis-URL ohne trailing slash
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("entfernt den trailing Slash der Basis-URL", () => {
    const env = parseEnv({
      ...BASE,
      NEXT_PUBLIC_APP_URL: "https://learnsphere.one/",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://learnsphere.one");
  });

  it("listet fehlende Pflicht-Variablen lesbar auf", () => {
    expect(() => parseEnv({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it("verlangt AUTH_SECRET in Produktion", () => {
    expect(() =>
      parseEnv({ ...BASE, NODE_ENV: "production" })
    ).toThrow(/AUTH_SECRET/);
    expect(
      parseEnv({
        ...BASE,
        NODE_ENV: "production",
        AUTH_SECRET: "x".repeat(32),
      }).AUTH_SECRET
    ).toBe("x".repeat(32));
  });

  it("lehnt ungültige URLs ab", () => {
    expect(() =>
      parseEnv({ ...BASE, NEXT_PUBLIC_APP_URL: "kein-url" })
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() =>
      parseEnv({ ...BASE, UPSTASH_REDIS_REST_URL: "kein-url" })
    ).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("defaultet NODE_ENV auf development", () => {
    expect(parseEnv({ DATABASE_URL: "mysql://x" }).NODE_ENV).toBe(
      "development"
    );
  });
});

describe("getEnv", () => {
  it("liest process.env und cached das Ergebnis", () => {
    const before = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
    try {
      const first = getEnv();
      expect(first.DATABASE_URL).toContain("mysql://");
      expect(getEnv()).toBe(first);
    } finally {
      if (before === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = before;
    }
  });
});
