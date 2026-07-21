import de from "../messages/de.json";

/* Gemeinsame i18n-Basis für Web (next-intl) und Native-App (use-intl):
   gleiche Locales, gleiche Message-Kataloge, gleiche Key-Struktur. */

export const locales = ["de", "en"] as const;
export const defaultLocale = "de" as const;

export type AppLocale = (typeof locales)[number];
export type Messages = typeof de;

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/* Statische Import-Map statt Template-Import: Bundler (Turbopack/Metro)
   können die Kataloge so exakt tracen und code-splitten. */
const catalogs: Record<AppLocale, () => Promise<{ default: Messages }>> = {
  de: () => import("../messages/de.json") as Promise<{ default: Messages }>,
  en: () =>
    import("../messages/en.json") as unknown as Promise<{ default: Messages }>,
};

export async function getMessages(locale: AppLocale): Promise<Messages> {
  return (await catalogs[locale]()).default;
}
