import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "@elearning/i18n";

/**
 * Lokalisierte Pfade: interne Route (= Ordnername) → externe URL je Sprache.
 * Links verwenden immer den internen Namen; next-intl übersetzt die URL.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/courses": { de: "/kurse", en: "/courses" },
    "/courses/[slug]": { de: "/kurse/[slug]", en: "/courses/[slug]" },
    "/my-learning": { de: "/mein-lernen", en: "/my-learning" },
    "/review": { de: "/wiederholen", en: "/review" },
    "/learn/[slug]": { de: "/lernen/[slug]", en: "/learn/[slug]" },
    "/learn/[slug]/quiz/[quizId]": {
      de: "/lernen/[slug]/pruefung/[quizId]",
      en: "/learn/[slug]/quiz/[quizId]",
    },
    "/profile": { de: "/profil", en: "/profile" },
    "/settings": { de: "/einstellungen", en: "/settings" },
    "/login": { de: "/anmelden", en: "/login" },
    "/register": { de: "/registrieren", en: "/register" },
    "/forgot-password": {
      de: "/passwort-vergessen",
      en: "/forgot-password",
    },
    "/verify-email": {
      de: "/email-bestaetigen",
      en: "/verify-email",
    },
    "/reset-password": {
      de: "/passwort-zuruecksetzen",
      en: "/reset-password",
    },
    "/pricing": { de: "/preise", en: "/pricing" },
    "/for-creators": { de: "/fuer-creator", en: "/for-creators" },
    "/api-docs": { de: "/api-doku", en: "/api-docs" },
    "/affiliate": { de: "/partnerprogramm", en: "/affiliate" },
    "/roadmap": "/roadmap",
    "/imprint": { de: "/impressum", en: "/imprint" },
    "/privacy": { de: "/datenschutz", en: "/privacy" },
    "/terms": { de: "/agb", en: "/terms" },
    "/accessibility": { de: "/barrierefreiheit", en: "/accessibility" },
    "/c/[handle]": "/c/[handle]",
    "/creator": "/creator",
    "/creator/stats": { de: "/creator/statistiken", en: "/creator/stats" },
    "/creator/distribution": {
      de: "/creator/vertrieb",
      en: "/creator/distribution",
    },
    "/creator/courses": { de: "/creator/kurse", en: "/creator/courses" },
    "/creator/courses/[id]": {
      de: "/creator/kurse/[id]",
      en: "/creator/courses/[id]",
    },
    "/creator/courses/[id]/quiz/[target]": {
      de: "/creator/kurse/[id]/pruefung/[target]",
      en: "/creator/courses/[id]/quiz/[target]",
    },
    "/creator/courses/[id]/coupons": {
      de: "/creator/kurse/[id]/gutscheine",
      en: "/creator/courses/[id]/coupons",
    },
    "/creator/courses/[id]/stats": {
      de: "/creator/kurse/[id]/statistiken",
      en: "/creator/courses/[id]/stats",
    },
    "/creator/courses/[id]/certificate": {
      de: "/creator/kurse/[id]/zertifikat",
      en: "/creator/courses/[id]/certificate",
    },
    "/cart": { de: "/warenkorb", en: "/cart" },
    "/verify": { de: "/verifizieren", en: "/verify" },
    "/verify/[serial]": {
      de: "/verifizieren/[serial]",
      en: "/verify/[serial]",
    },
    "/newsletter/confirm": "/newsletter/confirm",
    "/newsletter/unsubscribe": "/newsletter/unsubscribe",
    "/admin": "/admin",
    "/admin/moderation": "/admin/moderation",
    "/admin/courses": { de: "/admin/kurse", en: "/admin/courses" },
    "/admin/users": { de: "/admin/nutzer", en: "/admin/users" },
    "/admin/payouts": { de: "/admin/auszahlungen", en: "/admin/payouts" },
    "/admin/ai": { de: "/admin/ki", en: "/admin/ai" },
  },
});

export type AppLocale = (typeof routing.locales)[number];
