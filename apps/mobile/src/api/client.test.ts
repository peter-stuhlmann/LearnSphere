import { apiRequest, ensureAccessToken, ApiError, API_URL } from "./client";
import {
  clearAccessToken,
  clearRefreshToken,
  saveRefreshToken,
  setAccessToken,
} from "../auth/token-store";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const tokenPair = {
  accessToken: "neuer-jwt",
  accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
  refreshToken: "r".repeat(64),
};

afterEach(async () => {
  clearAccessToken();
  await clearRefreshToken();
});

describe("ensureAccessToken", () => {
  it("nutzt den vorhandenen Access-Token ohne Netz", async () => {
    setAccessToken("vorhanden", Date.now() + 60_000);
    const fetchMock = jest.fn();
    await expect(ensureAccessToken(fetchMock)).resolves.toBe("vorhanden");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("liefert null ohne Refresh-Token", async () => {
    await expect(ensureAccessToken(jest.fn())).resolves.toBeNull();
  });

  it("rotiert über den Refresh-Endpoint", async () => {
    await saveRefreshToken("alter-refresh");
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(tokenPair));
    await expect(ensureAccessToken(fetchMock)).resolves.toBe("neuer-jwt");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/mobile/v1/auth/refresh`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("meldet bei fehlgeschlagener Rotation lokal ab", async () => {
    await saveRefreshToken("gestohlen");
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "refresh_reuse_detected" } }, 401)
      );
    await expect(ensureAccessToken(fetchMock)).resolves.toBeNull();
    // Refresh-Token wurde gelöscht → zweiter Aufruf versucht kein Netz mehr
    const secondFetch = jest.fn();
    await expect(ensureAccessToken(secondFetch)).resolves.toBeNull();
    expect(secondFetch).not.toHaveBeenCalled();
  });
});

describe("apiRequest", () => {
  it("hängt den Bearer-Header an und parst JSON", async () => {
    setAccessToken("jwt", Date.now() + 60_000);
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await expect(
      apiRequest("/api/mobile/v1/me", { fetchImpl: fetchMock })
    ).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer jwt");
  });

  it("wirft ApiError mit Server-Code", async () => {
    setAccessToken("jwt", Date.now() + 60_000);
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: "not_found" } }, 404));
    await expect(
      apiRequest("/x", { fetchImpl: fetchMock })
    ).rejects.toMatchObject(new ApiError(404, "not_found"));
  });

  it("erneuert den Token nach 401 und wiederholt einmal", async () => {
    setAccessToken("abgelaufen", Date.now() + 60_000);
    await saveRefreshToken("refresh");
    const fetchMock = jest
      .fn()
      // 1. Request: 401
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "unauthorized" } }, 401)
      )
      // Refresh-Call
      .mockResolvedValueOnce(jsonResponse(tokenPair))
      // Retry mit frischem Token
      .mockResolvedValueOnce(jsonResponse({ user: { id: "u1" } }));

    await expect(
      apiRequest("/api/mobile/v1/me", { fetchImpl: fetchMock })
    ).resolves.toEqual({ user: { id: "u1" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, retryInit] = fetchMock.mock.calls[2];
    expect(retryInit.headers.Authorization).toBe("Bearer neuer-jwt");
  });
});
