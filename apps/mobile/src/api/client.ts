import { tokenPairSchema } from "@elearning/api-contracts/mobile/v1/auth";
import {
  clearAccessToken,
  clearRefreshToken,
  getValidAccessToken,
  loadRefreshToken,
  saveRefreshToken,
  setAccessToken,
} from "../auth/token-store";

/**
 * HTTP-Client der App: hängt den Bearer-Token an, erneuert ihn bei Bedarf
 * über den Refresh-Endpoint (Rotation) und wiederholt den Request einmal.
 */

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: string[]
  ) {
    super(code);
  }
}

async function errorFromResponse(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    return new ApiError(
      response.status,
      body?.error?.code ?? "internal_error",
      body?.error?.details
    );
  } catch {
    return new ApiError(response.status, "internal_error");
  }
}

/** Access-Token beschaffen: aus dem Speicher oder per Refresh-Rotation. */
export async function ensureAccessToken(
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const current = getValidAccessToken();
  if (current) return current;

  const refreshToken = await loadRefreshToken();
  if (!refreshToken) return null;

  const response = await fetchImpl(`${API_URL}/api/mobile/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    // Rotation fehlgeschlagen (abgelaufen/widerrufen) → lokal abmelden
    clearAccessToken();
    await clearRefreshToken();
    return null;
  }
  const pair = tokenPairSchema.parse(await response.json());
  setAccessToken(pair.accessToken, pair.accessTokenExpiresAt);
  await saveRefreshToken(pair.refreshToken);
  return pair.accessToken;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** false = öffentlicher Endpoint, kein Authorization-Header */
  auth?: boolean;
  fetchImpl?: typeof fetch;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true, fetchImpl = fetch } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await ensureAccessToken(fetchImpl);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchImpl(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth) {
    // Access-Token serverseitig ungültig → einmal frisch beschaffen
    clearAccessToken();
    const token = await ensureAccessToken(fetchImpl);
    if (token) {
      const retry = await fetchImpl(`${API_URL}${path}`, {
        method,
        headers: { ...headers, Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (retry.ok) return (await retry.json()) as T;
      throw await errorFromResponse(retry);
    }
  }

  if (!response.ok) throw await errorFromResponse(response);
  return (await response.json()) as T;
}
