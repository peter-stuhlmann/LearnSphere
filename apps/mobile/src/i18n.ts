import { getLocales } from "expo-localization";
import {
  defaultLocale,
  isAppLocale,
  type AppLocale,
  type Messages,
} from "@elearning/i18n";
import de from "@elearning/i18n/messages/de.json";
import en from "@elearning/i18n/messages/en.json";

/* Gleiche Message-Kataloge wie die Web-App (Single Source of Truth).
   Metro bündelt beide Sprachen statisch – bei ~100 kB pro Katalog ok. */

const catalogs: Record<AppLocale, Messages> = {
  de: de as Messages,
  en: en as unknown as Messages,
};

/** Gerätesprache → unterstützte Locale (Fallback: de). */
export function resolveDeviceLocale(): AppLocale {
  const device = getLocales()[0]?.languageCode ?? defaultLocale;
  return isAppLocale(device) ? device : defaultLocale;
}

export function messagesFor(locale: AppLocale): Messages {
  return catalogs[locale];
}
