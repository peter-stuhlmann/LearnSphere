"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@elearning/core/format";
import { Badge, Container, Kicker, SectionTitle } from "@/components/ui/primitives";

const Constellation = dynamic(() => import("./Constellation"), { ssr: false });

const Hero = styled.section`
  position: relative;
  overflow: hidden;
  padding: 5rem 0 4rem;
  min-height: 70dvh;
  display: flex;
  align-items: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 6.5rem 0 5rem;
  }
`;

const HeroCanvas = styled.div`
  position: absolute;
  inset: -10% -20%;
  opacity: 0.85;
  z-index: 0;

  @media (max-width: 767px) {
    inset: -5% -40%;
    opacity: 0.5;
  }
`;

const HeroContent = styled(Container)`
  position: relative;
  z-index: 1;
`;

const HeroTitle = styled(motion.h1)`
  font-size: clamp(2.6rem, 9vw, 5.2rem);
  max-width: 14ch;
  margin-top: 1rem;

  em {
    font-style: italic;
    color: ${({ theme }) => theme.colors.accent};
    text-shadow: 0 0 40px rgba(200, 255, 77, 0.35);
  }
`;

const HeroSub = styled(motion.p)`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: clamp(1rem, 2.5vw, 1.2rem);
  max-width: 48ch;
  margin-top: 1.5rem;
`;

const CtaRow = styled(motion.div)`
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 2.5rem;
`;

const PrimaryCta = styled(Link)`
  display: inline-flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-weight: 700;
  padding: 0.95rem 1.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
  transition: transform 180ms ease, box-shadow 180ms ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }
`;

const SecondaryCta = styled(Link)`
  display: inline-flex;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  color: ${({ theme }) => theme.colors.text};
  padding: 0.95rem 1.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
  transition: background 180ms ease;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const Stats = styled(motion.dl)`
  display: flex;
  flex-wrap: wrap;
  gap: 2rem 3.5rem;
  margin-top: 3.5rem;

  dt {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: ${({ theme }) => theme.colors.textFaint};
    order: 2;
  }

  dd {
    margin: 0;
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: clamp(1.8rem, 4vw, 2.6rem);
  }
`;

const Section = styled.section`
  padding: 5rem 0 0;
`;

const SectionHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
`;

const ViewAll = styled(Link)`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;
  font-size: 0.92rem;

  &:hover {
    text-decoration: underline;
  }
`;

const CourseGrid = styled.div`
  display: grid;
  gap: 1.25rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const CourseCard = styled(motion.article)`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadows.card};
  }

  h3 {
    font-size: 1.25rem;
  }
`;

const CardLink = styled(Link)`
  text-decoration: none;
  color: inherit;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
  }
`;

const CardSub = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.92rem;
`;

const CardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: auto;

  .price {
    margin-left: auto;
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.accent};
    font-size: 0.9rem;
  }
`;

const Creator = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Steps = styled.ol`
  list-style: none;
  padding: 0;
  margin-top: 2.5rem;
  display: grid;
  gap: 1rem;
  counter-reset: step;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Step = styled(motion.li)`
  counter-increment: step;
  border-top: 1px solid ${({ theme }) => theme.colors.borderStrong};
  padding-top: 1.25rem;

  &::before {
    content: "0" counter(step);
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.violet};
    font-size: 0.85rem;
  }

  h3 {
    font-size: 1.3rem;
    margin: 0.6rem 0 0.5rem;
  }

  p {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.94rem;
  }
`;

const CreatorBand = styled(motion.aside)`
  margin-top: 6rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid rgba(139, 124, 255, 0.45);
  background:
    radial-gradient(ellipse 90% 130% at 50% 140%, rgba(139, 124, 255, 0.18), transparent),
    ${({ theme }) => theme.colors.bgElevated};
  padding: 3rem 1.75rem;

  h2 {
    font-size: clamp(1.7rem, 4.5vw, 2.4rem);
    max-width: 22ch;
  }

  p {
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 0.9rem;
    max-width: 62ch;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 3.5rem 2.5rem;
  }
`;

const CreatorCta = styled(Link)`
  display: inline-flex;
  margin-top: 1.75rem;
  border: 1px solid ${({ theme }) => theme.colors.violet};
  color: ${({ theme }) => theme.colors.violet};
  background: ${({ theme }) => theme.colors.violetSoft};
  font-weight: 600;
  padding: 0.85rem 1.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
  transition: filter 150ms ease;

  &:hover {
    filter: brightness(1.15);
  }
`;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export interface FeaturedCourse {
  slug: string;
  title: string;
  subtitle: string;
  creatorName: string;
  priceCents: number;
  currency: string;
  avgRating: number | null;
  sectionCount: number;
}

interface LandingHomeProps {
  stats: { courses: number; learners: number };
  featured: FeaturedCourse[];
}

export function LandingHome({ stats, featured }: LandingHomeProps) {
  const t = useTranslations("home");
  const tCourse = useTranslations("course");
  const locale = useLocale();
  const reducedMotion = useReducedMotion();
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    if (!reducedMotion) {
      const id = window.setTimeout(() => setShow3d(true), 250);
      return () => clearTimeout(id);
    }
  }, [reducedMotion]);

  return (
    <>
      <Hero>
        {show3d ? (
          <HeroCanvas>
            <Constellation />
          </HeroCanvas>
        ) : null}
        <HeroContent>
          <motion.div initial="hidden" animate="visible">
            <motion.div variants={fadeUp} custom={0}>
              <Kicker>{t("heroKicker")}</Kicker>
            </motion.div>
            <HeroTitle variants={fadeUp} custom={1}>
              {t.rich("heroTitle", { em: (chunks) => <em>{chunks}</em> })}
            </HeroTitle>
            <HeroSub variants={fadeUp} custom={2}>
              {t("heroSubtitle")}
            </HeroSub>
            <CtaRow variants={fadeUp} custom={3}>
              <PrimaryCta href="/courses">{t("ctaPrimary")}</PrimaryCta>
              <SecondaryCta href="/register">{t("ctaSecondary")}</SecondaryCta>
            </CtaRow>
            <Stats variants={fadeUp} custom={4}>
              <div>
                <dd>{stats.courses}</dd>
                <dt>{t("statCourses")}</dt>
              </div>
              <div>
                <dd>{stats.learners}</dd>
                <dt>{t("statLearners")}</dt>
              </div>
              <div>
                <dd>94%</dd>
                <dt>{t("statCompletion")}</dt>
              </div>
            </Stats>
          </motion.div>
        </HeroContent>
      </Hero>

      {featured.length > 0 ? (
        <Section>
          <Container>
            <SectionHead>
              <div>
                <Kicker>{t("featuredKicker")}</Kicker>
                <SectionTitle>{t("featuredTitle")}</SectionTitle>
              </div>
              <ViewAll href="/courses">{t("viewAll")} →</ViewAll>
            </SectionHead>
            <CourseGrid>
              {featured.map((course, i) => (
                <CourseCard
                  key={course.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.07 }}
                >
                  <h3>
                    <CardLink
                      href={{
                        pathname: "/courses/[slug]",
                        params: { slug: course.slug },
                      }}
                    >
                      {course.title}
                    </CardLink>
                  </h3>
                  {course.subtitle ? <CardSub>{course.subtitle}</CardSub> : null}
                  <Creator>{t("by", { name: course.creatorName })}</Creator>
                  <CardMeta>
                    <Badge $tone="violet">
                      {tCourse("sections", { count: course.sectionCount })}
                    </Badge>
                    {course.avgRating !== null ? (
                      <Badge $tone="accent">★ {course.avgRating}</Badge>
                    ) : null}
                    <span className="price">
                      {formatPrice(course.priceCents, course.currency, locale)}
                    </span>
                  </CardMeta>
                </CourseCard>
              ))}
            </CourseGrid>
          </Container>
        </Section>
      ) : null}

      <Section>
        <Container>
          <Kicker>{t("howKicker")}</Kicker>
          <Steps>
            {([1, 2, 3] as const).map((i) => (
              <Step
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i - 1) * 0.1 }}
              >
                <h3>{t(`how${i}Title`)}</h3>
                <p>{t(`how${i}Text`)}</p>
              </Step>
            ))}
          </Steps>

          <CreatorBand
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            aria-labelledby="creator-band-title"
          >
            <Kicker style={{ color: "#8B7CFF" }}>{t("creatorKicker")}</Kicker>
            <h2 id="creator-band-title">{t("creatorTitle")}</h2>
            <p>{t("creatorText")}</p>
            <CreatorCta href="/pricing">{t("creatorCta")} →</CreatorCta>
          </CreatorBand>
        </Container>
      </Section>
    </>
  );
}
