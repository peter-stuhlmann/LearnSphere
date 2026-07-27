"use client";

import { useState, type ComponentProps } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";

/**
 * Passwortfeld auf Basis des app-eigenen Field/Input – damit E-Mail- und
 * Passwortfeld exakt gleich aussehen (statt des andersgestylten Fremdpakets).
 * Auge-Toggle zum Ein-/Ausblenden; Stärke/Regeln/„pwned" liefert weiterhin der
 * usePasswordValidation-Hook separat.
 */
const Toggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 0.3rem;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
    border-radius: 6px;
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const EyeIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9" />
    <path d="M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 3.9-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

type PasswordFieldProps = Omit<ComponentProps<typeof Field>, "trailing" | "type">;

export function PasswordField(props: PasswordFieldProps) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <Field
      {...props}
      type={show ? "text" : "password"}
      trailing={
        <Toggle
          type="button"
          aria-label={show ? t("hidePassword") : t("showPassword")}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          {show ? EyeOffIcon : EyeIcon}
        </Toggle>
      }
    />
  );
}
