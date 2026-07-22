"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { sendAccessibilityFeedback } from "@/app/actions/accessibility-actions";
import { GhostButton, PrimaryButton } from "@/components/ui/primitives";

/**
 * Formular für Barriere-Meldungen, direkt auf der Erklärung zur
 * Barrierefreiheit.
 *
 * Eine reine mailto-Adresse setzt voraus, dass ein Mailprogramm eingerichtet
 * ist – auf fremden Geräten, im Kiosk-Modus oder bei reinem Webmail führt
 * der Link ins Leere. Deshalb hier zusätzlich ein Formular, das serverseitig
 * versendet.
 */

const Shell = styled.div`
  margin-top: 1.25rem;
  padding: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.bgElevated};
`;

const Fields = styled.div`
  display: grid;
  gap: 0.9rem;
  margin-bottom: 1.1rem;

  /* mobile first: eine Spalte; erst ab sm liegen Name und E-Mail nebeneinander */
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;

    .full {
      grid-column: 1 / -1;
    }
  }
`;

const Field = styled.div`
  display: grid;
  gap: 0.35rem;

  label {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }

  input,
  textarea {
    width: 100%;
    padding: 0.6rem 0.8rem;
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.bgDeep};
    color: ${({ theme }) => theme.colors.text};
    font: inherit;
    font-size: 0.95rem;
  }

  textarea {
    min-height: 130px;
    resize: vertical;
    line-height: 1.6;
  }

  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
    border-color: transparent;
  }
`;

const Note = styled.p`
  margin-top: 0.85rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Status = styled.p<{ $error: boolean }>`
  margin-top: 0.85rem;
  font-size: 0.9rem;
  color: ${({ $error, theme }) =>
    $error ? theme.colors.danger : theme.colors.accent};
`;

export function AccessibilityFeedbackForm() {
  const t = useTranslations("a11yFeedback");
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState("pending");
    setError(null);

    const result = await sendAccessibilityFeedback({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      subject: String(data.get("subject") ?? ""),
      message: String(data.get("message") ?? ""),
      page: window.location.pathname,
    });

    if (!result.ok) {
      setState("idle");
      setError(result.error ?? "generic");
      // Fehlermeldung anspringen, damit sie auch bei langem Formular auffällt
      statusRef.current?.focus();
      return;
    }
    setState("done");
  }

  if (!open) {
    return (
      <GhostButton type="button" onClick={() => setOpen(true)}>
        {t("open")}
      </GhostButton>
    );
  }

  if (state === "done") {
    return (
      <Status role="status" $error={false}>
        ✓ {t("success")}
      </Status>
    );
  }

  return (
    <Shell>
      <form onSubmit={onSubmit}>
        <Fields>
          <Field>
            <label htmlFor={`${fieldId}-name`}>{t("name")}</label>
            <input
              id={`${fieldId}-name`}
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={120}
            />
          </Field>
          <Field>
            <label htmlFor={`${fieldId}-email`}>{t("email")}</label>
            <input
              id={`${fieldId}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field className="full">
            <label htmlFor={`${fieldId}-subject`}>{t("subject")}</label>
            <input
              id={`${fieldId}-subject`}
              name="subject"
              type="text"
              required
              maxLength={160}
              defaultValue={t("subjectDefault")}
            />
          </Field>
          <Field className="full">
            <label htmlFor={`${fieldId}-message`}>{t("message")}</label>
            <textarea
              id={`${fieldId}-message`}
              name="message"
              required
              maxLength={5000}
              placeholder={t("messagePlaceholder")}
            />
          </Field>
        </Fields>

        <PrimaryButton type="submit" disabled={state === "pending"}>
          {state === "pending" ? t("sending") : t("submit")}
        </PrimaryButton>

        {error ? (
          <Status ref={statusRef} tabIndex={-1} role="alert" $error>
            {t(`errors.${error}` as never)}
          </Status>
        ) : null}

        <Note>{t("privacyNote")}</Note>
      </form>
    </Shell>
  );
}
