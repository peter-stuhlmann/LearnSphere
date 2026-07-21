import { z } from "zod";

/**
 * Zentrale, validierte Umgebungskonfiguration. Pflicht-Variablen lassen den
 * Server beim Start scheitern (Fail-Fast in src/instrumentation.ts) statt
 * erst beim ersten Nutzer-Request; optionale Variablen schalten Features
 * frei (Stripe, OpenAI, Mail, Analytics, …) und sind hier typisiert.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /* Pflicht */
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),

  /* Pflicht in Produktion (Session-Verschlüsselung) */
  AUTH_SECRET: z.string().min(16).optional(),

  /* Mobile-App: Signatur der Access-JWTs (getrennt vom Web-AUTH_SECRET) */
  MOBILE_JWT_SECRET: z.string().min(16).optional(),

  /* Signierte Video-URLs für die App; ohne eigenen Wert wird
     MOBILE_JWT_SECRET verwendet (lib/media-sign.ts) */
  MEDIA_SIGN_SECRET: z.string().min(16).optional(),

  /* In-App-Käufe: Store-Provision in Prozent (15 = Small Business Program) */
  IAP_STORE_COMMISSION_PERCENT: z.coerce.number().min(0).max(30).default(15),
  /* Apple App Store Server API (StoreKit-2-Verifikation + Notifications) */
  APPLE_IAP_BUNDLE_ID: z.string().optional(),
  APPLE_IAP_ENVIRONMENT: z.enum(["Sandbox", "Production"]).optional(),
  /* Verzeichnis mit Apple-Root-Zertifikaten (.cer/.pem von Apple PKI) */
  APPLE_ROOT_CA_DIR: z.string().optional(),
  /* Google Play Developer API (Service-Account) + RTDN-Push-Audience */
  GOOGLE_PLAY_PACKAGE_NAME: z.string().optional(),
  GOOGLE_PLAY_SA_EMAIL: z.string().optional(),
  GOOGLE_PLAY_SA_PRIVATE_KEY: z.string().optional(),
  GOOGLE_RTDN_AUDIENCE: z.string().optional(),

  /* Kanonische Basis-URL (Sitemap, OG, Mails, Embed) */
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000")
    .transform((value) => value.replace(/\/$/, "")),

  /* Optionale Feature-Gates */
  /* termine.lol-Connect-Flow ("Mit termine.lol verbinden"): unsere
     Partner-App-Zugangsdaten drüben (CONNECT_PARTNERS bei termine.lol) */
  TERMINE_CLIENT_ID: z.string().optional(),
  TERMINE_CLIENT_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validiert eine Env-Quelle (testbar; in der App ist das process.env).
 * Wirft mit lesbarer Auflistung aller Probleme statt kryptischer Laufzeit-
 * Fehler an anderer Stelle.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // Leere Werte wie "nicht gesetzt" behandeln. In den .env-Vorlagen steht
  // FOO="" ausdrücklich für "Feature aus" – ohne diese Normalisierung
  // würde etwa UPSTASH_REDIS_REST_URL="" als ungültige URL gelten und den
  // Serverstart verhindern. Docker Compose reicht leere Werte aus einer
  // env_file als leere Strings durch, deshalb greift das genau dort.
  const source_ = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== "")
  );
  const parsed = envSchema.safeParse(source_);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Ungültige Umgebungskonfiguration:\n${problems}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.AUTH_SECRET) {
    throw new Error(
      "Ungültige Umgebungskonfiguration:\n  - AUTH_SECRET: in Produktion erforderlich"
    );
  }
  return parsed.data;
}

let cached: Env | null = null;

/** Validierte Env (einmalig geparst). Wirft bei Fehlkonfiguration. */
export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Nur für Tests: Cache zurücksetzen. */
export function resetEnvCache(): void {
  cached = null;
}
