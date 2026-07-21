"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { motion, useReducedMotion } from "motion/react";
import { joinWaitlist } from "@/app/actions/waitlist-actions";
import {
  Badge,
  Container,
  Kicker,
  Muted,
  PrimaryButton,
} from "@/components/ui/primitives";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";

const Wrap = styled.main`
  padding: 4rem 0 3rem;
`;

const Hero = styled(motion.section)`
  position: relative;
  max-width: 860px;
  margin: 0 auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
`;

const CoverArea = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;

  img {
    object-fit: cover;
    /* Vorfreude-Look: leicht abgedunkelt und entsättigt bis zum Launch */
    filter: saturate(0.7) brightness(0.75);
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(7, 8, 15, 0.92),
      rgba(7, 8, 15, 0.25) 55%,
      rgba(7, 8, 15, 0.1)
    );
  }
`;

const HeroBody = styled.div`
  position: relative;
  margin-top: -4.5rem;
  padding: 0 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;

  h1 {
    font-size: clamp(1.6rem, 5vw, 2.4rem);
    line-height: 1.15;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 0 2.5rem 2.5rem;
  }
`;

const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.75rem;

  input {
    flex: 1;
    min-width: 220px;
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.pill};
    padding: 0.85rem 1.2rem;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textFaint};
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      outline-offset: 0;
      border-color: transparent;
    }
  }
`;

const SuccessBox = styled(motion.p)`
  margin-top: 0.75rem;
  padding: 0.9rem 1.2rem;
  border: 1px solid ${({ theme }) => theme.colors.success};
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(94, 234, 145, 0.08);
  font-size: 0.95rem;
`;

const ErrorText = styled.p`
  margin-top: 0.5rem;
  color: ${({ theme }) => theme.colors.danger};
  font-size: 0.88rem;
`;

interface ComingSoonViewProps {
  course: {
    id: string;
    title: string;
    subtitle: string | null;
    coverImage: string | null;
    creatorName: string;
  };
  /** E-Mail des eingeloggten Nutzers als Vorbelegung */
  presetEmail: string;
}

/**
 * "Demnächst"-Seite: unveröffentlichter Kurs mit aktivierter Warteliste.
 * Besucher tragen ihre E-Mail ein und werden bei Veröffentlichung einmalig
 * benachrichtigt.
 */
export function ComingSoonView({ course, presetEmail }: ComingSoonViewProps) {
  const t = useTranslations("waitlist");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const reducedMotion = useReducedMotion();

  const [email, setEmail] = useState(presetEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await joinWaitlist({
      courseId: course.id,
      email,
      locale,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }
    setDone(true);
  }

  return (
    <Wrap id="main">
      <Container>
        <Hero
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <CoverArea>
            {course.coverImage ? (
              <Image
                src={course.coverImage}
                alt=""
                fill
                priority
                sizes="(min-width: 900px) 860px, 100vw"
              />
            ) : (
              <CoverPlaceholder />
            )}
          </CoverArea>
          <HeroBody>
            <div>
              <Badge $tone="accent">✦ {t("badge")}</Badge>
            </div>
            <Kicker>{tCatalog("by", { name: course.creatorName })}</Kicker>
            <h1>{course.title}</h1>
            {course.subtitle ? <Muted>{course.subtitle}</Muted> : null}
            <Muted style={{ fontSize: "0.9rem" }}>{t("teaser")}</Muted>

            {done ? (
              <SuccessBox
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                role="status"
              >
                ✓ {t("success")}
              </SuccessBox>
            ) : (
              <>
                <Form onSubmit={onSubmit}>
                  <input
                    type="email"
                    required
                    value={email}
                    placeholder={t("emailPlaceholder")}
                    aria-label={t("emailPlaceholder")}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <PrimaryButton type="submit" disabled={busy}>
                    {busy ? t("busy") : t("submit")}
                  </PrimaryButton>
                </Form>
                {error ? (
                  <ErrorText role="alert">
                    {error === "email_invalid"
                      ? t("errorEmail")
                      : error === "too_many_attempts"
                        ? t("errorRateLimit")
                        : t("errorGeneric")}
                  </ErrorText>
                ) : null}
                <Muted style={{ fontSize: "0.78rem" }}>{t("privacy")}</Muted>
              </>
            )}
          </HeroBody>
        </Hero>
      </Container>
    </Wrap>
  );
}
