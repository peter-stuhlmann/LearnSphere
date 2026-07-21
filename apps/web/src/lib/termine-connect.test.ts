import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildConnectAuthorizeUrl,
  createConnectState,
  parseConnectTokenResponse,
  sanitizeReturnTo,
  verifyConnectState,
} from "./termine-connect";

const SECRET = "test-secret";
const INPUT = {
  userId: "user-1",
  locale: "de",
  returnTo: "/de/creator/courses/course-1",
};

describe("createConnectState / verifyConnectState", () => {
  it("verifiziert einen frisch erzeugten state und liefert die Payload", () => {
    const state = createConnectState(INPUT, SECRET, 1_000_000);
    const payload = verifyConnectState(state, SECRET, 1_000_000);
    expect(payload).toEqual({ ...INPUT, exp: 1_000_000 + 10 * 60 * 1000 });
  });

  it("lehnt abgelaufene states ab", () => {
    const state = createConnectState(INPUT, SECRET, 1_000_000);
    expect(
      verifyConnectState(state, SECRET, 1_000_000 + 10 * 60 * 1000)
    ).toBeNull();
  });

  it("lehnt manipulierte Payloads und falsche Secrets ab", () => {
    const state = createConnectState(INPUT, SECRET);
    expect(verifyConnectState(state, "anderes-secret")).toBeNull();

    const [, sig] = state.split(".");
    const forged = `${Buffer.from(
      JSON.stringify({ ...INPUT, userId: "hacked", exp: Date.now() + 60000 })
    ).toString("base64url")}.${sig}`;
    expect(verifyConnectState(forged, SECRET)).toBeNull();
  });

  it("lehnt kaputte Formate ab", () => {
    expect(verifyConnectState("", SECRET)).toBeNull();
    expect(verifyConnectState("ohne-punkt", SECRET)).toBeNull();
    expect(verifyConnectState(".nur-signatur", SECRET)).toBeNull();
    // gültige Signatur, aber Inhalt ist kein JSON
    const encoded = Buffer.from("kein json").toString("base64url");
    const sig = crypto
      .createHmac("sha256", SECRET)
      .update(encoded)
      .digest("base64url");
    expect(verifyConnectState(`${encoded}.${sig}`, SECRET)).toBeNull();
  });

  it("lehnt Signatur-Längenabweichungen ab (timing-safe Guard)", () => {
    const state = createConnectState(INPUT, SECRET);
    expect(verifyConnectState(`${state}xx`, SECRET)).toBeNull();
  });

  it("lehnt strukturell falsche Payloads ab (auch Open-Redirect-Ziele)", () => {
    for (const payload of [
      { userId: "u" }, // locale/returnTo/exp fehlen
      { ...INPUT, returnTo: "https://evil.example", exp: Date.now() + 60000 },
      { ...INPUT, returnTo: "//evil.example", exp: Date.now() + 60000 },
    ]) {
      const enc = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const s = crypto
        .createHmac("sha256", SECRET)
        .update(enc)
        .digest("base64url");
      expect(verifyConnectState(`${enc}.${s}`, SECRET)).toBeNull();
    }
    const encoded = Buffer.from(
      JSON.stringify({ courseId: "c" }) // altes Format
    ).toString("base64url");
    // Signatur passend zum encoded-Teil erzeugen: gleicher Weg wie die Lib
    const sig = crypto
      .createHmac("sha256", SECRET)
      .update(encoded)
      .digest("base64url");
    expect(verifyConnectState(`${encoded}.${sig}`, SECRET)).toBeNull();
  });
});

describe("sanitizeReturnTo", () => {
  it("lässt relative Pfade durch und fängt alles andere ab", () => {
    expect(sanitizeReturnTo("/de/settings", "/de/creator")).toBe("/de/settings");
    expect(sanitizeReturnTo(null, "/de/creator")).toBe("/de/creator");
    expect(sanitizeReturnTo("", "/de/creator")).toBe("/de/creator");
    expect(sanitizeReturnTo("https://evil.example", "/de/creator")).toBe(
      "/de/creator"
    );
    expect(sanitizeReturnTo("//evil.example", "/de/creator")).toBe(
      "/de/creator"
    );
  });
});

describe("buildConnectAuthorizeUrl", () => {
  it("baut die locale-präfixierte Consent-URL mit allen Parametern", () => {
    const url = new URL(
      buildConnectAuthorizeUrl({
        locale: "en",
        clientId: "learnsphere",
        redirectUri: "https://app.example.com/api/booking/connect/callback",
        state: "abc.def",
      })
    );
    expect(url.origin).toBe("https://termine.lol");
    expect(url.pathname).toBe("/en/connect");
    expect(url.searchParams.get("client_id")).toBe("learnsphere");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/booking/connect/callback"
    );
    expect(url.searchParams.get("state")).toBe("abc.def");
  });
});

describe("parseConnectTokenResponse", () => {
  it("liest calendarId und apiKey aus der data-Hülle", () => {
    expect(
      parseConnectTokenResponse({
        data: { calendarId: "cal-1", apiKey: "key-1" },
      })
    ).toEqual({ calendarId: "cal-1", apiKey: "key-1" });
  });

  it("akzeptiert auch Antworten ohne Hülle", () => {
    expect(
      parseConnectTokenResponse({ calendarId: "cal-1", apiKey: "key-1" })
    ).toEqual({ calendarId: "cal-1", apiKey: "key-1" });
  });

  it("gibt null bei kaputten Antworten zurück", () => {
    expect(parseConnectTokenResponse(null)).toBeNull();
    expect(parseConnectTokenResponse({ data: { calendarId: "" } })).toBeNull();
    expect(parseConnectTokenResponse({ error: "invalid_grant" })).toBeNull();
  });
});
