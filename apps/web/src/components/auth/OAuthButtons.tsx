"use client";

import { useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { oauthSignIn } from "@/app/actions/auth-actions";

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin: 1.3rem 0 0.2rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
  text-transform: uppercase;
  letter-spacing: 0.08em;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.border};
  }
`;

const Buttons = styled.div`
  display: grid;
  gap: 0.6rem;

  @media (min-width: 480px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ProviderButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.8rem 1rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.92rem;
  font-weight: 500;
  transition: border-color 160ms ease, transform 160ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    transform: none;
  }

  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const GoogleIcon = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.29v3.1A12 12 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l3.99-3.1z"
    />
    <path
      fill="#EA4335"
      d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.43-3.43C17.94 1.19 15.23 0 12 0A12 12 0 0 0 1.29 6.62l3.99 3.1C6.22 6.87 8.87 4.76 12 4.76z"
    />
  </svg>
);

const LinkedInIcon = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <rect width="24" height="24" rx="3" fill="#0A66C2" />
    <path
      fill="#fff"
      d="M6.94 8.6H4.02V20h2.92V8.6zM5.48 7.37a1.69 1.69 0 1 0 0-3.38 1.69 1.69 0 0 0 0 3.38zM20 13.47c0-3.05-1.63-4.47-3.8-4.47-1.75 0-2.54.96-2.98 1.64V8.6H10.3V20h2.92v-6.15c0-1.32.6-2.1 1.8-2.1 1.1 0 1.66.75 1.66 2.1V20H20v-6.53z"
    />
  </svg>
);

/**
 * Social-Login (Google/LinkedIn) für Anmeldung und Registrierung.
 * Die Buttons sind immer sichtbar; die Flows funktionieren, sobald die
 * OAuth-Client-Daten in der .env hinterlegt sind (AUTH_GOOGLE_ID, …).
 * `note` erscheint zwischen Buttons und Trenner – für Hinweise, die sich
 * auf den Social-Login beziehen (nicht auf das E-Mail-Formular darunter).
 */
export function OAuthButtons({ note }: { note?: ReactNode }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  function start(provider: "google" | "linkedin") {
    startTransition(async () => {
      await oauthSignIn(provider, locale);
    });
  }

  return (
    <div>
      <Buttons>
        <ProviderButton
          type="button"
          disabled={pending}
          onClick={() => start("google")}
        >
          {GoogleIcon}
          {t("continueWithGoogle")}
        </ProviderButton>
        <ProviderButton
          type="button"
          disabled={pending}
          onClick={() => start("linkedin")}
        >
          {LinkedInIcon}
          {t("continueWithLinkedIn")}
        </ProviderButton>
      </Buttons>
      {note}
      <Divider aria-hidden>{t("orWithEmail")}</Divider>
    </div>
  );
}
