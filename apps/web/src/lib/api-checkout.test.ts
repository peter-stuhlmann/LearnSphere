import { describe, expect, it } from "vitest";
import {
  TtlCache,
  apiCheckoutSchema,
  isValidReturnUrl,
  withSessionPlaceholder,
} from "./api-checkout";

describe("isValidReturnUrl", () => {
  it("akzeptiert absolute https-URLs", () => {
    expect(isValidReturnUrl("https://example.com/danke")).toBe(true);
  });

  it("akzeptiert http nur für localhost (Integrator-Entwicklung)", () => {
    expect(isValidReturnUrl("http://localhost:3000/danke")).toBe(true);
    expect(isValidReturnUrl("http://127.0.0.1:8080/danke")).toBe(true);
  });

  it("lehnt http für echte Hosts ab", () => {
    expect(isValidReturnUrl("http://example.com/danke")).toBe(false);
  });

  it("lehnt andere Protokolle ab", () => {
    expect(isValidReturnUrl("javascript:alert(1)")).toBe(false);
    expect(isValidReturnUrl("ftp://example.com")).toBe(false);
  });

  it("lehnt relative Pfade und Unsinn ab", () => {
    expect(isValidReturnUrl("/danke")).toBe(false);
    expect(isValidReturnUrl("kein url")).toBe(false);
  });

  it("lehnt überlange URLs ab", () => {
    expect(isValidReturnUrl(`https://example.com/${"a".repeat(2000)}`)).toBe(
      false
    );
  });
});

describe("withSessionPlaceholder", () => {
  it("hängt session_id an eine URL ohne Query an", () => {
    expect(withSessionPlaceholder("https://example.com/danke")).toBe(
      "https://example.com/danke?session_id={CHECKOUT_SESSION_ID}"
    );
  });

  it("hängt mit & an, wenn schon eine Query existiert", () => {
    expect(withSessionPlaceholder("https://example.com/danke?x=1")).toBe(
      "https://example.com/danke?x=1&session_id={CHECKOUT_SESSION_ID}"
    );
  });

  it("lässt URLs mit vorhandenem Platzhalter unverändert", () => {
    const url = "https://example.com/danke?sid={CHECKOUT_SESSION_ID}";
    expect(withSessionPlaceholder(url)).toBe(url);
  });
});

describe("TtlCache", () => {
  it("liefert gesetzte Werte innerhalb der TTL", () => {
    let now = 1000;
    const cache = new TtlCache<string>(500, () => now);
    cache.set("a", "wert");
    now = 1499;
    expect(cache.get("a")).toBe("wert");
  });

  it("lässt Werte nach Ablauf verfallen", () => {
    let now = 1000;
    const cache = new TtlCache<string>(500, () => now);
    cache.set("a", "wert");
    now = 1500;
    expect(cache.get("a")).toBeUndefined();
  });

  it("kennt unbekannte Schlüssel nicht", () => {
    const cache = new TtlCache<string>(500, () => 0);
    expect(cache.get("fehlt")).toBeUndefined();
  });

  it("räumt abgelaufene Einträge beim Zugriff auf", () => {
    let now = 0;
    const cache = new TtlCache<string>(100, () => now);
    cache.set("a", "1");
    cache.set("b", "2");
    now = 200;
    cache.set("c", "3");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
    expect(cache.size).toBe(1);
  });
});

describe("apiCheckoutSchema", () => {
  const valid = {
    course: "react-fuer-einsteiger",
    email: "Kundin@Example.com",
    successUrl: "https://example.com/danke",
    cancelUrl: "https://example.com/abbruch",
  };

  it("akzeptiert gültige Eingaben und normalisiert die E-Mail", () => {
    const parsed = apiCheckoutSchema.parse(valid);
    expect(parsed.email).toBe("kundin@example.com");
    expect(parsed.locale).toBe("de");
  });

  it("übernimmt en als locale", () => {
    expect(apiCheckoutSchema.parse({ ...valid, locale: "en" }).locale).toBe(
      "en"
    );
  });

  it("akzeptiert optional einen Gutschein-Code", () => {
    expect(
      apiCheckoutSchema.parse({ ...valid, couponCode: " SOMMER25 " })
        .couponCode
    ).toBe("SOMMER25");
    expect(apiCheckoutSchema.parse(valid).couponCode).toBeUndefined();
  });

  it("lehnt fehlende Pflichtfelder ab", () => {
    expect(apiCheckoutSchema.safeParse({}).success).toBe(false);
    expect(
      apiCheckoutSchema.safeParse({ ...valid, email: "keine-mail" }).success
    ).toBe(false);
  });

  it("lehnt ungültige Rücksprung-URLs ab", () => {
    expect(
      apiCheckoutSchema.safeParse({ ...valid, successUrl: "javascript:x" })
        .success
    ).toBe(false);
    expect(
      apiCheckoutSchema.safeParse({ ...valid, cancelUrl: "/relativ" }).success
    ).toBe(false);
  });
});
