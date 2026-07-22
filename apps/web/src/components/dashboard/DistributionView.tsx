"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import {
  createApiKey,
  revokeApiKey,
  saveStorefront,
} from "@/app/actions/distribution-actions";
import {
  refreshConnectStatus,
  startConnectOnboarding,
} from "@/app/actions/connect-actions";
import {
  requestPayout,
  savePayoutAccount,
} from "@/app/actions/payout-actions";
import { maskIban, MIN_PAYOUT_CENTS } from "@elearning/core/payout";
import type { PayoutSummary } from "@/lib/payout-server";
import { formatMoney } from "@elearning/core/format";
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

const Grid = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
`;

const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const CardTitle = styled.h2`
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
`;

const CodeBlock = styled.pre`
  background: ${({ theme }) => theme.colors.bgDeep};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.9rem 1rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.76rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const KeyRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0;
  border-bottom: 1px dashed ${({ theme }) => theme.colors.border};
  font-size: 0.88rem;

  code {
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.accent};
  }

  .meta {
    color: ${({ theme }) => theme.colors.textFaint};
    font-size: 0.78rem;
  }

  .spacer {
    flex: 1;
  }
`;

const RevealBox = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => theme.colors.accentSoft};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  code {
    font-family: ${({ theme }) => theme.fonts.mono};
    word-break: break-all;
    color: ${({ theme }) => theme.colors.text};
  }
`;

const EmbedRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem 0;
  border-bottom: 1px dashed ${({ theme }) => theme.colors.border};

  strong {
    font-size: 0.92rem;
    font-weight: 600;
  }
`;

const CopyButton = styled(GhostButton)`
  align-self: flex-start;
  padding: 0.45rem 1rem;
  font-size: 0.82rem;
`;

const StorefrontLink = styled.a`
  color: ${({ theme }) => theme.colors.accent};
  word-break: break-all;
`;

interface DistributionViewProps {
  appUrl: string;
  payout: PayoutSummary;
  apiPlan: {
    usable: boolean;
    pastDue: boolean;
    /** Zugang als Betreiber der Plattform, ohne Abo */
    complimentary: boolean;
    hasStripeCustomer: boolean;
    justActivated: boolean;
  };
  connect: {
    stripeEnabled: boolean;
    hasAccount: boolean;
    chargesEnabled: boolean;
    justReturned: boolean;
  };
  storefront: {
    handle: string;
    storefrontName: string;
    brandColor: string;
    customDomain: string;
  };
  courses: { slug: string; title: string }[];
  /** Rückgaben (30-Tage-Garantie) – sofort in den Finanzen sichtbar */
  refunds: {
    count: number;
    lostShareCents: number;
    recent: {
      id: string;
      courseTitle: string;
      amountCents: number;
      creatorShareCents: number;
      reason: string | null;
      createdAt: string;
    }[];
  };
  apiKeys: {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
    revoked: boolean;
  }[];
}

export function DistributionView({
  appUrl,
  payout,
  apiPlan,
  connect,
  storefront,
  courses,
  refunds,
  apiKeys,
}: DistributionViewProps) {
  const t = useTranslations("distribution");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState(storefront);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [bank, setBank] = useState({ holder: payout.holder, iban: payout.iban });
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutNotice, setPayoutNotice] = useState<string | null>(null);

  // Guthaben/Auszahlungen sind Geldbeträge: 0 heißt „0,00 €", nie „Kostenlos"
  const euro = (cents: number) => formatMoney(cents || 0, "EUR", locale);

  function onSaveBank(event: FormEvent) {
    event.preventDefault();
    setPayoutError(null);
    setPayoutNotice(null);
    startTransition(async () => {
      const result = await savePayoutAccount(bank);
      if (!result.ok) {
        setPayoutError(result.error ?? "generic");
        return;
      }
      setPayoutNotice(t("bankSaved"));
      router.refresh();
    });
  }

  function onRequestPayout() {
    setPayoutError(null);
    setPayoutNotice(null);
    startTransition(async () => {
      const result = await requestPayout();
      if (!result.ok) {
        setPayoutError(result.error ?? "generic");
        return;
      }
      setPayoutNotice(
        t("payoutRequested", { iban: maskIban(payout.iban) })
      );
      router.refresh();
    });
  }

  const knownErrors = [
    "handle_invalid",
    "handle_reserved",
    "handle_taken",
    "color_invalid",
    "domain_invalid",
    "domain_taken",
    "name_too_short",
    "key_limit_reached",
  ];

  const errorText = (code: string) =>
    knownErrors.includes(code)
      ? t(`errors.${code}` as never)
      : t("errors.generic");

  function onSaveStorefront(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveStorefront(draft);
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setNotice(t("saved"));
      router.refresh();
    });
  }

  function onCreateKey(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createApiKey({ name: keyName });
      if (!result.ok || !result.plainKey) {
        setError(result.error ?? "generic");
        return;
      }
      setNewKey(result.plainKey);
      setKeyName("");
      router.refresh();
    });
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 2000);
  }

  const storefrontUrl = draft.handle
    ? `${appUrl}/${locale}/c/${draft.handle}`
    : null;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const embedCode = (slug: string) =>
    `<iframe src="${appUrl}/embed/${slug}?lang=${locale}" width="420" height="340" style="border:0;border-radius:16px;max-width:100%" title="LearnSphere" loading="lazy"></iframe>`;

  const apiExample = `curl ${appUrl}/api/v1/courses \\\n  -H "Authorization: Bearer ls_DEIN_SCHLUESSEL"`;

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <Muted style={{ marginTop: "0.75rem", maxWidth: "64ch" }}>
          {t("intro")}
        </Muted>

        {notice ? (
          <FormAlert $tone="success" role="status" style={{ marginTop: "1rem" }}>
            {notice}
          </FormAlert>
        ) : null}
        {error ? (
          <FormAlert $tone="error" role="alert" style={{ marginTop: "1rem" }}>
            {errorText(error)}
          </FormAlert>
        ) : null}

        <Grid>
          <Card as="section" aria-labelledby="storefront-title">
            <CardTitle id="storefront-title">{t("storefrontTitle")}</CardTitle>
            <Muted style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
              {t("storefrontIntro")}
            </Muted>
            <FormStack onSubmit={onSaveStorefront}>
              <Field
                label={t("handle")}
                value={draft.handle}
                onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                required
                minLength={3}
                maxLength={32}
              />
              <Field
                label={t("storefrontName")}
                value={draft.storefrontName}
                onChange={(e) =>
                  setDraft({ ...draft, storefrontName: e.target.value })
                }
                required
                minLength={2}
              />
              <Field
                label={t("brandColor")}
                value={draft.brandColor}
                placeholder="#C8FF4D"
                onChange={(e) =>
                  setDraft({ ...draft, brandColor: e.target.value })
                }
              />
              <Field
                label={t("customDomain")}
                hint={t("customDomainHint")}
                value={draft.customDomain}
                placeholder="kurse.deine-domain.de"
                onChange={(e) =>
                  setDraft({ ...draft, customDomain: e.target.value })
                }
              />
              <PrimaryButton type="submit" disabled={pending}>
                {t("saved") === notice ? "✓" : ""} {t("storefrontTitle")}
              </PrimaryButton>
              <Muted style={{ fontSize: "0.85rem" }}>
                {t("storefrontUrl")}{" "}
                {storefrontUrl ? (
                  <StorefrontLink href={storefrontUrl} target="_blank" rel="noopener">
                    {storefrontUrl}
                  </StorefrontLink>
                ) : (
                  t("notSetUp")
                )}
              </Muted>
            </FormStack>
          </Card>

          <Card as="section" aria-labelledby="api-title">
            <CardTitle id="api-title">
              {t("apiTitle")}{" "}
              {apiPlan.usable ? (
                /* Betreiber sehen einen eigenen Hinweis – "API aktiv" wäre
                   irreführend, es steht ja kein Abo dahinter. */
                <Badge
                  $tone={
                    apiPlan.complimentary || apiPlan.pastDue
                      ? "violet"
                      : "success"
                  }
                >
                  {apiPlan.complimentary
                    ? t("apiComplimentaryBadge")
                    : apiPlan.pastDue
                      ? t("apiPastDueBadge")
                      : t("apiActiveBadge")}
                </Badge>
              ) : null}
            </CardTitle>
            <Muted style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
              {t("apiIntro")}
            </Muted>

            {apiPlan.justActivated ? (
              <FormAlert $tone="success" role="status" style={{ marginBottom: "1rem" }}>
                {t("apiActivated")}
              </FormAlert>
            ) : null}

            {!apiPlan.usable ? (
              <div
                style={{
                  border: "1px solid rgba(139,124,255,0.45)",
                  background: "rgba(139,124,255,0.14)",
                  borderRadius: 14,
                  padding: "1.1rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <span style={{ fontSize: "0.9rem" }}>{t("apiLocked")}</span>
                <StorefrontLink as={Link} href="/pricing">
                  {t("apiUnlock")} →
                </StorefrontLink>
              </div>
            ) : null}

            {apiPlan.usable && apiPlan.hasStripeCustomer ? (
              <GhostButton
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const { openApiBillingPortal } = await import(
                      "@/app/actions/billing-actions"
                    );
                    const result = await openApiBillingPortal({ locale });
                    if (result.ok && result.url) {
                      window.location.href = result.url;
                    }
                  })
                }
              >
                {t("apiManage")}
              </GhostButton>
            ) : null}

            {apiPlan.usable && newKey ? (
              <RevealBox role="status">
                <strong>{t("keyCreatedTitle")}</strong>
                <code>{newKey}</code>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <CopyButton onClick={() => copyText(newKey, "newkey")}>
                    {copied === "newkey" ? t("copied") : t("copy")}
                  </CopyButton>
                </div>
                <Muted style={{ fontSize: "0.8rem" }}>
                  {t("keyCreatedHint")}
                </Muted>
              </RevealBox>
            ) : null}

            {apiPlan.usable ? (
              <FormStack onSubmit={onCreateKey} style={{ marginTop: "1rem" }}>
                <Field
                  label={t("apiKeyName")}
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                  minLength={2}
                />
                <PrimaryButton type="submit" disabled={pending}>
                  + {t("createKey")}
                </PrimaryButton>
              </FormStack>
            ) : null}

            <div style={{ marginTop: "1.25rem" }}>
              {apiKeys.length === 0 ? (
                <Muted style={{ fontSize: "0.85rem" }}>{t("noKeys")}</Muted>
              ) : (
                apiKeys.map((key) => (
                  <KeyRow key={key.id}>
                    <code>{key.prefix}…</code>
                    <span>{key.name}</span>
                    <Badge $tone={key.revoked ? "muted" : "success"}>
                      {key.revoked ? t("statusRevoked") : t("statusActive")}
                    </Badge>
                    <span className="meta">
                      {key.lastUsedAt
                        ? t("lastUsed", {
                            date: dateFormat.format(new Date(key.lastUsedAt)),
                          })
                        : t("neverUsed")}
                    </span>
                    <span className="spacer" />
                    {!key.revoked ? (
                      <DangerButton
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await revokeApiKey(key.id);
                            router.refresh();
                          })
                        }
                      >
                        {t("revoke")}
                      </DangerButton>
                    ) : null}
                  </KeyRow>
                ))
              )}
            </div>

            {apiPlan.usable ? (
              <div style={{ marginTop: "1.25rem" }}>
                <Muted style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                  {t("apiExample")}:
                </Muted>
                <CodeBlock>{apiExample}</CodeBlock>
              </div>
            ) : null}
          </Card>
        </Grid>

        <Card
          as="section"
          aria-labelledby="payouts-title"
          style={{ marginTop: "1.5rem" }}
        >
          <CardTitle id="payouts-title">{t("payoutsTitle")}</CardTitle>
          <Muted style={{ fontSize: "0.9rem" }}>{t("payoutsIntro")}</Muted>

          {connect.justReturned ? (
            <FormAlert
              $tone="success"
              role="status"
              style={{ marginTop: "0.75rem" }}
            >
              {t("connectDone")}
            </FormAlert>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            <Badge
              $tone={
                connect.chargesEnabled
                  ? "success"
                  : connect.hasAccount
                    ? "violet"
                    : "muted"
              }
            >
              {connect.chargesEnabled
                ? t("connectActive")
                : connect.hasAccount
                  ? t("connectPending")
                  : t("connectNone")}
            </Badge>

            {!connect.stripeEnabled ? (
              <Muted style={{ fontSize: "0.82rem" }}>
                {t("connectStripeDisabled")}
              </Muted>
            ) : (
              <>
                {!connect.chargesEnabled ? (
                  <PrimaryButton
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await startConnectOnboarding({ locale });
                        if (result.ok && result.url) {
                          window.location.href = result.url;
                        } else {
                          setError(result.error ?? "generic");
                        }
                      })
                    }
                  >
                    {connect.hasAccount
                      ? t("connectContinue")
                      : t("connectStart")}
                  </PrimaryButton>
                ) : null}
                {connect.hasAccount ? (
                  <GhostButton
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await refreshConnectStatus();
                        router.refresh();
                      })
                    }
                  >
                    {t("connectRefresh")}
                  </GhostButton>
                ) : null}
              </>
            )}
          </div>
        </Card>

        <Card
          as="section"
          aria-labelledby="payout-bank-title"
          style={{ marginTop: "1.5rem" }}
        >
          <CardTitle id="payout-bank-title">{t("payoutBankTitle")}</CardTitle>
          <Muted style={{ fontSize: "0.9rem" }}>{t("payoutBankIntro")}</Muted>

          {payoutNotice ? (
            <FormAlert $tone="success" role="status" style={{ marginTop: "0.75rem" }}>
              {payoutNotice}
            </FormAlert>
          ) : null}
          {payoutError ? (
            <FormAlert $tone="error" role="alert" style={{ marginTop: "0.75rem" }}>
              {[
                "holder_required",
                "iban_invalid",
                "below_minimum",
                "no_bank_account",
                "request_pending",
              ].includes(payoutError)
                ? t(`payoutErrors.${payoutError}` as never)
                : payoutError}
            </FormAlert>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "1rem",
              margin: "1.25rem 0",
            }}
          >
            <div>
              <Muted style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                {t("balance")}
              </Muted>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2rem",
                  color: "#C8FF4D",
                }}
              >
                {euro(Math.max(0, payout.balanceCents))}
              </p>
            </div>
            {payout.pendingCents > 0 ? (
              <div>
                <Muted style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                  {t("pending")}
                </Muted>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "2rem",
                    color: "#8B7CFF",
                  }}
                >
                  {euro(payout.pendingCents)}
                </p>
                <Muted style={{ fontSize: "0.75rem" }}>
                  {t("pendingHint")}
                </Muted>
              </div>
            ) : null}
            <PrimaryButton
              disabled={
                pending ||
                payout.hasOpenRequest ||
                payout.balanceCents < MIN_PAYOUT_CENTS ||
                !payout.iban
              }
              onClick={onRequestPayout}
            >
              {t("requestPayout")}
            </PrimaryButton>
            <Muted style={{ fontSize: "0.8rem" }}>{t("minPayout")}</Muted>
          </div>

          <FormStack onSubmit={onSaveBank} style={{ maxWidth: 480 }}>
            <Field
              label={t("holder")}
              value={bank.holder}
              onChange={(e) => setBank({ ...bank, holder: e.target.value })}
              required
              minLength={3}
            />
            <Field
              label={t("iban")}
              value={bank.iban}
              placeholder="DE89 3704 0044 0532 0130 00"
              onChange={(e) => setBank({ ...bank, iban: e.target.value })}
              required
            />
            <GhostButton type="submit" disabled={pending}>
              {t("saveBank")}
            </GhostButton>
          </FormStack>

          <div style={{ marginTop: "1.25rem" }}>
            <Muted style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
              {t("payoutHistory")}:
            </Muted>
            {payout.history.length === 0 ? (
              <Muted style={{ fontSize: "0.85rem" }}>{t("noPayouts")}</Muted>
            ) : (
              payout.history.map((entry) => (
                <KeyRow key={entry.id}>
                  <code>{euro(entry.amountCents)}</code>
                  <Badge $tone={entry.status === "PAID" ? "success" : "violet"}>
                    {t(`status${entry.status}` as never)}
                  </Badge>
                  <span className="meta">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(entry.createdAt))}
                  </span>
                </KeyRow>
              ))
            )}
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <Muted style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
              {t("refundsTitle")}
              {refunds.count > 0
                ? ` (${t("refundsSummary", {
                    count: refunds.count,
                    amount: euro(refunds.lostShareCents),
                  })})`
                : ""}
              :
            </Muted>
            {refunds.recent.length === 0 ? (
              <Muted style={{ fontSize: "0.85rem" }}>{t("noRefunds")}</Muted>
            ) : (
              refunds.recent.map((refund) => (
                <KeyRow key={refund.id}>
                  <code>−{euro(refund.creatorShareCents)}</code>
                  <span>{refund.courseTitle}</span>
                  <span className="meta">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(refund.createdAt))}
                    {refund.reason ? ` · „${refund.reason}"` : ""}
                  </span>
                </KeyRow>
              ))
            )}
          </div>
        </Card>

        <Card
          as="section"
          aria-labelledby="embed-title"
          style={{ marginTop: "1.5rem" }}
        >
          <CardTitle id="embed-title">{t("embedTitle")}</CardTitle>
          <Muted style={{ fontSize: "0.9rem" }}>{t("embedIntro")}</Muted>
          <Muted style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
            {t("shopNote")}
          </Muted>

          {courses.length === 0 ? (
            <Muted style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
              {t("noCourses")}
            </Muted>
          ) : (
            courses.map((course) => (
              <EmbedRow key={course.slug}>
                <strong>{course.title}</strong>
                <CodeBlock>{embedCode(course.slug)}</CodeBlock>
                <CopyButton
                  onClick={() => copyText(embedCode(course.slug), course.slug)}
                >
                  {copied === course.slug ? t("copied") : t("copy")}
                </CopyButton>
              </EmbedRow>
            ))
          )}
        </Card>
      </Container>
    </Wrap>
  );
}
