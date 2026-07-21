"use client";

import { useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import {
  confirmTotpSetup,
  disableTotp,
  regenerateRecoveryCodes,
  startTotpSetup,
} from "@/app/actions/auth-actions";
import { deleteAccount, disconnectTermine } from "@/app/actions/account-actions";
import { Modal } from "@/components/ui/Modal";
import {
  Badge,
  Card,
  Container,
  DangerButton,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/AuthShell";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const SecurityCard = styled(Card)`
  max-width: 560px;
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;

  h2 {
    font-size: 1.3rem;
  }
`;

const QrBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1.25rem;
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};

  img {
    border-radius: ${({ theme }) => theme.radii.sm};
    background: #fff;
    padding: 8px;
  }
`;

const Secret = styled.code`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.accent};
  word-break: break-all;
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 0.5rem 0.75rem;
  border-radius: ${({ theme }) => theme.radii.sm};
`;

const InlineForm = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;

  > div {
    flex: 1;
    min-width: 180px;
  }
`;

/* Gefahrenzone: bewusst rot abgesetzt vom Rest der Einstellungen */
const DangerCard = styled(Card)`
  max-width: 560px;
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  border-color: rgba(255, 107, 107, 0.45);

  h2 {
    font-size: 1.3rem;
    color: ${({ theme }) => theme.colors.danger};
  }
`;

/* Folgen der Löschung: unmissverständliche Liste im Bestätigungs-Dialog */
const ConsequenceList = styled.ul`
  margin: 0;
  padding: 0 0 0 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.92rem;
  color: ${({ theme }) => theme.colors.text};

  li::marker {
    color: ${({ theme }) => theme.colors.danger};
  }
`;

export function SettingsView({
  totpEnabled,
  email,
  deletionMode,
  recoveryCodesLeft,
  termineConnected,
  termineResult,
}: {
  totpEnabled: boolean;
  /** eigene E-Mail – muss zur Löschbestätigung eingetippt werden */
  email: string;
  /** anonymize = Creator mit Verkäufen: Kurse bleiben für Käufer nutzbar */
  deletionMode: "delete" | "anonymize";
  /** verbleibende 2FA-Wiederherstellungscodes */
  recoveryCodesLeft: number;
  /** termine.lol-Verbindung des Kontos (Key bleibt serverseitig) */
  termineConnected: boolean;
  /** Ergebnis eines gerade beendeten Connect-Flows (?termine=…) */
  termineResult: "connected" | "denied" | "error" | null;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [setup, setSetup] = useState<{
    qrDataUrl: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  // Wiederherstellungscodes: werden genau einmal im Klartext angezeigt
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState("");

  async function copyRecoveryCodes() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCodesCopied(true);
    } catch {
      // Clipboard nicht verfügbar – Codes stehen sichtbar zum Abschreiben
    }
  }

  function onRegenerate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await regenerateRecoveryCodes({
        password: regeneratePassword,
      });
      if (!result.ok || !result.recoveryCodes) {
        setError(result.error ?? "generic");
        return;
      }
      setShowRegenerate(false);
      setRegeneratePassword("");
      setCodesCopied(false);
      setRecoveryCodes(result.recoveryCodes);
      router.refresh();
    });
  }

  // termine.lol: eigene Meldungen, getrennt von den 2FA-Alerts
  const [termineNotice, setTermineNotice] = useState<string | null>(() =>
    termineResult === "connected" ? "connected" : null
  );
  const [termineError, setTermineError] = useState<string | null>(() =>
    termineResult === "denied"
      ? "denied"
      : termineResult === "error"
        ? "error"
        : null
  );

  function onDisconnectTermine() {
    setTermineNotice(null);
    setTermineError(null);
    startTransition(async () => {
      const result = await disconnectTermine();
      if (!result.ok) {
        setTermineError("error");
        return;
      }
      setTermineNotice("disconnected");
      router.refresh();
    });
  }

  // Konto löschen: Dialog + Tipp-Bestätigung (eigene E-Mail-Adresse)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteConfirmed =
    deleteConfirm.trim().toLowerCase() === email.toLowerCase();

  async function onDeleteAccount(event: FormEvent) {
    event.preventDefault();
    if (!deleteConfirmed || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteAccount({ confirmText: deleteConfirm });
    if (!result.ok) {
      setDeleting(false);
      setDeleteError(result.error ?? "generic");
      return;
    }
    // Konto ist weg, Session beendet → harter Sprung zur Startseite
    window.location.assign("/");
  }

  function onStartSetup() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await startTotpSetup();
      if (!result.ok || !result.qrDataUrl || !result.secret) {
        setError(result.error ?? "generic");
        return;
      }
      setSetup({ qrDataUrl: result.qrDataUrl, secret: result.secret });
    });
  }

  function onConfirm(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmTotpSetup({ token: code });
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setSetup(null);
      setCode("");
      setNotice(t("twoFactorEnabled"));
      // Wiederherstellungscodes einmalig anzeigen (nur Hashes gespeichert)
      setCodesCopied(false);
      setRecoveryCodes(result.recoveryCodes ?? null);
      router.refresh();
    });
  }

  function onDisable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await disableTotp({ password: disablePassword });
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setShowDisable(false);
      setDisablePassword("");
      setNotice(t("twoFactorDisabled"));
      router.refresh();
    });
  }

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("securityTitle")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        <SecurityCard as="section" aria-labelledby="tfa-title">
          <h2 id="tfa-title">{t("twoFactorTitle")}</h2>
          <div>
            <Badge $tone={totpEnabled ? "success" : "muted"}>
              {totpEnabled ? t("twoFactorOn") : t("twoFactorOff")}
            </Badge>
          </div>
          <Muted style={{ fontSize: "0.92rem" }}>{t("twoFactorIntro")}</Muted>

          {notice ? (
            <FormAlert $tone="success" role="status">
              {notice}
            </FormAlert>
          ) : null}
          {error ? (
            <FormAlert $tone="error" role="alert">
              {error}
            </FormAlert>
          ) : null}

          {!totpEnabled && !setup ? (
            <div>
              <PrimaryButton onClick={onStartSetup} disabled={pending}>
                {t("enable2fa")}
              </PrimaryButton>
            </div>
          ) : null}

          {setup ? (
            <QrBox>
              <p style={{ fontWeight: 600, fontSize: "0.92rem" }}>
                {t("scanQr")}
              </p>
              <Image
                src={setup.qrDataUrl}
                alt={t("scanQr")}
                width={240}
                height={240}
                unoptimized
              />
              <Muted style={{ fontSize: "0.82rem" }}>
                {t("orEnterSecret")}
              </Muted>
              <Secret>{setup.secret}</Secret>

              <InlineForm onSubmit={onConfirm}>
                <Field
                  label={t("enterCode")}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <PrimaryButton type="submit" disabled={pending}>
                  {t("confirm")}
                </PrimaryButton>
              </InlineForm>
            </QrBox>
          ) : null}

          {recoveryCodes ? (
            <QrBox role="region" aria-label={t("recoveryTitle")}>
              <p style={{ fontWeight: 600, fontSize: "0.92rem" }}>
                🔑 {t("recoveryTitle")}
              </p>
              <Muted style={{ fontSize: "0.85rem" }}>
                {t("recoverySaveHint")}
              </Muted>
              <Secret as="pre" style={{ lineHeight: 1.8 }}>
                {recoveryCodes.join("\n")}
              </Secret>
              <GhostButton type="button" onClick={copyRecoveryCodes}>
                {codesCopied ? t("recoveryCopied") : t("recoveryCopy")}
              </GhostButton>
            </QrBox>
          ) : null}

          {totpEnabled && !recoveryCodes ? (
            <div>
              <Muted style={{ fontSize: "0.85rem" }}>
                {t("recoveryLeft", { count: recoveryCodesLeft })}
              </Muted>
              {showRegenerate ? (
                <InlineForm onSubmit={onRegenerate} style={{ marginTop: "0.6rem" }}>
                  <Field
                    label={t("recoveryRegeneratePassword")}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={regeneratePassword}
                    onChange={(e) => setRegeneratePassword(e.target.value)}
                  />
                  <GhostButton type="submit" disabled={pending}>
                    {t("recoveryRegenerate")}
                  </GhostButton>
                </InlineForm>
              ) : (
                <GhostButton
                  type="button"
                  style={{ marginTop: "0.6rem" }}
                  onClick={() => setShowRegenerate(true)}
                >
                  {t("recoveryRegenerate")}
                </GhostButton>
              )}
            </div>
          ) : null}

          {totpEnabled ? (
            showDisable ? (
              <InlineForm onSubmit={onDisable}>
                <Field
                  label={t("confirmPasswordToDisable")}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
                <DangerButton type="submit" disabled={pending}>
                  {t("disable2fa")}
                </DangerButton>
              </InlineForm>
            ) : (
              <div>
                <DangerButton onClick={() => setShowDisable(true)}>
                  {t("disable2fa")}
                </DangerButton>
              </div>
            )
          ) : null}
        </SecurityCard>

        <SecurityCard as="section" aria-labelledby="data-export-title">
          <h2 id="data-export-title">{t("exportTitle")}</h2>
          <Muted style={{ fontSize: "0.92rem" }}>{t("exportIntro")}</Muted>
          <div>
            <GhostButton as="a" href="/api/account/export" download>
              ⬇ {t("exportButton")}
            </GhostButton>
          </div>
        </SecurityCard>

        <SecurityCard as="section" aria-labelledby="termine-title">
          <h2 id="termine-title">📅 {t("termineTitle")}</h2>
          <div>
            <Badge $tone={termineConnected ? "success" : "muted"}>
              {termineConnected
                ? t("termineConnectedBadge")
                : t("termineNotConnectedBadge")}
            </Badge>
          </div>
          <Muted style={{ fontSize: "0.92rem" }}>{t("termineIntro")}</Muted>

          {termineNotice ? (
            <FormAlert $tone="success" role="status">
              {termineNotice === "connected"
                ? t("termineResultConnected")
                : t("termineDisconnected")}
            </FormAlert>
          ) : null}
          {termineError ? (
            <FormAlert $tone="error" role="alert">
              {termineError === "denied"
                ? t("termineResultDenied")
                : t("termineResultError")}
            </FormAlert>
          ) : null}

          {termineConnected ? (
            <div>
              <DangerButton onClick={onDisconnectTermine} disabled={pending}>
                {t("termineDisconnect")}
              </DangerButton>
            </div>
          ) : (
            <div>
              <PrimaryButton
                as="a"
                href={`/api/booking/connect?locale=${locale}&returnTo=${encodeURIComponent(
                  `/${locale}/settings`
                )}`}
              >
                {t("termineConnect")}
              </PrimaryButton>
            </div>
          )}
        </SecurityCard>

        <DangerCard as="section" aria-labelledby="delete-account-title">
          <h2 id="delete-account-title">{t("deleteTitle")}</h2>
          <Muted style={{ fontSize: "0.92rem" }}>{t("deleteIntro")}</Muted>
          <div>
            <DangerButton onClick={() => setDeleteOpen(true)}>
              {t("deleteButton")}
            </DangerButton>
          </div>
        </DangerCard>

        <Modal
          open={deleteOpen}
          title={t("deleteTitle")}
          closeLabel={t("deleteCancel")}
          onClose={() => {
            if (!deleting) setDeleteOpen(false);
          }}
        >
          <p style={{ fontWeight: 600 }}>{t("deleteWarning")}</p>
          <ConsequenceList>
            {deletionMode === "anonymize" ? (
              <>
                <li>{t("anonymizeConsequenceCourses")}</li>
                <li>{t("anonymizeConsequenceName")}</li>
              </>
            ) : (
              <li>{t("deleteConsequenceCourses")}</li>
            )}
            <li>{t("deleteConsequenceEnrollments")}</li>
            <li>{t("deleteConsequenceCertificates")}</li>
            <li>{t("deleteConsequenceEarnings")}</li>
            <li>{t("deleteConsequenceRetention")}</li>
            <li>{t("deleteConsequenceIrreversible")}</li>
          </ConsequenceList>

          <form onSubmit={onDeleteAccount}>
            <Field
              label={t("deleteConfirmLabel", { email })}
              autoComplete="off"
              spellCheck={false}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            {deleteError ? (
              <FormAlert
                $tone="error"
                role="alert"
                style={{ marginTop: "0.75rem" }}
              >
                {deleteError === "confirm_mismatch"
                  ? t("deleteConfirmMismatch")
                  : deleteError}
              </FormAlert>
            ) : null}
            <div style={{ marginTop: "1rem" }}>
              <DangerButton
                type="submit"
                disabled={!deleteConfirmed || deleting}
              >
                {deleting ? t("deleteBusy") : t("deleteConfirmButton")}
              </DangerButton>
            </div>
          </form>
        </Modal>
      </Container>
    </Wrap>
  );
}
