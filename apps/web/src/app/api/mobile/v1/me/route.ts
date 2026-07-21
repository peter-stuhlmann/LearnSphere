import type { NextRequest } from "next/server";
import { updateProfileRequestSchema } from "@elearning/api-contracts/mobile/v1/community";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";

/** Profil aktualisieren (Name, Sprache). */
export async function PATCH(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await parseJsonBody(request, updateProfileRequestSchema);
  if (!body.ok) return body.response;

  await db.user.update({
    where: { id: auth.userId },
    data: {
      ...(body.data.name !== undefined ? { name: body.data.name } : {}),
      ...(body.data.locale !== undefined ? { locale: body.data.locale } : {}),
    },
  });
  return jsonResponse({ ok: true });
}

/** Profil des angemeldeten Users (Header, Profil-Screen der App). */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      locale: true,
      totpEnabled: true,
      image: true,
      handle: true,
    },
  });
  if (!user) return jsonError("unauthorized", 401);

  return jsonResponse({ user });
}
