"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { resetPassword } from "@/app/actions/auth-actions";
import { Field } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/primitives";
import { AuthShell, FormAlert, FormFooter, FormStack } from "./AuthShell";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await resetPassword({ token, password });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      {done ? (
        <FormAlert $tone="success" role="status">
          {t("resetSuccess")}
        </FormAlert>
      ) : (
        <FormStack onSubmit={onSubmit}>
          {error ? (
            <FormAlert $tone="error" role="alert">
              {t(`errors.${error}` as never)}
            </FormAlert>
          ) : null}
          <Field
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
            hint={t("passwordHint")}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PrimaryButton type="submit" disabled={pending}>
            {t("resetPassword")}
          </PrimaryButton>
        </FormStack>
      )}

      <FormFooter>
        <Link href="/login">{t("backToLogin")}</Link>
      </FormFooter>
    </AuthShell>
  );
}
