"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { Container, Kicker, SectionTitle } from "@/components/ui/primitives";

const Constellation = dynamic(() => import("./Constellation"), {
  ssr: false,
});

const Hero = styled.section`
  position: relative;
  overflow: hidden;
  padding: 5rem 0 4rem;
  min-height: 78dvh;
  display: flex;
  align-items: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 7rem 0 6rem;
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
  font-size: clamp(2.6rem, 9vw, 5.5rem);
  max-width: 12ch;
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
  max-width: 46ch;
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
  margin-top: 4rem;

  div {
    min-width: 0;
  }

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
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Section = styled.section`
  padding: 5rem 0 0;
`;

const FeatureGrid = styled.div`
  display: grid;
  gap: 1rem;
  margin-top: 2.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(4, 1fr);

    /* asymmetrischer Rhythmus */
    > :nth-child(2) {
      transform: translateY(1.5rem);
    }
    > :nth-child(4) {
      transform: translateY(1.5rem);
    }
  }
`;

const FeatureCard = styled(motion.article)`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 1.75rem 1.5rem;
  transition: border-color 200ms ease, background 200ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  h3 {
    font-size: 1.25rem;
    margin-bottom: 0.6rem;
  }

  p {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.94rem;
  }
`;

const FeatureIndex = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.accent};
  font-size: 0.78rem;
  display: block;
  margin-bottom: 1.2rem;
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

const CtaBand = styled(motion.div)`
  margin-top: 6rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background:
    radial-gradient(ellipse 90% 130% at 50% 140%, rgba(200, 255, 77, 0.16), transparent),
    ${({ theme }) => theme.colors.bgElevated};
  padding: 3.5rem 1.75rem;
  text-align: center;

  h2 {
    font-size: clamp(1.9rem, 5vw, 3rem);
    max-width: 18ch;
    margin-inline: auto;
  }

  p {
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 1rem;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 5rem 2rem;
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

/**
 * HINWEIS: Diese Creator-fokussierte Startseite ist aktuell NICHT verdrahtet
 * (ersetzt durch LandingHome mit Lernenden-Fokus), bleibt aber bewusst
 * erhalten – z. B. für eine spätere /for-creators-Seite.
 */
interface LandingViewProps {
  stats: { courses: number; learners: number };
}

export function LandingView({ stats }: LandingViewProps) {
  const t = useTranslations("landing");
  const reducedMotion = useReducedMotion();
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    // 3D erst nach dem First Paint laden – hält LCP klein
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
              <PrimaryCta href="/register">{t("ctaPrimary")}</PrimaryCta>
              <SecondaryCta href="/courses">{t("ctaSecondary")}</SecondaryCta>
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

      <Section>
        <Container>
          <Kicker>{t("featuresKicker")}</Kicker>
          <SectionTitle>{t("featuresTitle")}</SectionTitle>
          <FeatureGrid>
            {([1, 2, 3, 4] as const).map((i) => (
              <FeatureCard
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: (i - 1) * 0.07 }}
              >
                <FeatureIndex>{`0${i}`}</FeatureIndex>
                <h3>{t(`feature${i}Title`)}</h3>
                <p>{t(`feature${i}Text`)}</p>
              </FeatureCard>
            ))}
          </FeatureGrid>
        </Container>
      </Section>

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

          <CtaBand
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <h2>{t("ctaBandTitle")}</h2>
            <p>{t("ctaBandText")}</p>
            <CtaRow style={{ justifyContent: "center" }}>
              <PrimaryCta href="/register">{t("ctaPrimary")}</PrimaryCta>
            </CtaRow>
          </CtaBand>
        </Container>
      </Section>
    </>
  );
}
