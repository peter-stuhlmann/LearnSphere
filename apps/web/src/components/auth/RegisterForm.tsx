"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import {
  PasswordInput,
  StrengthBar,
  ValidationMessages,
  createRule,
  hasNumber,
  minLength,
  usePasswordValidation,
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

/** Grobe Plausibilität reicht: sie steuert nur, wann sich das restliche
 *  Formular öffnet – die echte Validierung machen Browser und Server. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Eingaben überleben AGB-Lesen & Co. – Passwörter landen hier bewusst nie */
const DRAFT_KEY = "learnsphere-register-draft";

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

/**
 * Progressive Disclosure: Höhe animiert über den grid-template-rows-Trick
 * (0fr → 1fr), dazu leicht verzögertes Einblenden. `inert` hält versteckte
 * Felder aus Tab-Reihenfolge und Accessibility-Tree heraus.
 */
const Reveal = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? "1fr" : "0fr")};
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  transition:
    grid-template-rows 420ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 300ms ease ${({ $open }) => ($open ? "120ms" : "0ms")};

  > div {
    min-height: 0;
    overflow: hidden;
    /* Minimaler Innenabstand, damit Fokus-Outlines nicht am
       overflow:hidden-Rand abgeschnitten werden */
    padding: 2px;
    margin: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Innerer Stapel der aufklappenden Felder – gleiche Rhythmik wie FormStack */
const RevealStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
`;

/** Stärkebalken + Regelliste im aufklappenden Validierungsblock */
const ChecksStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
`;

const PwnedChecking = styled.p`
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const PwnedWarning = styled.p`
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.7rem 0.9rem;
  font-size: 0.82rem;
  background: ${({ theme }) => theme.colors.dangerSoft};
  color: ${({ theme }) => theme.colors.danger};
`;

/**
 * Honeypot: Für Menschen unsichtbar (ohne display:none, das viele Bots
 * erkennen), per tabIndex/aria-hidden auch für Tastatur und Screenreader
 * nicht erreichbar. Füllt ein Bot das Feld, verwirft der Server die
 * Registrierung stillschweigend.
 */
const HoneypotWrap = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;

export function RegisterForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Einmal geöffnet bleibt offen – sonst klappt das Formular beim
  // Korrigieren der E-Mail-Adresse irritierend wieder zu
  const [unlocked, setUnlocked] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Draft wiederherstellen (nur nach dem Mount – sessionStorage gibt es
  // serverseitig nicht, und im Initial-Render gäbe das einen Hydration-Bruch)
  /* eslint-disable react-hooks/set-state-in-effect -- einmaliger Restore
     nach dem Mount; der eine Folge-Render ist gewollt und hydration-sicher */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        email?: string;
        name?: string;
        acceptTerms?: boolean;
      };
      if (draft.email) {
        setEmail(draft.email);
        if (EMAIL_SHAPE.test(draft.email)) setUnlocked(true);
      }
      if (draft.name) setName(draft.name);
      if (draft.acceptTerms) setAcceptTerms(true);
    } catch {
      // defekter oder blockierter Storage → ohne Draft weitermachen
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Draft bei jeder Änderung sichern; komplett leeres Formular räumt ihn weg
  useEffect(() => {
    try {
      if (!email && !name && !acceptTerms) {
        sessionStorage.removeItem(DRAFT_KEY);
      } else {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ email, name, acceptTerms })
        );
      }
    } catch {
      // Storage voll/blockiert → dann eben ohne Draft
    }
  }, [email, name, acceptTerms]);

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

  // Passwort-State inkl. Have-I-Been-Pwned-Prüfung kommt komplett aus dem
  // Paket-Hook: debounced, mit k-Anonymität (nur 5 Hash-Zeichen gehen raus)
  const {
    password,
    setPassword,
    errors: ruleErrors,
    confirmPassword,
    setConfirmPassword,
    isPwned,
    pwnedCount,
    isPwnedLoading,
  } = usePasswordValidation({
    rules,
    checkPwned: true,
    showConfirm: true,
    locale: pvrLocale,
  });

  // Regeln/Stärke nur zeigen, solange der Cursor im Feld steht – oder wenn
  // nach dem Verlassen noch Regeln offen sind (sonst fehlt das Warum)
  const checksVisible =
    passwordFocused || (password.length > 0 && ruleErrors.length > 0);

  function onEmailChange(value: string) {
    setEmail(value);
    if (!unlocked && EMAIL_SHAPE.test(value)) {
      setUnlocked(true);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Tippfehler-Schutz schon vor dem Request melden
    if (password !== confirmPassword) {
      setError("passwords_mismatch");
      return;
    }
    // Geleaktes Passwort gar nicht erst abschicken (Server prüft erneut)
    if (isPwned) {
      setError("password_pwned");
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
      website,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }

    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage blockiert → der Draft läuft mit der Session ohnehin aus
    }
    router.push({ pathname: "/login", query: { registered: "1" } });
  }

  return (
    <AuthShell title={t("registerTitle")} subtitle={t("registerSubtitle")}>
      <OAuthButtons
        note={
          <LegalNote>
            {t.rich("oauthLegal", {
              terms: (chunks) => (
                <Link href="/terms" target="_blank" rel="noopener">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" target="_blank" rel="noopener">
                  {chunks}
                </Link>
              ),
            })}
          </LegalNote>
        }
      />

      <FormStack onSubmit={onSubmit}>
        {error ? (
          <FormAlert $tone="error" role="alert">
            {t(`errors.${error}` as never)}
          </FormAlert>
        ) : null}

        <Field
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />

        <HoneypotWrap aria-hidden="true">
          <label htmlFor="register-website">Website</label>
          <input
            id="register-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </HoneypotWrap>

        <Reveal $open={unlocked}>
          <div inert={!unlocked}>
            <RevealStack>
              <Field
                label={t("name")}
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <Reveal $open={checksVisible}>
                  <div inert={!checksVisible}>
                    <ChecksStack>
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
                    </ChecksStack>
                  </div>
                </Reveal>
                {isPwnedLoading ? (
                  <PwnedChecking aria-live="polite">
                    {pvrLocale.pwnedChecking}
                  </PwnedChecking>
                ) : null}
                {isPwned ? (
                  <PwnedWarning role="alert">
                    {pvrLocale.pwnedMessage} (
                    {pwnedCount.toLocaleString(locale)}×)
                  </PwnedWarning>
                ) : null}
                <PasswordInput
                  variant="classic"
                  locale={pvrLocale}
                  label={t("confirmPassword")}
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  showToggle
                  error={
                    confirmPassword.length > 0 && confirmPassword !== password
                  }
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
                    terms: (chunks) => (
                      <Link href="/terms" target="_blank" rel="noopener">
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </TermsRow>
              <LegalNote style={{ marginTop: 0 }}>
                {t.rich("privacyNote", {
                  privacy: (chunks) => (
                    <Link href="/privacy" target="_blank" rel="noopener">
                      {chunks}
                    </Link>
                  ),
                })}
              </LegalNote>
            </RevealStack>
          </div>
        </Reveal>

        <PrimaryButton
          type="submit"
          disabled={pending}
          onClick={(e) => {
            // Solange die weiteren Felder zu sind, öffnet der Button sie
            // nur – sonst blockt die native Validierung an unsichtbaren
            // Pflichtfeldern und es passiert scheinbar gar nichts
            if (!unlocked) {
              e.preventDefault();
              setUnlocked(true);
            }
          }}
        >
          {t("register")}
        </PrimaryButton>
      </FormStack>

      <FormFooter>
        {t("hasAccount")} <Link href="/login">{t("loginNow")}</Link>
      </FormFooter>
    </AuthShell>
  );
}
