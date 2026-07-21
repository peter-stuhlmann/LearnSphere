import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Token-Ablage der App: Der kurzlebige Access-Token bleibt NUR im Speicher
 * (nie persistiert), der Refresh-Token liegt im Geräte-Schlüsselbund
 * (Keychain/Keystore via expo-secure-store). Web-Vorschau (expo start → w):
 * SecureStore existiert dort nicht → localStorage als Fallback.
 */

const REFRESH_TOKEN_KEY = "learnsphere.refresh-token";
const isWeb = Platform.OS === "web";

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

export function setAccessToken(token: string, expiresAt: number): void {
  accessToken = token;
  accessTokenExpiresAt = expiresAt;
}

export function clearAccessToken(): void {
  accessToken = null;
  accessTokenExpiresAt = 0;
}

/** Access-Token, sofern vorhanden und (mit 30 s Puffer) noch gültig. */
export function getValidAccessToken(now: number = Date.now()): string | null {
  if (!accessToken) return null;
  if (now >= accessTokenExpiresAt - 30_000) return null;
  return accessToken;
}

export async function saveRefreshToken(token: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function loadRefreshToken(): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
