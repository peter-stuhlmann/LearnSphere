"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import {
  PasswordInput,
  StrengthBar,
  ValidationMessages,
  createRule,
  hasNumber,
  minLength,
  validatePassword,
  en as pvrEn,
  type PvrLocale,
} from "pwd-validator-react";
import { de as pvrDe } from "pwd-validator-react/locales";
import "pwd-validator-react/styles.css";
import { Link, useRouter } from "@/i18n/navigation";
import { registerUser } from "@/app/actions/auth-actions";
import { Field } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/primitives";
import { AuthShell, FormAlert, FormFooter, FormStack } from "./AuthShell";
import { OAuthButtons } from "./OAuthButtons";

const TermsRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;

  input {
    margin-top: 0.2rem;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    accent-color: ${({ theme }) => theme.colors.accent};
  }

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-underline-offset: 3px;
  }
`;

/**
 * pwd-validator-react ans "Night Observatory"-Theme anbinden: das Paket
 * ist komplett über CSS-Variablen stylebar, wir mappen sie auf unsere
 * Design-Tokens. Gruppiert Passwort + Stärke + Regeln + Bestätigung.
 */
const PvrTheme = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  --pvr-bg-color: ${({ theme }) => theme.colors.surface};
  --pvr-text-color: ${({ theme }) => theme.colors.text};
  --pvr-label-color: ${({ theme }) => theme.colors.textMuted};
  --pvr-placeholder-color: ${({ theme }) => theme.colors.textFaint};
  --pvr-border-color: ${({ theme }) => theme.colors.border};
  --pvr-border-radius: ${({ theme }) => theme.radii.md};
  --pvr-focus-color: ${({ theme }) => theme.colors.accent};
  --pvr-error-color: ${({ theme }) => theme.colors.danger};
  --pvr-success-color: ${({ theme }) => theme.colors.success};
  --pvr-toggle-color: ${({ theme }) => theme.colors.textMuted};
  --pvr-toggle-hover-color: ${({ theme }) => theme.colors.text};
  --pvr-strength-bg: ${({ theme }) => theme.colors.border};
  --pvr-strength-weak: ${({ theme }) => theme.colors.danger};
  /* Amber-Zwischenstufe – hat bewusst keinen eigenen Token */
  --pvr-strength-fair: #ffc94d;
  --pvr-strength-good: ${({ theme }) => theme.colors.success};
  --pvr-strength-strong: ${({ theme }) => theme.colors.accent};
  --pvr-font-family: inherit;

  /* v0.1.0: Der Fehlerrahmen verliert in der classic-Variante den
     Spezifitätskampf gegen die Basis-Border – hier deutlich nachgezogen */
  .pvr-input-field.pvr-input-field--error {
    border-color: var(--pvr-error-color);
  }
`;

const LegalNote = styled.p`
  margin-top: 0.7rem;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};

  a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  }
`;

export function RegisterForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pvrLocale: PvrLocale = locale === "de" ? pvrDe : pvrEn;
  // Exakt die Server-Regeln (packages/core passwordSchema): 8+ Zeichen,
  // Zahl, Buchstabe – Client zeigt live an, der Server bleibt die Wahrheit
  const rules = useMemo(
    () => [
      minLength(8, pvrLocale),
      hasNumber(1, pvrLocale),
      createRule("hasLetter", /\p{L}/u, t("errors.password_needs_letter")),
    ],
    [pvrLocale, t]
  );
  const ruleErrors = validatePassword(password, rules).errors;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Tippfehler-Schutz schon vor dem Request melden
    if (password !== confirmPassword) {
      setError("passwords_mismatch");
      return;
    }
    setPending(true);
    setError(null);

    const result = await registerUser({
      name,
      email,
      password,
      confirmPassword,
      acceptTerms,
      locale,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }

    router.push({ pathname: "/login", query: { registered: "1" } });
  }

  return (
    <AuthShell title={t("registerTitle")} subtitle={t("registerSubtitle")}>
      <OAuthButtons />
      <LegalNote>
        {t.rich("oauthLegal", {
          terms: (chunks) => <Link href="/terms">{chunks}</Link>,
          privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
        })}
      </LegalNote>

      <FormStack onSubmit={onSubmit}>
        {error ? (
          <FormAlert $tone="error" role="alert">
            {t(`errors.${error}` as never)}
          </FormAlert>
        ) : null}

        <Field
          label={t("name")}
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
            autoComplete="new-password"
            required
            minLength={8}
            showToggle
            aria-describedby="pvr-rules"
            error={password.length > 0 && ruleErrors.length > 0}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <StrengthBar
            locale={pvrLocale}
            password={password}
            rules={rules}
          />
          <ValidationMessages
            id="pvr-rules"
            role="status"
            locale={pvrLocale}
            password={password}
            rules={rules}
            showValid
          />
          <PasswordInput
            variant="classic"
            locale={pvrLocale}
            label={t("confirmPassword")}
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            showToggle
            error={confirmPassword.length > 0 && confirmPassword !== password}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </PvrTheme>

        <TermsRow>
          <input
            type="checkbox"
            required
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>
            {t.rich("acceptTerms", {
              terms: (chunks) => <Link href="/terms">{chunks}</Link>,
            })}
          </span>
        </TermsRow>
        <LegalNote style={{ marginTop: 0 }}>
          {t.rich("privacyNote", {
            privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
          })}
        </LegalNote>

        <PrimaryButton type="submit" disabled={pending}>
          {t("register")}
        </PrimaryButton>
      </FormStack>

      <FormFooter>
        {t("hasAccount")} <Link href="/login">{t("loginNow")}</Link>
      </FormFooter>
    </AuthShell>
  );
}
