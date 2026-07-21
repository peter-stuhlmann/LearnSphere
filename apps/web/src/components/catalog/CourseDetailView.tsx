"use client";

import Image from "next/image";
import {
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import {
  addToCart,
  getCartItems,
  getCartServerSnapshot,
  subscribeCart,
} from "@/components/cart/cartStore";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { languageDisplayName } from "@elearning/core/course-i18n";
import styled from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import { TransitionLink } from "@/components/navigation/TransitionLink";
import { courseTransitionName } from "@/components/navigation/view-transition";
import { checkCoupon, enroll } from "@/app/actions/learning-actions";
import { startCourseCheckout } from "@/app/actions/billing-actions";
import { formatDuration, formatPrice } from "@elearning/core/format";
import {
  BlockRenderer,
  type RenderableBlock,
} from "@/components/learn/BlockRenderer";
import { RichText } from "@/components/ui/RichText";
import {
  Badge,
  Card,
  Container,
  GhostButton,
  Kicker,
  PrimaryButton,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/AuthShell";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Layout = styled.div`
  display: grid;
  gap: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr 340px;
    align-items: start;
  }
`;

const Title = styled.h1`
  font-size: clamp(2rem, 6vw, 3.4rem);
  margin-top: 0.5rem;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.1rem;
  margin-top: 1rem;
  max-width: 60ch;
`;

const Creator = styled.p`
  margin-top: 0.75rem;
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/* ---------- Sterne-Anzeige (Ø-Bewertung), mit anteiliger Füllung ---------- */

const RatingRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.75rem;
  font-size: 0.9rem;

  strong {
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const StarsShell = styled.span`
  position: relative;
  display: inline-block;
  line-height: 1;
  font-size: 1.02rem;
  letter-spacing: 2px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/* füllt die Sterne anteilig (z. B. 4,3/5 → 86 % Breite) */
const StarsFill = styled.span<{ $percent: number }>`
  position: absolute;
  inset: 0;
  width: ${({ $percent }) => $percent}%;
  overflow: hidden;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.accent};
  text-shadow: 0 0 12px rgba(200, 255, 77, 0.4);
`;

const RatingCount = styled.span`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** Ø-Bewertung als anteilig gefüllte Sterne (Screenreader: nur das Label). */
function Stars({ average, label }: { average: number; label: string }) {
  return (
    <StarsShell role="img" aria-label={label}>
      <span aria-hidden>☆☆☆☆☆</span>
      <StarsFill aria-hidden $percent={(average / 5) * 100}>
        ★★★★★
      </StarsFill>
    </StarsShell>
  );
}

/* Kurssprachen ausgeschrieben als dezente Chips statt Kürzel im Kicker */
const LangRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
`;

const LangChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textMuted};

  svg {
    width: 13px;
    height: 13px;
    color: ${({ theme }) => theme.colors.violet};
  }
`;

const LangOriginal = styled.em`
  font-style: normal;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.1rem 0.4rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.violetSoft};
  color: ${({ theme }) => theme.colors.violet};
`;

const Description = styled.div`
  margin-top: 2.5rem;

  h2 {
    font-size: 1.4rem;
    margin-bottom: 0.75rem;
  }

  p {
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: pre-wrap;
  }
`;

const Curriculum = styled.section`
  margin-top: 2.5rem;

  h2 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
  }
`;

/* Drip Content: kleiner Hinweis-Chip im Abschnittstitel des Curriculums */
const DripChip = styled.span`
  margin-left: auto;
  align-self: center;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.68rem;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textFaint};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.15rem 0.55rem;
  white-space: nowrap;

  & + & {
    margin-left: 0.35rem;
  }
`;

const SectionBlock = styled.details`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  margin-bottom: 0.6rem;
  overflow: hidden;

  summary {
    cursor: pointer;
    padding: 1rem 1.2rem;
    font-weight: 600;
    background: ${({ theme }) => theme.colors.surface};
    list-style: none;
    display: flex;
    justify-content: space-between;
    gap: 1rem;

    &::after {
      content: "+";
      color: ${({ theme }) => theme.colors.accent};
      font-family: ${({ theme }) => theme.fonts.mono};
    }
  }

  &[open] summary::after {
    content: "–";
  }
`;

const LessonList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0.5rem 1.2rem 1rem;

  li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    font-size: 0.92rem;
    color: ${({ theme }) => theme.colors.textMuted};
    border-bottom: 1px dashed ${({ theme }) => theme.colors.border};

    &:last-child {
      border-bottom: none;
    }
  }

  span.duration {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const CreatorSection = styled.section`
  margin-top: 2.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.5rem;

  h2 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }
`;

const CreatorHead = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const CreatorAvatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.4rem;
  background: ${({ theme }) => theme.colors.violetSoft};
  color: ${({ theme }) => theme.colors.violet};
  border: 2px solid ${({ theme }) => theme.colors.borderStrong};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const StorefrontTeaser = styled(Link)`
  display: inline-block;
  margin-top: 1rem;
  color: ${({ theme }) => theme.colors.violet};
  font-size: 0.9rem;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const BuyCard = styled(Card)`
  position: sticky;
  top: 90px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const PriceTag = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2.4rem;
  color: ${({ theme }) => theme.colors.accent};
`;

const PerkList = styled.ul`
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.textMuted};

  li::before {
    content: "✓ ";
    color: ${({ theme }) => theme.colors.success};
  }
`;

const PreviewButton = styled.button`
  color: ${({ theme }) => theme.colors.accent};
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

const PreviewStage = styled.div`
  margin: 0.75rem 0;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 1rem;
  background: ${({ theme }) => theme.colors.bgElevated};

  video {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: #000;
  }

  p.text {
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: pre-wrap;
    font-size: 0.92rem;
  }
`;

const CouponToggle = styled.button<{ $open: boolean }>`
  align-self: flex-start;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: underline;
  text-underline-offset: 3px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
    border-radius: 4px;
  }

  .chev {
    font-size: 0.6rem;
    transition: transform 180ms ease;
    transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
  }
`;

const CouponCollapse = styled(motion.div)`
  overflow: hidden;
`;

const CouponForm = styled.form`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  /* Innenabstand statt margin: bleibt Teil der animierten Höhe */
  padding-top: 0.6rem;

  > div {
    flex: 1;
  }
`;

const CouponApplied = styled.p`
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.success};

  s {
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const LoginLink = styled(TransitionLink)`
  display: block;
  text-align: center;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-weight: 600;
  padding: 0.85rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
`;

const Note = styled.p`
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * KI-Transparenzhinweis (Art. 50 EU-KI-VO): bewusst nüchtern und dezent –
 * eine Kennzeichnung, kein Werbeelement.
 */
const AiDisclosure = styled.aside`
  margin-top: 2rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: 0.78rem;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.textFaint};

  strong {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textMuted};
    margin-bottom: 0.35rem;
  }
`;

const HeroImage = styled.div`
  margin-top: 1.5rem;
  /* fester 16:9-Rahmen – Bezugsrahmen für next/image mit fill */
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border};

  img {
    object-fit: cover;
  }
`;

interface DetailLesson {
  id: string;
  title: string;
  durationSeconds: number;
  isPreview: boolean;
  blocks: RenderableBlock[];
}

interface DetailCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverImage: string | null;
  language: string;
  /** Alle Kurssprachen, Basissprache zuerst */
  languages: string[];
  priceCents: number;
  currency: string;
  requiredWatchPercent: number;
  finalExamRequired: boolean;
  creatorName: string;
  creatorImage: string | null;
  creatorHandle: string | null;
  creatorBio: string;
  /** Ø-Bewertung dieses Kurses */
  rating: { average: number | null; count: number };
  /** Ø-Bewertung über alle Kurse des Creators */
  creatorRating: { average: number | null; count: number };
  sections: {
    id: string;
    title: string;
    hasQuiz: boolean;
    /** Drip Content: frei ab Tag X nach Kauf (null = sofort) */
    dripAfterDays: number | null;
    /** Drip Content: erst nach Zwischenprüfung des vorherigen Abschnitts */
    dripAfterQuiz: boolean;
    lessons: DetailLesson[];
  }[];
}

interface CourseDetailViewProps {
  course: DetailCourse;
  isLoggedIn: boolean;
  isEnrolled: boolean;
  stripeEnabled: boolean;
  /** Kanal-Attribution: "embed"/"api" → Drittseiten-Verkauf (75 % Anteil) */
  via?: "embed" | "api";
}

export function CourseDetailView({
  course,
  isLoggedIn,
  isEnrolled,
  stripeEnabled,
  via,
}: CourseDetailViewProps) {
  const t = useTranslations("course");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const cartItems = useSyncExternalStore(
    subscribeCart,
    getCartItems,
    getCartServerSnapshot
  );
  const inCart = cartItems.some((item) => item.courseId === course.id);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    finalPriceCents: number;
  } | null>(null);

  const lessonCount = course.sections.reduce(
    (sum, s) => sum + s.lessons.length,
    0
  );
  const isFree = course.priceCents === 0;
  const effectivePriceCents =
    appliedCoupon?.finalPriceCents ?? course.priceCents;

  function onEnroll() {
    setError(null);
    startTransition(async () => {
      // Bezahlte Kurse gehen über Stripe; kostenlose (auch via 100%-Gutschein)
      // und der Demo-Modus ohne Keys nutzen die direkte Einschreibung.
      if (!isFree && effectivePriceCents > 0) {
        const checkout = await startCourseCheckout({
          courseId: course.id,
          couponCode: appliedCoupon?.code,
          locale,
          via,
        });
        if (!checkout.ok) {
          setError(checkout.error ?? "generic");
          return;
        }
        if (checkout.url) {
          window.location.href = checkout.url;
          return;
        }
        // demo: true oder bereits eingeschrieben → direkter Weg
      }

      const result = await enroll(course.id, {
        couponCode: appliedCoupon?.code,
        via,
      });
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      router.push({
        pathname: "/learn/[slug]",
        params: { slug: course.slug },
      });
    });
  }

  function onApplyCoupon(event: FormEvent) {
    event.preventDefault();
    setCouponError(null);
    startTransition(async () => {
      const result = await checkCoupon({
        courseId: course.id,
        code: couponInput,
      });
      if (!result.ok || result.finalPriceCents === undefined) {
        setAppliedCoupon(null);
        setCouponError(result.error ?? "coupon_invalid");
        return;
      }
      setAppliedCoupon({
        code: result.code ?? couponInput,
        finalPriceCents: result.finalPriceCents,
      });
    });
  }

  const previewLesson =
    course.sections
      .flatMap((s) => s.lessons)
      .find((l) => l.id === previewId) ?? null;

  return (
    <Wrap id="main">
      <Container>
        <Layout>
          <div>
            <Kicker>{tCatalog("by", { name: course.creatorName })}</Kicker>
            <Title>{course.title}</Title>
            {course.subtitle ? <Subtitle>{course.subtitle}</Subtitle> : null}
            <Creator>
              {t("sections", { count: course.sections.length })} ·{" "}
              {t("lessons", { count: lessonCount })}
            </Creator>
            {course.rating.average !== null ? (
              <RatingRow>
                <Stars
                  average={course.rating.average}
                  label={t("ratingAria", { rating: course.rating.average })}
                />
                <strong>{course.rating.average.toLocaleString(locale)}</strong>
                <RatingCount>
                  {t("ratingCount", { count: course.rating.count })}
                </RatingCount>
              </RatingRow>
            ) : (
              <RatingRow>
                <RatingCount>{t("noRatingsYet")}</RatingCount>
              </RatingRow>
            )}
            <LangRow aria-label={t("courseLanguages")}>
              {course.languages.map((lang) => (
                <LangChip key={lang}>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    aria-hidden
                  >
                    <circle cx="8" cy="8" r="6.2" />
                    <ellipse cx="8" cy="8" rx="2.8" ry="6.2" />
                    <path d="M2 8 H14 M2.8 5 H13.2 M2.8 11 H13.2" />
                  </svg>
                  {languageDisplayName(lang, locale)}
                  {lang === course.language ? (
                    <LangOriginal>{t("originalLanguage")}</LangOriginal>
                  ) : null}
                </LangChip>
              ))}
            </LangRow>

            {/* Kursbild ist optional: ohne Bild entfällt der Hero komplett
                (Karten im Katalog zeigen weiterhin den Platzhalter) */}
            {course.coverImage ? (
              <HeroImage
                style={{
                  // Ziel des Cover-Morphs aus den Kurskarten
                  viewTransitionName: courseTransitionName(course.slug),
                }}
              >
                {/* Hero = LCP-Kandidat, daher priority */}
                <Image
                  src={course.coverImage}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                />
              </HeroImage>
            ) : null}

            {course.description ? (
              <Description>
                <h2>{t("aboutCourse")}</h2>
                <RichText html={course.description} />
              </Description>
            ) : null}

            <Curriculum aria-label={t("curriculum")}>
              <h2>{t("curriculum")}</h2>
              {course.sections.map((section, i) => (
                <SectionBlock key={section.id} open={i === 0}>
                  <summary>
                    {section.title}
                    {section.hasQuiz ? " ✦" : ""}
                    {(section.dripAfterDays ?? 0) > 0 ? (
                      <DripChip>
                        ⏳ {t("dripFromDay", { day: section.dripAfterDays! })}
                      </DripChip>
                    ) : null}
                    {section.dripAfterQuiz ? (
                      <DripChip>🔒 {t("dripAfterQuiz")}</DripChip>
                    ) : null}
                  </summary>
                  <LessonList>
                    {section.lessons.map((lesson) => (
                      <li key={lesson.id} style={{ flexDirection: "column" }}>
                        <span
                          style={{
                            display: "flex",
                            width: "100%",
                            justifyContent: "space-between",
                            gap: "1rem",
                          }}
                        >
                          <span>
                            {lesson.title}{" "}
                            {lesson.isPreview ? (
                              <PreviewButton
                                type="button"
                                onClick={() =>
                                  setPreviewId(
                                    previewId === lesson.id ? null : lesson.id
                                  )
                                }
                                aria-expanded={previewId === lesson.id}
                              >
                                ▶ {previewId === lesson.id
                                  ? t("closePreview")
                                  : t("watchPreview")}
                              </PreviewButton>
                            ) : null}
                          </span>
                          {lesson.durationSeconds > 0 ? (
                            <span className="duration">
                              {formatDuration(lesson.durationSeconds)}
                            </span>
                          ) : null}
                        </span>

                        {previewLesson?.id === lesson.id ? (
                          <PreviewStage>
                            <BlockRenderer blocks={previewLesson.blocks} />
                          </PreviewStage>
                        ) : null}
                      </li>
                    ))}
                  </LessonList>
                </SectionBlock>
              ))}
            </Curriculum>

            {course.creatorBio || course.creatorRating.average !== null ? (
              <CreatorSection aria-labelledby="about-creator-title">
                <h2 id="about-creator-title">{t("aboutCreator")}</h2>
                <CreatorHead>
                  <CreatorAvatar>
                    {course.creatorImage ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
                      <img src={course.creatorImage} alt="" />
                    ) : (
                      course.creatorName.charAt(0).toUpperCase()
                    )}
                  </CreatorAvatar>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>
                      {course.creatorName}
                    </strong>
                    {course.creatorRating.average !== null ? (
                      <RatingRow style={{ marginTop: "0.25rem" }}>
                        <Stars
                          average={course.creatorRating.average}
                          label={t("ratingAria", {
                            rating: course.creatorRating.average,
                          })}
                        />
                        <strong>
                          {course.creatorRating.average.toLocaleString(locale)}
                        </strong>
                        <RatingCount>
                          {t("creatorAvgRating", {
                            count: course.creatorRating.count,
                          })}
                        </RatingCount>
                      </RatingRow>
                    ) : null}
                  </div>
                </CreatorHead>
                {course.creatorBio ? <RichText html={course.creatorBio} /> : null}
                {course.creatorHandle ? (
                  <StorefrontTeaser
                    href={{
                      pathname: "/c/[handle]",
                      params: { handle: course.creatorHandle },
                    }}
                  >
                    {t("toStorefront", { name: course.creatorName })} →
                  </StorefrontTeaser>
                ) : null}
              </CreatorSection>
            ) : null}

            <AiDisclosure aria-labelledby="ai-disclosure-title">
              <strong id="ai-disclosure-title">{t("aiNoticeTitle")}</strong>
              {t("aiNoticeText")}
            </AiDisclosure>
          </div>

          <BuyCard as="aside">
            <PriceTag>
              {formatPrice(effectivePriceCents, course.currency, locale)}
            </PriceTag>
            {appliedCoupon ? (
              <CouponApplied role="status">
                {t("couponApplied", { code: appliedCoupon.code })}{" "}
                <s>{formatPrice(course.priceCents, course.currency, locale)}</s>{" "}
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  style={{ textDecoration: "underline" }}
                >
                  {t("couponRemove")}
                </button>
              </CouponApplied>
            ) : null}
            <PerkList>
              <li>{t("certificateIncluded")}</li>
              <li>
                {t("finalExamInfo", {
                  percent: course.requiredWatchPercent,
                })}
              </li>
            </PerkList>

            {error ? (
              <FormAlert $tone="error" role="alert">
                {error === "payments_unavailable"
                  ? t("paymentsUnavailable")
                  : error}
              </FormAlert>
            ) : null}

            {isEnrolled ? (
              <>
                <Badge $tone="success">{t("enrolled")}</Badge>
                <LoginLink
                  href={{
                    pathname: "/learn/[slug]",
                    params: { slug: course.slug },
                  }}
                >
                  {t("continueLearning")}
                </LoginLink>
              </>
            ) : isLoggedIn ? (
              <>
                {!isFree && !appliedCoupon ? (
                  <>
                    <CouponToggle
                      type="button"
                      $open={couponOpen}
                      aria-expanded={couponOpen}
                      aria-controls="coupon-form"
                      onClick={() => setCouponOpen((v) => !v)}
                    >
                      {t("couponToggle")} <span className="chev">▼</span>
                    </CouponToggle>
                    <AnimatePresence initial={false}>
                      {couponOpen ? (
                        <CouponCollapse
                          id="coupon-form"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.3,
                            ease: [0.21, 0.8, 0.35, 1],
                          }}
                        >
                          <CouponForm onSubmit={onApplyCoupon}>
                            <Field
                              label={t("couponLabel")}
                              value={couponInput}
                              onChange={(e) => setCouponInput(e.target.value)}
                              placeholder="SOMMER-25"
                              autoFocus
                              error={
                                couponError
                                  ? t(`couponErrors.${couponError}` as never)
                                  : null
                              }
                            />
                            <GhostButton
                              type="submit"
                              disabled={pending || !couponInput}
                            >
                              {t("couponApply")}
                            </GhostButton>
                          </CouponForm>
                        </CouponCollapse>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : null}
                <PrimaryButton onClick={onEnroll} disabled={pending}>
                  {effectivePriceCents === 0
                    ? t("enrollFree")
                    : t("buy", {
                        price: formatPrice(
                          effectivePriceCents,
                          course.currency,
                          locale
                        ),
                      })}
                </PrimaryButton>
                {!isFree ? (
                  inCart ? (
                    <GhostButton as={Link} href="/cart">
                      ✓ {t("inCart")}
                    </GhostButton>
                  ) : (
                    <GhostButton
                      type="button"
                      onClick={() =>
                        addToCart({
                          courseId: course.id,
                          slug: course.slug,
                          title: course.title,
                          priceCents: course.priceCents,
                          currency: course.currency,
                          coverImage: course.coverImage,
                        })
                      }
                    >
                      {t("addToCart")}
                    </GhostButton>
                  )
                ) : null}
                {!isFree && !stripeEnabled ? (
                  <Note>{t("purchaseNote")}</Note>
                ) : null}
              </>
            ) : (
              <LoginLink href="/login">{t("loginToEnroll")}</LoginLink>
            )}
          </BuyCard>
        </Layout>
      </Container>
    </Wrap>
  );
}
