import * as SecureStore from "expo-secure-store";
import {
  clearAccessToken,
  clearRefreshToken,
  getValidAccessToken,
  loadRefreshToken,
  saveRefreshToken,
  setAccessToken,
} from "./token-store";

describe("access token (in-memory)", () => {
  afterEach(() => clearAccessToken());

  it("liefert einen gültigen Token zurück", () => {
    setAccessToken("jwt", Date.now() + 15 * 60 * 1000);
    expect(getValidAccessToken()).toBe("jwt");
  });

  it("liefert null ohne Token", () => {
    expect(getValidAccessToken()).toBeNull();
  });

  it("behandelt bald ablaufende Tokens als ungültig (30-s-Puffer)", () => {
    const now = Date.now();
    setAccessToken("jwt", now + 10_000);
    expect(getValidAccessToken(now)).toBeNull();
  });

  it("clearAccessToken entfernt den Token", () => {
    setAccessToken("jwt", Date.now() + 60_000);
    clearAccessToken();
    expect(getValidAccessToken()).toBeNull();
  });
});

describe("refresh token (secure store)", () => {
  it("speichert, lädt und löscht über den Schlüsselbund", async () => {
    await saveRefreshToken("r1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "learnsphere.refresh-token",
      "r1"
    );
    await expect(loadRefreshToken()).resolves.toBe("r1");
    await clearRefreshToken();
    await expect(loadRefreshToken()).resolves.toBeNull();
  });
});
