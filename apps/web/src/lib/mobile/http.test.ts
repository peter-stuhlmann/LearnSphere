import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonError, jsonResponse, parseJsonBody } from "./http";

describe("jsonResponse/jsonError", () => {
  it("liefert JSON mit Status und no-store", async () => {
    const res = jsonResponse({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("default-Status ist 200", () => {
    expect(jsonResponse({}).status).toBe(200);
  });

  it("baut Fehler-Envelopes mit optionalen Details", async () => {
    const res = jsonError("unauthorized", 401);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: { code: "unauthorized" },
    });

    const withDetails = jsonError("validation_failed", 400, ["email"]);
    await expect(withDetails.json()).resolves.toEqual({
      error: { code: "validation_failed", details: ["email"] },
    });
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ email: z.email() });

  function jsonRequest(body: string): Request {
    return new Request("http://test.local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  it("parst gültige Bodies", async () => {
    const result = await parseJsonBody(
      jsonRequest(JSON.stringify({ email: "a@b.de" })),
      schema
    );
    expect(result).toEqual({ ok: true, data: { email: "a@b.de" } });
  });

  it("lehnt kaputtes JSON mit 400 ab", async () => {
    const result = await parseJsonBody(jsonRequest("kein json"), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({
        error: { code: "validation_failed" },
      });
    }
  });

  it("meldet Schema-Verstöße mit Feldpfaden", async () => {
    const result = await parseJsonBody(
      jsonRequest(JSON.stringify({ email: "keine-mail" })),
      schema
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error.code).toBe("validation_failed");
      expect(body.error.details).toEqual(["email"]);
    }
  });

  it("nutzt die Fehlermeldung, wenn der Issue-Pfad leer ist", async () => {
    const rootSchema = z.string().refine(() => false, { message: "root_error" });
    const result = await parseJsonBody(jsonRequest('"x"'), rootSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error.details).toEqual(["root_error"]);
    }
  });
});
