import type { DeviceInfo } from "@elearning/api-contracts/mobile/v1/auth";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import {
  evaluateRefresh,
  generateRefreshToken,
  refreshExpiry,
} from "@/lib/mobile-session";
import {
  mobileJwtSecret,
  signAccessToken,
  type MobileTokenPayload,
} from "@/lib/mobile-auth";

/**
 * DB-Orchestrierung der Mobile-Sessions (Ausstellen, Rotieren, Widerrufen).
 * Die Entscheidungslogik ist pur in lib/mobile-session.ts und dort getestet.
 */

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
}

async function signFor(payload: MobileTokenPayload): Promise<{
  token: string;
  expiresAt: number;
}> {
  return signAccessToken(payload, { secret: mobileJwtSecret() });
}

/** Neue Geräte-Session anlegen (Login/Registrierung). */
export async function issueMobileSession(
  user: { id: string; role: string },
  device?: DeviceInfo
): Promise<IssuedTokens> {
  const refreshToken = generateRefreshToken();
  const session = await db.mobileSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      // Familie = erste Session; Rotationen behalten diese ID
      familyId: hashToken(refreshToken).slice(0, 25),
      devicePlatform: device?.platform ?? null,
      deviceName: device?.name ?? null,
      deviceId: device?.id ?? null,
      appVersion: device?.appVersion ?? null,
      expiresAt: refreshExpiry(),
    },
  });
  const access = await signFor({
    userId: user.id,
    role: user.role,
    sessionId: session.id,
  });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
  };
}

export type RotationResult =
  | { ok: true; tokens: IssuedTokens }
  | { ok: false; error: "refresh_invalid" | "refresh_reuse_detected" };

/** Refresh-Token einlösen: rotieren oder (bei Reuse) Familie widerrufen. */
export async function rotateMobileSession(
  refreshToken: string
): Promise<RotationResult> {
  const record = await db.mobileSession.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: { user: { select: { id: true, role: true } } },
  });

  const decision = evaluateRefresh(record);
  if (decision.action === "revoke_family" && record) {
    await db.mobileSession.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, error: "refresh_reuse_detected" };
  }
  if (decision.action !== "rotate" || !record) {
    return { ok: false, error: "refresh_invalid" };
  }

  const nextToken = generateRefreshToken();
  const [, next] = await db.$transaction([
    db.mobileSession.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    db.mobileSession.create({
      data: {
        userId: record.userId,
        refreshTokenHash: hashToken(nextToken),
        familyId: record.familyId,
        devicePlatform: record.devicePlatform,
        deviceName: record.deviceName,
        deviceId: record.deviceId,
        appVersion: record.appVersion,
        expiresAt: refreshExpiry(),
      },
    }),
  ]);

  const access = await signFor({
    userId: record.user.id,
    role: record.user.role,
    sessionId: next.id,
  });
  return {
    ok: true,
    tokens: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: nextToken,
    },
  };
}

/** Einzelne Session widerrufen (Logout dieses Geräts). */
export async function revokeMobileSession(sessionId: string): Promise<void> {
  await db.mobileSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Alle Sessions eines Users widerrufen (Logout überall, Passwort-Reset). */
export async function revokeAllMobileSessions(userId: string): Promise<void> {
  await db.mobileSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
