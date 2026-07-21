import { z } from "zod";
import { loginSchema, registerSchema } from "@elearning/core/validation";

/** Geräteinfos für die Session-Liste ("Angemeldete Geräte") */
export const deviceInfoSchema = z.object({
  platform: z.enum(["ios", "android"]).optional(),
  name: z.string().trim().max(120).optional(),
  /// App-Installations-UUID (vom Client generiert, kein Hardware-Identifier)
  id: z.string().trim().max(64).optional(),
  appVersion: z.string().trim().max(32).optional(),
});

export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

/* ---------- Requests ---------- */

export const loginRequestSchema = loginSchema.extend({
  device: deviceInfoSchema.optional(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerRequestSchema = registerSchema.safeExtend({
  acceptTerms: z.boolean(),
  locale: z.enum(["de", "en"]).default("de"),
  device: deviceInfoSchema.optional(),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(32).max(256),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  locale: z.enum(["de", "en"]).default("de"),
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(1),
});
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

/* ---------- Responses ---------- */

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.enum(["CLIENT", "CREATOR", "ADMIN"]),
  locale: z.string(),
  totpEnabled: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  /// Unix-Millisekunden – die App plant den Refresh davor
  accessTokenExpiresAt: z.number(),
  refreshToken: z.string(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const loginResponseSchema = tokenPairSchema.extend({
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const okResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof okResponseSchema>;
