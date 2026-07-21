import {
  loginResponseSchema,
  type AuthUser,
  type DeviceInfo,
} from "@elearning/api-contracts/mobile/v1/auth";
import { API_URL, ApiError } from "./client";
import {
  clearAccessToken,
  clearRefreshToken,
  saveRefreshToken,
  setAccessToken,
} from "../auth/token-store";

export type LoginResult =
  | { status: "ok"; user: AuthUser }
  | { status: "2fa_required" }
  | { status: "error"; code: string };

/** Login inkl. 2FA-Step-up: 202 → App fragt den TOTP-Code ab. */
export async function login(input: {
  email: string;
  password: string;
  totp?: string;
  device?: DeviceInfo;
}): Promise<LoginResult> {
  const response = await fetch(`${API_URL}/api/mobile/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (response.status === 202) return { status: "2fa_required" };
  if (!response.ok) {
    try {
      const body = await response.json();
      return { status: "error", code: body?.error?.code ?? "internal_error" };
    } catch {
      return { status: "error", code: "internal_error" };
    }
  }

  const data = loginResponseSchema.parse(await response.json());
  setAccessToken(data.accessToken, data.accessTokenExpiresAt);
  await saveRefreshToken(data.refreshToken);
  return { status: "ok", user: data.user };
}

/** OAuth: id_token (expo-auth-session) gegen unser Token-Paar tauschen. */
export async function oauthLogin(
  provider: "google" | "linkedin",
  idToken: string,
  device?: DeviceInfo
): Promise<LoginResult> {
  const response = await fetch(`${API_URL}/api/mobile/v1/auth/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, idToken, device }),
  });
  if (!response.ok) {
    try {
      const body = await response.json();
      return { status: "error", code: body?.error?.code ?? "internal_error" };
    } catch {
      return { status: "error", code: "internal_error" };
    }
  }
  const data = loginResponseSchema.parse(await response.json());
  setAccessToken(data.accessToken, data.accessTokenExpiresAt);
  await saveRefreshToken(data.refreshToken);
  return { status: "ok", user: data.user };
}

/** Session dieses Geräts serverseitig widerrufen und lokal aufräumen. */
export async function logout(): Promise<void> {
  try {
    const { apiRequest } = await import("./client");
    await apiRequest("/api/mobile/v1/auth/logout", { method: "POST" });
  } catch (error) {
    // Auch bei Netzwerkfehlern lokal abmelden; Session läuft serverseitig ab
    if (!(error instanceof ApiError)) {
      // bewusst geschluckt – Offline-Logout ist gültig
    }
  } finally {
    clearAccessToken();
    await clearRefreshToken();
  }
}

/** Beim App-Start: Profil laden, wenn eine Session wiederherstellbar ist. */
export async function restoreSession(): Promise<AuthUser | null> {
  try {
    const { apiRequest } = await import("./client");
    const data = await apiRequest<{ user: AuthUser }>("/api/mobile/v1/me");
    return data.user;
  } catch {
    return null;
  }
}
