"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import { TransitionLink } from "@/components/navigation/TransitionLink";
import { averageBestScores, formatLearningTime } from "@elearning/core/stats";
import { refundEnrollment } from "@/app/actions/refund-actions";
import { Modal } from "@/components/ui/Modal";
import { FormAlert } from "@/components/auth/AuthShell";
import {
  Badge,
  Card,
  Container,
  DangerButton,
  Kicker,
  Muted,
  SectionTitle,
} from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatTile, TileGrid } from "@/components/charts/StatTile";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import {
  LearningGreeting,
  type GreetingContinueItem,
  type GreetingWeekDay,
} from "./LearningGreeting";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Grid = styled.div`
  display: grid;
  gap: 1.25rem;
  margin-top: 2.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const ItemCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  overflow: hidden;

  h2 {
    font-size: 1.25rem;
  }

  a.course {
    color: inherit;
    text-decoration: none;

    &:hover {
      color: ${({ theme }) => theme.colors.accent};
    }
  }
`;

const CardCover = styled.div`
  /* volle Kartenbreite trotz Karten-Padding (Card: 1.5rem) */
  margin: -1.5rem -1.5rem 0;
  position: relative;
  /* fester 16:9-Rahmen – Bezugsrahmen für next/image mit fill */
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bgElevated};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  img {
    object-fit: cover;
    transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  ${ItemCard}:hover & img {
    transform: scale(1.04);
  }

  @media (prefers-reduced-motion: reduce) {
    img,
    ${ItemCard}:hover & img {
      transition: none;
      transform: none;
    }
  }
`;

/**
 * Hover-Overlay über dem Cover: "Anfangen" bzw. "Weiterlernen". Blendet
 * sich beim Hovern der Karte oder per Tastatur-Fokus ein; auf Touch-Geräten
 * (kein Hover) ist der Button dauerhaft dezent sichtbar.
 */
const CoverAction = styled(TransitionLink)`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-decoration: none;
  background: linear-gradient(
    to top,
    rgba(7, 8, 15, 0.75),
    rgba(7, 8, 15, 0.35) 55%,
    rgba(7, 8, 15, 0.1)
  );
  opacity: 0;
  transition: opacity 220ms ease;

  span {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 1.5rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 12px 32px rgba(200, 255, 77, 0.28);
    transform: translateY(10px) scale(0.96);
    transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  ${ItemCard}:hover &,
  &:focus-visible {
    opacity: 1;

    span {
      transform: translateY(0) scale(1);
    }
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -2px;
  }

  /* Ohne Hover (Touch): dauerhaft sichtbar, Button unten statt mittig */
  @media (hover: none) {
    opacity: 1;
    place-items: end center;
    padding-bottom: 0.9rem;
    background: linear-gradient(to top, rgba(7, 8, 15, 0.65), transparent 50%);

    span {
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    span {
      transition: none;
      transform: none;
    }
  }
`;

/* Rückgabe: dezenter Text-Button unter der Karte */
const RefundLink = styled.button`
  align-self: flex-start;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textFaint};
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: ${({ theme }) => theme.colors.danger};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const ReasonInput = styled.textarea`
  width: 100%;
  min-height: 90px;
  resize: vertical;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.75rem 0.9rem;
  font-size: 0.92rem;
  line-height: 1.5;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

interface MyLearningItem {
  slug: string;
  courseId: string;
  title: string;
  creatorName: string;
  coverImage: string | null;
  watchPercent: number;
  certificateSerial: string | null;
  /** Ende der 30-Tage-Rückgabegarantie; null = keine Rückgabe (mehr) möglich */
  refundableUntil: string | null;
}

interface MyLearningStats {
  totalWatchedSeconds: number;
  attempts: { quizId: string; scorePercent: number }[];
  certificateCount: number;
}

interface MyLearningGreeting {
  userName: string | null;
  streak: number;
  week: GreetingWeekDay[];
  dueCards: number;
  continueItem: GreetingContinueItem | null;
}

export function MyLearningView({
  items,
  stats,
  greeting,
}: {
  items: MyLearningItem[];
  stats: MyLearningStats;
  greeting: MyLearningGreeting;
}) {
  const tNav = useTranslations("nav");
  const t = useTranslations("learn");
  const tCatalog = useTranslations("catalog");
  const tStats = useTranslations("myStats");
  const tRefund = useTranslations("refund");
  const locale = useLocale();
  const router = useRouter();

  // Rückgabe-Dialog: gewählter Kurs + optionaler Grund
  const [refundItem, setRefundItem] = useState<MyLearningItem | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

  function openRefund(item: MyLearningItem) {
    setRefundItem(item);
    setRefundReason("");
    setRefundError(null);
  }

  async function onRefund() {
    if (!refundItem || refunding) return;
    setRefunding(true);
    setRefundError(null);
    const result = await refundEnrollment({
      courseId: refundItem.courseId,
      reason: refundReason,
    });
    setRefunding(false);
    if (!result.ok) {
      setRefundError(result.error ?? "generic");
      return;
    }
    setRefundItem(null);
    router.refresh();
  }

  const avgScore = averageBestScores(stats.attempts);
  const overallProgress =
    items.length > 0
      ? Math.round(
          items.reduce((sum, i) => sum + i.watchPercent, 0) / items.length
        )
      : null;

  return (
    <Wrap id="main">
      <Container>
        <Kicker>LearnSphere</Kicker>
        <SectionTitle as="h1">{tNav("myLearning")}</SectionTitle>

        {items.length > 0 ? <LearningGreeting {...greeting} /> : null}

        {items.length > 0 ? (
          <TileGrid style={{ marginTop: "2rem" }}>
            <StatTile
              label={tStats("learningTime")}
              value={<em>{formatLearningTime(stats.totalWatchedSeconds)}</em>}
            />
            <StatTile
              label={tStats("avgScore")}
              value={
                avgScore !== null
                  ? `${avgScore.toLocaleString(locale)} %`
                  : "–"
              }
            />
            <StatTile
              label={tStats("overallProgress")}
              value={overallProgress !== null ? `${overallProgress} %` : "–"}
            />
            <StatTile
              label={tStats("certificates")}
              value={stats.certificateCount}
            />
          </TileGrid>
        ) : null}

        {items.length === 0 ? (
          <Muted style={{ marginTop: "2rem" }}>{tCatalog("empty")}</Muted>
        ) : (
          <Grid>
            {items.map((item) => {
              const actionLabel =
                item.watchPercent > 0
                  ? t("continueCourse")
                  : t("startCourse");
              return (
              <ItemCard key={item.slug} as="article">
                <CardCover>
                  {item.coverImage ? (
                    <Image
                      src={item.coverImage}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                  ) : (
                    <CoverPlaceholder />
                  )}
                  <CoverAction
                    href={{
                      pathname: "/learn/[slug]",
                      params: { slug: item.slug },
                    }}
                    aria-label={`${actionLabel}: ${item.title}`}
                  >
                    <span aria-hidden>
                      {item.watchPercent > 0 ? "▶" : "✦"} {actionLabel}
                    </span>
                  </CoverAction>
                </CardCover>
                <h2>
                  <Link
                    className="course"
                    href={{
                      pathname: "/learn/[slug]",
                      params: { slug: item.slug },
                    }}
                  >
                    {item.title}
                  </Link>
                </h2>
                <Muted style={{ fontSize: "0.85rem" }}>
                  {tCatalog("by", { name: item.creatorName })}
                </Muted>
                <ProgressBar
                  percent={item.watchPercent}
                  label={t("progress")}
                />
                <Muted style={{ fontSize: "0.82rem" }}>
                  {t("watched", { percent: Math.round(item.watchPercent) })}
                </Muted>
                {item.certificateSerial ? (
                  <div>
                    <Badge $tone="success">{t("examPassedBadge")}</Badge>
                  </div>
                ) : null}
                {item.refundableUntil ? (
                  <RefundLink type="button" onClick={() => openRefund(item)}>
                    {tRefund("openButton", {
                      date: new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(new Date(item.refundableUntil)),
                    })}
                  </RefundLink>
                ) : null}
              </ItemCard>
              );
            })}
          </Grid>
        )}

        <Modal
          open={refundItem !== null}
          title={tRefund("modalTitle")}
          closeLabel={tRefund("cancel")}
          onClose={() => {
            if (!refunding) setRefundItem(null);
          }}
        >
          <p style={{ fontWeight: 600 }}>{refundItem?.title}</p>
          <p>{tRefund("modalText")}</p>
          <div>
            <label
              htmlFor="refund-reason"
              style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.88rem" }}
            >
              {tRefund("reasonLabel")}
            </label>
            <ReasonInput
              id="refund-reason"
              maxLength={2000}
              placeholder={tRefund("reasonPlaceholder")}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            />
            <Muted style={{ fontSize: "0.78rem", marginTop: "0.3rem" }}>
              {tRefund("reasonOptional")}
            </Muted>
          </div>
          {refundError ? (
            <FormAlert $tone="error" role="alert">
              {refundError === "guarantee_expired"
                ? tRefund("errorExpired")
                : refundError === "refund_via_store"
                  ? tRefund("errorStore")
                  : tRefund("errorGeneric")}
            </FormAlert>
          ) : null}
          <div>
            <DangerButton type="button" disabled={refunding} onClick={onRefund}>
              {refunding ? tRefund("busy") : tRefund("confirmButton")}
            </DangerButton>
          </div>
        </Modal>
      </Container>
    </Wrap>
  );
}
