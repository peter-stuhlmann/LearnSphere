"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { TransitionLink } from "@/components/navigation/TransitionLink";
import { Muted, PrimaryButton } from "@/components/ui/primitives";

const Band = styled(motion.section)`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    radial-gradient(
      circle at 12% 0%,
      rgba(200, 255, 77, 0.09),
      transparent 50%
    ),
    radial-gradient(
      circle at 88% 100%,
      rgba(167, 139, 250, 0.09),
      transparent 55%
    ),
    ${({ theme }) => theme.colors.surface};
  padding: 1.75rem;
  margin-top: 1.5rem;
  display: grid;
  gap: 1.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1.4fr 1fr;
    align-items: center;
    padding: 2rem 2.25rem;
  }
`;

const Hello = styled.div`
  h2 {
    font-size: clamp(1.35rem, 4vw, 1.9rem);
    line-height: 1.2;
    margin-bottom: 0.35rem;
  }
`;

const StreakRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
`;

const Flame = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.9rem;

  strong {
    font-size: 1.35rem;
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Week = styled.div`
  display: inline-flex;
  gap: 0.35rem;
`;

const Dot = styled.span<{ $active: boolean; $today: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.bgElevated};
  border: 1px solid
    ${({ theme, $active, $today }) =>
      $active
        ? theme.colors.accent
        : $today
          ? theme.colors.borderStrong
          : theme.colors.border};
  box-shadow: ${({ $active }) =>
    $active ? "0 0 10px rgba(200, 255, 77, 0.45)" : "none"};
`;

const ActionCards = styled.div`
  display: grid;
  gap: 0.85rem;
`;

const ContinueCard = styled(TransitionLink)`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 0.8rem 1rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 160ms ease, transform 160ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`;

const Thumb = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 84px;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};

  img {
    object-fit: cover;
  }
`;

const ContinueText = styled.div`
  min-width: 0;

  p.kicker {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${({ theme }) => theme.colors.accent};
    margin-bottom: 0.15rem;
  }

  p.title {
    font-weight: 600;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p.sub {
    font-size: 0.78rem;
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const ReviewCard = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.8rem 1rem;

  p {
    font-size: 0.9rem;
  }
`;

export interface GreetingWeekDay {
  day: string;
  active: boolean;
}

export interface GreetingContinueItem {
  slug: string;
  courseTitle: string;
  lessonTitle: string | null;
  coverImage: string | null;
  watchPercent: number;
}

interface LearningGreetingProps {
  userName: string | null;
  streak: number;
  week: GreetingWeekDay[];
  dueCards: number;
  continueItem: GreetingContinueItem | null;
}

/** Tageszeit-abhängige Begrüßung (nur Anzeige – kein hydration-kritischer Inhalt). */
function greetingKey(hour: number): "morning" | "day" | "evening" {
  if (hour < 11) return "morning";
  if (hour < 18) return "day";
  return "evening";
}

/**
 * Persönliche Begrüßung oben in "Mein Lernen": Streak mit Wochenleiste,
 * "Weiterlernen"-Karte mit Cover und fällige Spaced-Repetition-Karten.
 */
export function LearningGreeting({
  userName,
  streak,
  week,
  dueCards,
  continueItem,
}: LearningGreetingProps) {
  const t = useTranslations("greeting");
  const tReview = useTranslations("review");
  const locale = useLocale();
  const reducedMotion = useReducedMotion();

  const firstName = userName?.split(" ")[0] ?? null;
  const key = greetingKey(new Date().getHours());

  return (
    <Band
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Hello>
        {/* Tageszeit kann zwischen Server und Client abweichen – unkritisch */}
        <h2 suppressHydrationWarning>
          {firstName ? t(`${key}Name`, { name: firstName }) : t(key)}
        </h2>
        <Muted>{t("subline")}</Muted>
        <StreakRow>
          <Flame aria-label={t("streakAria", { days: streak })}>
            <span aria-hidden>🔥</span>
            <strong>{streak}</strong>
            {t("streakUnit", { days: streak })}
          </Flame>
          <Week aria-hidden>
            {week.map((day, index) => (
              <Dot
                key={day.day}
                $active={day.active}
                $today={index === week.length - 1}
                title={new Intl.DateTimeFormat(locale, {
                  weekday: "short",
                }).format(new Date(`${day.day}T12:00:00Z`))}
              />
            ))}
          </Week>
          <Muted style={{ fontSize: "0.78rem" }}>
            {t("weekLabel", {
              days: week.filter((day) => day.active).length,
            })}
          </Muted>
        </StreakRow>
      </Hello>

      <ActionCards>
        {continueItem ? (
          <ContinueCard
            href={{
              pathname: "/learn/[slug]",
              params: { slug: continueItem.slug },
            }}
          >
            <Thumb aria-hidden>
              {continueItem.coverImage ? (
                <Image
                  src={continueItem.coverImage}
                  alt=""
                  fill
                  sizes="84px"
                />
              ) : null}
            </Thumb>
            <ContinueText>
              <p className="kicker">▶ {t("continueKicker")}</p>
              <p className="title">
                {continueItem.lessonTitle ?? continueItem.courseTitle}
              </p>
              <p className="sub">
                {continueItem.courseTitle} ·{" "}
                {Math.round(continueItem.watchPercent)} %
              </p>
            </ContinueText>
          </ContinueCard>
        ) : null}

        <ReviewCard>
          <p>
            {dueCards > 0
              ? t("dueCards", { count: dueCards })
              : t("noDueCards")}
          </p>
          <Link href="/review">
            <PrimaryButton as="span" style={{ whiteSpace: "nowrap" }}>
              🧠 {tReview("title")}
            </PrimaryButton>
          </Link>
        </ReviewCard>
      </ActionCards>
    </Band>
  );
}
