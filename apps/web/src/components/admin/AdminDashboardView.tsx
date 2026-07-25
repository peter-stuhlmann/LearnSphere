"use client";

import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@elearning/core/format";
import { Card, Muted } from "@/components/ui/primitives";

const Grid = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
`;

const Stat = styled(Card)`
  padding: 1.2rem 1.4rem;

  p:first-child {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${({ theme }) => theme.colors.textFaint};
  }

  p:last-of-type {
    margin-top: 0.35rem;
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: 1.9rem;
  }
`;

const SectionTitle = styled.h2`
  margin: 1.8rem 0 0.8rem;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const AlertCard = styled(Card)<{ $tone: "warn" | "ok" }>`
  margin-top: 1.5rem;
  padding: 1.2rem 1.4rem;
  border-color: ${({ $tone }) =>
    $tone === "warn" ? "rgba(255, 184, 77, 0.55)" : undefined};

  a {
    color: #ffb84d;
    text-underline-offset: 3px;
  }
`;

export interface AdminStats {
  userCount: number;
  creatorCount: number;
  courseCount: number;
  publishedCount: number;
  flaggedCourseCount: number;
  enrollmentCount: number;
  revenueCents: number;
  flaggedMediaCount: number;
  pendingMediaCount: number;
  businessLicenseCount: number;
  businessSeatCount: number;
  businessRevenueCents: number;
  businessLearnsphereCents: number;
}

export function AdminDashboardView({ stats }: { stats: AdminStats }) {
  const t = useTranslations("admin");
  const locale = useLocale();

  // Business-Einnahmen bewusst getrennt von den Kurskauf-Kennzahlen
  const businessCards: { label: string; value: string }[] = [
    {
      label: t("statBusinessLicenses"),
      value: String(stats.businessLicenseCount),
    },
    { label: t("statBusinessSeats"), value: String(stats.businessSeatCount) },
    {
      label: t("statBusinessRevenue"),
      value: formatPrice(stats.businessRevenueCents, "EUR", locale),
    },
    {
      label: t("statBusinessShare"),
      value: formatPrice(stats.businessLearnsphereCents, "EUR", locale),
    },
  ];

  const cards: { label: string; value: string }[] = [
    { label: t("statUsers"), value: String(stats.userCount) },
    { label: t("statCreators"), value: String(stats.creatorCount) },
    {
      label: t("statCourses"),
      value: `${stats.publishedCount} / ${stats.courseCount}`,
    },
    { label: t("statEnrollments"), value: String(stats.enrollmentCount) },
    {
      label: t("statRevenue"),
      value: formatPrice(stats.revenueCents, "EUR", locale),
    },
    { label: t("statFlaggedCourses"), value: String(stats.flaggedCourseCount) },
  ];

  return (
    <>
      <Grid>
        {cards.map((card) => (
          <Stat key={card.label}>
            <p>{card.label}</p>
            <p>{card.value}</p>
          </Stat>
        ))}
      </Grid>

      <SectionTitle>{t("businessSectionTitle")}</SectionTitle>
      <Grid>
        {businessCards.map((card) => (
          <Stat key={card.label}>
            <p>{card.label}</p>
            <p>{card.value}</p>
          </Stat>
        ))}
      </Grid>

      <AlertCard $tone={stats.flaggedMediaCount > 0 ? "warn" : "ok"}>
        {stats.flaggedMediaCount > 0 ? (
          <p>
            ⚠️{" "}
            {t("moderationAlert", { count: stats.flaggedMediaCount })}{" "}
            <Link href="/admin/moderation">{t("moderationAlertLink")}</Link>
          </p>
        ) : (
          <p>✅ {t("moderationAllClear")}</p>
        )}
        {stats.pendingMediaCount > 0 ? (
          <Muted style={{ marginTop: "0.4rem", fontSize: "0.85rem" }}>
            {t("moderationPendingInfo", { count: stats.pendingMediaCount })}
          </Muted>
        ) : null}
      </AlertCard>
    </>
  );
}
