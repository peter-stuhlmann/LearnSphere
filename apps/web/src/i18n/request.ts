import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { getMessages } from "@elearning/i18n";
import deFormalOverride from "@elearning/i18n/messages/de-formal.json";
import { routing } from "./routing";
import { deepMerge } from "@/lib/deep-merge";
import { lookupWorkspaceByHost } from "@/lib/tenant";

/**
 * Auf einem Whitelabel-Mandanten-Host mit Sie-Anrede werden die formalen
 * Overrides bereits HIER angewandt – so nutzen Server-Components
 * (getTranslations) dieselbe Anrede wie der Client. Wird der Merge nur im
 * Layout für den Client-Provider gemacht, bleiben alle serverseitig
 * gerenderten Texte fälschlich beim „du".
 */
async function useFormalGerman(locale: string): Promise<boolean> {
  if (locale !== "de") return false;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const candidates = [h.get("x-forwarded-host"), h.get("host")].filter(
      (value): value is string => Boolean(value)
    );
    for (const host of candidates) {
      const workspace = await lookupWorkspaceByHost(host);
      if (workspace) {
        return workspace.status === "ACTIVE" && workspace.addressForm === "FORMAL";
      }
    }
  } catch {
    // Fallback: Basis-Anrede
  }
  return false;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = await getMessages(locale);
  const formal = await useFormalGerman(locale);

  return {
    locale,
    messages: formal ? deepMerge(messages, deFormalOverride) : messages,
  };
});
