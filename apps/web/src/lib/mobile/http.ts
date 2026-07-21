import type { ZodType } from "zod";
import {
  errorEnvelope,
  type MobileErrorCode,
} from "@elearning/api-contracts/mobile/v1/error";

/** JSON-Response mit einheitlichem Fehler-Envelope der Mobile-API. */
export function jsonError(
  code: MobileErrorCode,
  status: number,
  details?: string[]
): Response {
  return jsonResponse(errorEnvelope(code, details), status);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

/**
 * Request-Body als JSON lesen und gegen das Contract-Schema validieren.
 * Fehler → 400 mit validation_failed und den betroffenen Feldpfaden.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError("validation_failed", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) =>
      issue.path.length ? issue.path.join(".") : issue.message
    );
    return { ok: false, response: jsonError("validation_failed", 400, details) };
  }
  return { ok: true, data: parsed.data };
}
