"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import { markPayoutPaid, retryPayoutTransfer } from "@/app/actions/admin-actions";
import { maskIban } from "@elearning/core/payout";
import { formatMoney } from "@elearning/core/format";
import { Badge, Card, GhostButton, Muted } from "@/components/ui/primitives";
import { FormAlert } from "@/components/auth/AuthShell";

const TableWrap = styled(Card)`
  padding: 0;
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  th,
  td {
    text-align: left;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  }

  th {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${({ theme }) => theme.colors.textFaint};
  }

  tbody tr:hover {
    background: ${({ theme }) => theme.colors.bgElevated};
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }
`;

export interface AdminPayout {
  id: string;
  amountCents: number;
  status: "REQUESTED" | "PAID";
  holder: string;
  iban: string;
  createdAt: string;
  paidAt: string | null;
  userEmail: string;
  userName: string;
  /** Stripe Connect verbunden → automatischer Transfer möglich */
  connectReady: boolean;
}

export function AdminPayoutsView({ payouts }: { payouts: AdminPayout[] }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = payouts.filter((payout) => payout.status === "REQUESTED");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(
          result.error === "transfer_failed"
            ? t("payoutTransferFailed")
            : (result.error ?? "generic")
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="admin-payouts-title">
      <h2 id="admin-payouts-title" style={{ fontSize: "1.2rem" }}>
        {t("payoutsTitle")}
      </h2>
      <Muted style={{ margin: "0.5rem 0 1.25rem", fontSize: "0.9rem" }}>
        {t("payoutsIntro", { open: open.length })}
      </Muted>

      {error ? (
        <FormAlert $tone="error" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </FormAlert>
      ) : null}

      {payouts.length === 0 ? (
        <Muted>{t("payoutsEmpty")}</Muted>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("payoutCreator")}</th>
                <th scope="col">{t("payoutAmount")}</th>
                <th scope="col">{t("payoutBank")}</th>
                <th scope="col">{t("payoutRequestedAt")}</th>
                <th scope="col">{t("payoutStatus")}</th>
                <th scope="col">{t("payoutActions")}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td>
                    {payout.userName}
                    <Muted style={{ fontSize: "0.78rem" }}>
                      {payout.userEmail}
                    </Muted>
                  </td>
                  <td>
                    <strong>
                      {formatMoney(payout.amountCents, "EUR", locale)}
                    </strong>
                  </td>
                  <td>
                    {payout.holder}
                    <Muted style={{ fontSize: "0.78rem" }}>
                      {maskIban(payout.iban)}
                    </Muted>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(payout.createdAt))}
                  </td>
                  <td>
                    <Badge
                      $tone={payout.status === "PAID" ? "success" : "violet"}
                    >
                      {payout.status === "PAID"
                        ? t("payoutPaid")
                        : t("payoutOpen")}
                    </Badge>
                  </td>
                  <td>
                    {payout.status === "REQUESTED" ? (
                      <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                        {payout.connectReady ? (
                          <GhostButton
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                retryPayoutTransfer({ payoutId: payout.id })
                              )
                            }
                          >
                            {t("payoutViaStripe")}
                          </GhostButton>
                        ) : null}
                        <GhostButton
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => markPayoutPaid({ payoutId: payout.id }))
                          }
                        >
                          ✓ {t("payoutMarkPaid")}
                        </GhostButton>
                      </span>
                    ) : payout.paidAt ? (
                      <Muted style={{ fontSize: "0.8rem" }}>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(payout.paidAt))}
                      </Muted>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </section>
  );
}
