"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/app/actions/auth-actions";
import { Field } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/primitives";
import { AuthShell, FormAlert, FormFooter, FormStack } from "./AuthShell";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    await requestPasswordReset({ email, locale });
    setPending(false);
    setSent(true);
  }

  return (
    <AuthShell title={t("forgotTitle")} subtitle={t("forgotSubtitle")}>
      {sent ? (
        <FormAlert $tone="success" role="status">
          {t("resetSent")}
        </FormAlert>
      ) : (
        <FormStack onSubmit={onSubmit}>
          <Field
            label={t("email")}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PrimaryButton type="submit" disabled={pending}>
            {t("sendResetLink")}
          </PrimaryButton>
        </FormStack>
      )}

      <FormFooter>
        <Link href="/login">{t("backToLogin")}</Link>
      </FormFooter>
    </AuthShell>
  );
}
