/**
 * Cookie-Einwilligung (DSGVO): Nicht-notwendige Dienste (Analytics) laufen
 * erst NACH ausdrücklicher Zustimmung. Die Entscheidung liegt versioniert
 * in localStorage – steigt die Version (neue Kategorien), wird erneut
 * gefragt. Pure Logik, UI in components/consent/.
 */

export const CONSENT_STORAGE_KEY = "cookie-consent";
export const CONSENT_VERSION = 1;

/** Events, über die Banner/GA-Loader/Footer lose gekoppelt sind */
export const CONSENT_CHANGED_EVENT = "learnsphere:consent-changed";
export const OPEN_CONSENT_SETTINGS_EVENT = "learnsphere:open-consent";

export interface Consent {
  version: number;
  analytics: boolean;
  decidedAt: string;
}

/** localStorage-Wert → gültige Einwilligung oder null (erneut fragen). */
export function parseConsent(raw: string | null): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Consent>;
    if (
      value.version !== CONSENT_VERSION ||
      typeof value.analytics !== "boolean" ||
      typeof value.decidedAt !== "string"
    ) {
      return null;
    }
    return {
      version: value.version,
      analytics: value.analytics,
      decidedAt: value.decidedAt,
    };
  } catch {
    return null;
  }
}

export function serializeConsent(analytics: boolean, now: Date): string {
  const consent: Consent = {
    version: CONSENT_VERSION,
    analytics,
    decidedAt: now.toISOString(),
  };
  return JSON.stringify(consent);
}
