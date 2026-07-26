"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import styled from "styled-components";
import { useLocale, useTranslations } from "next-intl";
import {
  PasswordInput,
  en as pvrEn,
  type PvrLocale,
} from "pwd-validator-react";
import { de as pvrDe } from "pwd-validator-react/locales";
import "pwd-validator-react/styles.css";
import { Link, useRouter } from "@/i18n/navigation";
import { resendVerification } from "@/app/actions/auth-actions";
import { Field } from "@/components/ui/Field";
import { GhostButton, PrimaryButton } from "@/components/ui/primitives";
import {
  AuthShell,
  FormAlert,
  FormFooter,
  FormStack,
  InlineLink,
} from "./AuthShell";
import { OAuthButtons } from "./OAuthButtons";

/**
 * pwd-validator-react ans "Night Observatory"-Theme anbinden – hier nur für
 * das Login-Passwortfeld mit Auge-Toggle (keine Stärke-/Regel-Anzeige). Die
 * CSS-Variablen spiegeln die gleiche Zuordnung wie im RegisterForm.
 */
const PvrTheme = styled.div`
  --pvr-bg-color: ${({ theme }) => theme.colors.surface};
  --pvr-text-color: ${({ theme }) => theme.colors.text};
  --pvr-label-color: ${({ theme }) => theme.colors.textMuted};
  --pvr-placeholder-color: ${({ theme }) => theme.colors.textFaint};
  --pvr-border-color: ${({ theme }) => theme.colors.border};
  --pvr-border-radius: ${({ theme }) => theme.radii.md};
  --pvr-focus-color: ${({ theme }) => theme.colors.accent};
  --pvr-error-color: ${({ theme }) => theme.colors.danger};
  --pvr-toggle-color: ${({ theme }) => theme.colors.textMuted};
  --pvr-toggle-hover-color: ${({ theme }) => theme.colors.text};
  --pvr-font-family: inherit;
`;

/** Dezenter Hinweis auf Mandanten-Portalen: Anmeldung nur mit Einladung. */
const InviteHint = styled.p`
  margin-bottom: 1.25rem;
  padding: 0.8rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.88rem;
  line-height: 1.5;
`;

export function LoginForm({ viaApex = false }: { viaApex?: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const searchParams = useSearchParams();
  // frisch registriert → Hinweis auf die Verifizierungs-Mail
  const justRegistered = searchParams.get("registered") === "1";
  // Portal-OAuth ohne gültige Einladung leitet mit ?authError=not_invited hierher
  // (nur bekannte Codes zulassen – sonst würde t() an fremden Werten scheitern)
  const [error, setError] = useState<string | null>(
    searchParams.get("authError") === "not_invited" ? "not_invited" : null
  );
  const [pending, setPending] = useState(false);
  const [verifyResent, setVerifyResent] = useState(false);

  const pvrLocale: PvrLocale = locale === "de" ? pvrDe : pvrEn;

  async function onResendVerification() {
    setVerifyResent(true);
    // antwortet immer mit Erfolg (keine Konto-Enumeration)
    await resendVerification({ email, locale });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // totp nur mitsenden, wenn wirklich eingegeben – Auth.js würde
    // undefined sonst als String "undefined" serialisieren
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      ...(totp ? { totp } : {}),
    });

    setPending(false);

    if (result?.error) {
      const code = result.code ?? "generic";
      if (code === "2fa_required") {
        setNeedsTotp(true);
        setError(null);
        return;
      }
      setError(code);
      return;
    }

    router.push("/my-learning");
    router.refresh();
  }

  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      {viaApex ? (
        <InviteHint role="note">{t("tenantLoginHint")}</InviteHint>
      ) : null}
      <OAuthButtons viaApex={viaApex} />

      <FormStack onSubmit={onSubmit}>
        {justRegistered && !error ? (
          <FormAlert $tone="success" role="status">
            {t("registeredCheckInbox")}
          </FormAlert>
        ) : null}
        {error ? (
          <FormAlert $tone="error" role="alert">
            {t(`errors.${error}` as never)}
          </FormAlert>
        ) : null}
        {error === "email_not_verified" ? (
          verifyResent ? (
            <FormAlert $tone="success" role="status">
              {t("verifyResent")}
            </FormAlert>
          ) : (
            <GhostButton type="button" onClick={onResendVerification}>
              ✉ {t("verifyResend")}
            </GhostButton>
          )
        ) : null}

        <Field
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PvrTheme>
          <PasswordInput
            variant="classic"
            locale={pvrLocale}
            label={t("password")}
            name="password"
            autoComplete="current-password"
            required
            showToggle
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </PvrTheme>

        {needsTotp ? (
          <Field
            label={t("totp")}
            hint={t("totpHint")}
            autoComplete="one-time-code"
            maxLength={12}
            required
            autoFocus
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
          />
        ) : null}

        <InlineLink>
          <Link href="/forgot-password">{t("forgotPassword")}</Link>
        </InlineLink>

        <PrimaryButton type="submit" disabled={pending}>
          {t("login")}
        </PrimaryButton>
      </FormStack>

      <FormFooter>
        {t("noAccount")} <Link href="/register">{t("registerNow")}</Link>
      </FormFooter>
    </AuthShell>
  );
}
