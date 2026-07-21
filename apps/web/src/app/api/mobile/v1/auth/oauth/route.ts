import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { deviceInfoSchema } from "@elearning/api-contracts/mobile/v1/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { issueMobileSession } from "@/lib/services/mobile-sessions";

/**
 * Nativer OAuth-Login: Die App holt per expo-auth-session ein OIDC-id_token
 * (Google/LinkedIn) und tauscht es hier gegen unser Token-Paar. Verifikation
 * gegen die JWKS des Providers; Kontoverknüpfung über die verifizierte
 * E-Mail – gleiche Vertrauensbasis wie allowDangerousEmailAccountLinking
 * im Web (beide Provider verifizieren E-Mail-Adressen).
 */

const requestSchema = z.object({
  provider: z.enum(["google", "linkedin"]),
  idToken: z.string().min(20),
  device: deviceInfoSchema.optional(),
});

const PROVIDERS = {
  google: {
    jwks: createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs")
    ),
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    /** erlaubte Client-IDs (iOS/Android/Web) – kommagetrennt in der Env */
    audienceEnv: "GOOGLE_MOBILE_CLIENT_IDS",
  },
  linkedin: {
    jwks: createRemoteJWKSet(new URL("https://www.linkedin.com/oauth/openid/jwks")),
    issuers: ["https://www.linkedin.com/oauth", "https://www.linkedin.com"],
    audienceEnv: "LINKEDIN_MOBILE_CLIENT_IDS",
  },
} as const;

export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseJsonBody(request, requestSchema);
  if (!body.ok) return body.response;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (
    !(await checkRateLimit(`mobile-oauth:${ip}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    }))
  ) {
    return jsonError("rate_limited", 429);
  }

  const config = PROVIDERS[body.data.provider];
  const allowedAudiences = (process.env[config.audienceEnv] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedAudiences.length === 0) {
    // Provider nicht konfiguriert → Feature deaktiviert
    return jsonError("validation_failed", 503, ["oauth_not_configured"]);
  }

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(body.data.idToken, config.jwks, {
      issuer: config.issuers as unknown as string[],
      audience: allowedAudiences,
    });
    payload = verified.payload;
  } catch {
    return jsonError("invalid_credentials", 401);
  }

  const providerAccountId = typeof payload.sub === "string" ? payload.sub : null;
  const email =
    typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const emailVerified = payload.email_verified !== false;
  const name = typeof payload.name === "string" ? payload.name : null;
  if (!providerAccountId || !email || !emailVerified) {
    return jsonError("invalid_credentials", 401);
  }

  // Find-or-create wie der PrismaAdapter: erst Account, dann E-Mail
  const account = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: body.data.provider,
        providerAccountId,
      },
    },
    select: { userId: true },
  });

  let userId = account?.userId ?? null;
  if (!userId) {
    const user = await db.user.upsert({
      where: { email },
      update: { emailVerified: new Date() },
      create: { email, name, emailVerified: new Date() },
    });
    await db.account.create({
      data: {
        userId: user.id,
        type: "oidc",
        provider: body.data.provider,
        providerAccountId,
      },
    });
    userId = user.id;
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      locale: true,
      totpEnabled: true,
    },
  });

  const tokens = await issueMobileSession(user, body.data.device);
  return jsonResponse({ ...tokens, user });
}
