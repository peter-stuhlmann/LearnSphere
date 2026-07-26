"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "./AuthShell";
import { startTenantOAuth } from "@/app/actions/tenant-oauth-actions";

/**
 * Zwischenseite auf der Hauptdomain: startet automatisch den OAuth-Flow für
 * den angefragten Mandanten-Host. Die Server-Action leitet weiter (Provider),
 * daher rendert das hier nur einen kurzen Ladehinweis.
 */
export function OAuthBridge({
  provider,
  host,
  locale,
}: {
  provider: "google" | "linkedin";
  host: string;
  locale: string;
}) {
  const t = useTranslations("auth");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startTenantOAuth({ provider, host, locale });
  }, [provider, host, locale]);

  return (
    <AuthShell
      title={t("oauthRedirecting")}
      subtitle={t("oauthRedirectingHint")}
    >
      <p aria-live="polite" style={{ textAlign: "center", opacity: 0.7 }}>
        …
      </p>
    </AuthShell>
  );
}
