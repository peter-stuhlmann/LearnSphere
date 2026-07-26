"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "./AuthShell";
import { consumeTenantOAuth } from "@/app/actions/tenant-oauth-actions";

/**
 * Landeseite auf dem Mandanten-Host: löst den Handoff-Token ein (etabliert die
 * host-only Session) und leitet ins Portal. Die Server-Action leitet weiter.
 */
export function OAuthContinue({
  token,
  locale,
}: {
  token: string;
  locale: string;
}) {
  const t = useTranslations("auth");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    void consumeTenantOAuth({ token, locale });
  }, [token, locale]);

  return (
    <AuthShell title={t("oauthContinuing")} subtitle={t("oauthContinuingHint")}>
      <p aria-live="polite" style={{ textAlign: "center", opacity: 0.7 }}>
        …
      </p>
    </AuthShell>
  );
}
