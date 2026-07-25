"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@elearning/core/format";
import { openApiBillingPortal } from "@/app/actions/billing-actions";
import {
  Badge,
  Card,
  Container,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Section = styled(Card)`
  margin-top: 1.5rem;

  h2 {
    font-size: 1.25rem;
    margin-bottom: 0.35rem;
  }
`;

const FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin: 1.1rem 0;
`;

const DateField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};

  input {
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.pill};
    padding: 0.5rem 0.9rem;
    font-size: 0.88rem;
    color: ${({ theme }) => theme.colors.text};
    color-scheme: dark;

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      outline-offset: 0;
      border-color: transparent;
    }
  }
`;

/* Tabelle mit horizontalem Scroll ab 320 px – Beträge rechtsbündig in Mono */
const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;

  th,
  td {
    text-align: left;
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  }

  th {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${({ theme }) => theme.colors.textFaint};
  }

  td.amount,
  th.amount {
    text-align: right;
    font-family: ${({ theme }) => theme.fonts.mono};
  }

  td.action {
    text-align: right;
  }
`;

const DownloadLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

type InvoiceSort = "dateDesc" | "dateAsc" | "amountDesc" | "amountAsc";

interface InvoiceRow {
  enrollmentId: string;
  /** Kaufdatum (ISO) */
  date: string;
  courseTitle: string;
  amountCents: number;
  currency: string;
}

interface PayoutRow {
  id: string;
  /** Auszahlungs- bzw. Antragsdatum (ISO) */
  date: string;
  amountCents: number;
  paid: boolean;
}

interface BusinessLicenseRow {
  id: string;
  courseTitle: string;
  seats: number;
  /** Einmalig gezahlter Gesamtbetrag in Cent */
  totalPaidCents: number;
  active: boolean;
  /** Kaufdatum (ISO) */
  date: string;
}

interface BillingViewProps {
  invoices: InvoiceRow[];
  businessLicenses: BusinessLicenseRow[];
  payouts: PayoutRow[];
  subscription: {
    status: "ACTIVE" | "PAST_DUE" | "CANCELED" | null;
    interval: "MONTH" | "YEAR" | null;
    hasStripeCustomer: boolean;
    stripeEnabled: boolean;
    /** Admin: Betreiber-Zugang ohne Abo */
    complimentary: boolean;
  };
}

export function BillingView({
  invoices,
  businessLicenses,
  payouts,
  subscription,
}: BillingViewProps) {
  const t = useTranslations("billing");
  const locale = useLocale();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<InvoiceSort>("dateDesc");
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState(false);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale]
  );

  const filtered = useMemo(() => {
    /* Zeitraum-Filter: "bis" schließt den gewählten Tag ein */
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    const rows = invoices.filter((row) => {
      const time = new Date(row.date).getTime();
      if (fromTime !== null && time < fromTime) return false;
      if (toTime !== null && time > toTime) return false;
      return true;
    });
    return rows.sort((a, b) => {
      switch (sort) {
        case "dateAsc":
          return a.date.localeCompare(b.date);
        case "amountDesc":
          return b.amountCents - a.amountCents;
        case "amountAsc":
          return a.amountCents - b.amountCents;
        default:
          return b.date.localeCompare(a.date);
      }
    });
  }, [invoices, from, to, sort]);

  async function onOpenPortal() {
    setPortalPending(true);
    setPortalError(false);
    const result = await openApiBillingPortal({ locale });
    setPortalPending(false);
    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    setPortalError(true);
  }

  const sortLabels: Record<InvoiceSort, string> = {
    dateDesc: t("sortDateDesc"),
    dateAsc: t("sortDateAsc"),
    amountDesc: t("sortAmountDesc"),
    amountAsc: t("sortAmountAsc"),
  };

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        <Section as="section" aria-labelledby="invoices-title">
          <h2 id="invoices-title">{t("invoicesTitle")}</h2>
          <Muted style={{ fontSize: "0.88rem" }}>{t("invoicesHint")}</Muted>

          {invoices.length === 0 ? (
            <Muted style={{ marginTop: "1.25rem" }}>
              {t("invoicesEmpty")}
            </Muted>
          ) : (
            <>
              <FilterRow>
                <DateField>
                  {t("filterFrom")}
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </DateField>
                <DateField>
                  {t("filterTo")}
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </DateField>
                <Select
                  inline
                  pill
                  ariaLabel={t("sortLabel")}
                  value={sort}
                  options={(
                    ["dateDesc", "dateAsc", "amountDesc", "amountAsc"] as const
                  ).map((value) => ({ value, label: sortLabels[value] }))}
                  onChange={(value) => setSort(value as InvoiceSort)}
                />
                {from || to ? (
                  <GhostButton
                    type="button"
                    style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}
                    onClick={() => {
                      setFrom("");
                      setTo("");
                    }}
                  >
                    {t("filterReset")}
                  </GhostButton>
                ) : null}
              </FilterRow>

              <Muted
                role="status"
                aria-live="polite"
                style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}
              >
                {t("resultCount", { count: filtered.length })}
              </Muted>

              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th>{t("colDate")}</th>
                      <th>{t("colCourse")}</th>
                      <th className="amount">{t("colAmount")}</th>
                      <th aria-label={t("colActions")} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.enrollmentId}>
                        <td>{dateFormat.format(new Date(row.date))}</td>
                        <td style={{ whiteSpace: "normal" }}>
                          {row.courseTitle}
                        </td>
                        <td className="amount">
                          {formatPrice(row.amountCents, row.currency, locale)}
                        </td>
                        <td className="action">
                          <DownloadLink
                            href={`/api/billing/invoice/${row.enrollmentId}?lang=${locale}`}
                            download
                          >
                            ⤓ {t("downloadPdf")}
                          </DownloadLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </>
          )}
        </Section>

        {businessLicenses.length > 0 ? (
          <Section as="section" aria-labelledby="business-invoices-title">
            <h2 id="business-invoices-title">{t("businessTitle")}</h2>
            <Muted style={{ fontSize: "0.88rem", marginBottom: "0.75rem" }}>
              {t("businessHint")}
            </Muted>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th>{t("colDate")}</th>
                    <th>{t("colCourse")}</th>
                    <th>{t("colStatus")}</th>
                    <th aria-label={t("colActions")} />
                  </tr>
                </thead>
                <tbody>
                  {businessLicenses.map((license) => (
                    <tr key={license.id}>
                      <td>{dateFormat.format(new Date(license.date))}</td>
                      <td style={{ whiteSpace: "normal" }}>
                        {license.courseTitle} ·{" "}
                        {t("businessSeats", { count: license.seats })} ·{" "}
                        {formatPrice(license.totalPaidCents, "EUR", locale)}
                      </td>
                      <td>
                        <Badge $tone={license.active ? "success" : "muted"}>
                          {license.active
                            ? t("businessActive")
                            : t("businessEnded")}
                        </Badge>
                      </td>
                      <td className="action">
                        <DownloadLink
                          href={`/api/billing/business/${license.id}?lang=${locale}`}
                          download
                        >
                          ⤓ {t("downloadPdf")}
                        </DownloadLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Section>
        ) : null}

        {payouts.length > 0 ? (
          <Section as="section" aria-labelledby="payouts-title">
            <h2 id="payouts-title">{t("payoutsTitle")}</h2>
            <Muted style={{ fontSize: "0.88rem", marginBottom: "0.75rem" }}>
              {t("payoutsHint")}
            </Muted>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th>{t("colDate")}</th>
                    <th>{t("colStatus")}</th>
                    <th className="amount">{t("colAmount")}</th>
                    <th aria-label={t("colActions")} />
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td>{dateFormat.format(new Date(payout.date))}</td>
                      <td>
                        <Badge $tone={payout.paid ? "success" : "muted"}>
                          {payout.paid ? t("statusPaid") : t("statusRequested")}
                        </Badge>
                      </td>
                      <td className="amount">
                        {formatPrice(payout.amountCents, "EUR", locale)}
                      </td>
                      <td className="action">
                        {payout.paid ? (
                          <DownloadLink
                            href={`/api/billing/payout/${payout.id}?lang=${locale}`}
                            download
                          >
                            ⤓ {t("downloadPdf")}
                          </DownloadLink>
                        ) : (
                          <Muted as="span" style={{ fontSize: "0.8rem" }}>
                            {t("receiptAfterPayout")}
                          </Muted>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Section>
        ) : null}

        <Section as="section" aria-labelledby="subscription-title">
          <h2 id="subscription-title">{t("subscriptionTitle")}</h2>
          {subscription.complimentary ? (
            <Muted style={{ fontSize: "0.88rem" }}>
              {t("subscriptionComplimentary")}
            </Muted>
          ) : subscription.status ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  flexWrap: "wrap",
                  margin: "0.75rem 0 0.35rem",
                }}
              >
                <Badge
                  $tone={
                    subscription.status === "ACTIVE"
                      ? "success"
                      : subscription.status === "PAST_DUE"
                        ? "muted"
                        : "muted"
                  }
                >
                  {t(`subscriptionStatus.${subscription.status}`)}
                </Badge>
                {subscription.interval ? (
                  <Muted as="span" style={{ fontSize: "0.88rem" }}>
                    {subscription.interval === "YEAR"
                      ? t("subscriptionYearly")
                      : t("subscriptionMonthly")}
                  </Muted>
                ) : null}
              </div>
              <Muted style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
                {t("subscriptionHint")}
              </Muted>
              {subscription.stripeEnabled && subscription.hasStripeCustomer ? (
                <PrimaryButton
                  type="button"
                  disabled={portalPending}
                  onClick={() => void onOpenPortal()}
                >
                  {portalPending
                    ? t("subscriptionPortalBusy")
                    : t("subscriptionManage")}
                </PrimaryButton>
              ) : (
                <Muted style={{ fontSize: "0.85rem" }}>
                  {t("subscriptionNoPortal")}
                </Muted>
              )}
              {portalError ? (
                <Muted
                  role="alert"
                  style={{ marginTop: "0.6rem", color: "#FF7A7A" }}
                >
                  {t("subscriptionPortalError")}
                </Muted>
              ) : null}
            </>
          ) : (
            <>
              <Muted style={{ fontSize: "0.88rem", marginBottom: "1rem" }}>
                {t("subscriptionNone")}
              </Muted>
              <GhostButton as={Link} href="/creator/distribution">
                {t("subscriptionDiscover")}
              </GhostButton>
            </>
          )}
        </Section>
      </Container>
    </Wrap>
  );
}
