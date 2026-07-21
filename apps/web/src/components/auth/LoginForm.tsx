"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
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

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verifyResent, setVerifyResent] = useState(false);
  // frisch registriert → Hinweis auf die Verifizierungs-Mail
  const justRegistered = useSearchParams().get("registered") === "1";

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
      <OAuthButtons />

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
        <Field
          label={t("password")}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

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
