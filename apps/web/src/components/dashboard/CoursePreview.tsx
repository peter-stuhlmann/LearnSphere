"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { formatDuration, formatPrice } from "@elearning/core/format";
import { languageDisplayName } from "@elearning/core/course-i18n";
import { sanitizeRichText } from "@/lib/sanitize";
import { RichText } from "@/components/ui/RichText";

/**
 * Live-Vorschau im Kurs-Editor: bewusst eine getreue Mini-Kopie der
 * öffentlichen Kursseite (CourseDetailView) – gleiche Elemente, gleiche
 * Reihenfolge, gleiche Optik, nur kompakter. Änderungen an der Kursseite
 * sollten hier gespiegelt werden.
 */

const Chrome = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bgDeep};
`;

const ChromeBar = styled.div`
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.border};
  }
`;

const Body = styled.div`
  padding: 1.75rem 1.5rem;
  display: grid;
  gap: 1.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 1fr 220px;
    align-items: start;
  }
`;

const Kicker = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
`;

const Title = styled.h3`
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  margin-top: 0.5rem;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 0.6rem;
  font-size: 0.95rem;
  max-width: 60ch;
`;

const Meta = styled.p`
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/* Kurssprachen als Chips – gespiegelt von der Kursseite, nur kompakter */
const LangRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.6rem;
`;

const LangChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textMuted};

  svg {
    width: 12px;
    height: 12px;
    color: ${({ theme }) => theme.colors.violet};
  }
`;

const LangOriginal = styled.em`
  font-style: normal;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.08rem 0.35rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.violetSoft};
  color: ${({ theme }) => theme.colors.violet};
`;

const HeroImage = styled.div`
  margin-top: 1.5rem;
  /* fester 16:9-Rahmen – Bezugsrahmen für next/image mit fill */
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border};

  img {
    object-fit: cover;
  }
`;

const Description = styled.div`
  margin-top: 1.75rem;

  h4 {
    font-size: 1.05rem;
    margin-bottom: 0.5rem;
  }
`;

const Curriculum = styled.section`
  margin-top: 1.75rem;

  h4 {
    font-size: 1.05rem;
    margin-bottom: 0.75rem;
  }
`;

/* Akkordeon wie auf der Kursseite (erste Sektion offen, +/− Marker) */
const SectionBlock = styled.details`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  margin-bottom: 0.5rem;
  overflow: hidden;

  summary {
    cursor: pointer;
    padding: 0.75rem 0.9rem;
    font-weight: 600;
    font-size: 0.9rem;
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
  padding: 0.35rem 0.9rem 0.75rem;

  li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.45rem 0;
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.textMuted};
    border-bottom: 1px dashed ${({ theme }) => theme.colors.border};

    &:last-child {
      border-bottom: none;
    }
  }

  span.duration {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const PreviewTag = styled.span`
  display: inline-block;
  margin-left: 0.4rem;
  font-size: 0.7rem;
  color: ${({ theme }) => theme.colors.accent};
`;

const BuyBox = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const Price = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.8rem;
  color: ${({ theme }) => theme.colors.accent};
`;

const FakeButton = styled.span`
  display: block;
  text-align: center;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-weight: 600;
  font-size: 0.88rem;
  padding: 0.6rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
`;

const Perk = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};

  &::before {
    content: "✓ ";
    color: ${({ theme }) => theme.colors.success};
  }
`;

export interface PreviewSettings {
  title: string;
  subtitle: string;
  description: string;
  coverImage: string;
  priceCents: number;
  requiredWatchPercent: number;
  language: string;
  extraLanguages: string[];
}

export interface PreviewSection {
  id: string;
  title: string;
  hasQuiz: boolean;
  lessons: {
    id: string;
    title: string;
    durationSeconds: number;
    isPreview: boolean;
  }[];
}

export function CoursePreview({
  settings,
  sections,
  creatorName,
}: {
  settings: PreviewSettings;
  sections: PreviewSection[];
  creatorName: string;
}) {
  const t = useTranslations("course");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();

  const languages = [settings.language, ...settings.extraLanguages];
  const lessonCount = sections.reduce((sum, s) => sum + s.lessons.length, 0);

  return (
    <Chrome aria-label="Live-Vorschau" role="img">
      <ChromeBar aria-hidden>
        <span />
        <span />
        <span />
      </ChromeBar>
      <Body>
        <div>
          {/* Aufbau exakt wie die Kursseite: Kicker → Titel → Untertitel →
              Meta → Sprachen → Bild → Beschreibung → Kursinhalt */}
          <Kicker>{tCatalog("by", { name: creatorName })}</Kicker>
          <Title>{settings.title || "…"}</Title>
          {settings.subtitle ? <Subtitle>{settings.subtitle}</Subtitle> : null}
          <Meta>
            {t("sections", { count: sections.length })} ·{" "}
            {t("lessons", { count: lessonCount })}
          </Meta>
          <LangRow aria-label={t("courseLanguages")}>
            {languages.map((lang) => (
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
                {lang === settings.language ? (
                  <LangOriginal>{t("originalLanguage")}</LangOriginal>
                ) : null}
              </LangChip>
            ))}
          </LangRow>

          {settings.coverImage ? (
            <HeroImage>
              <Image
                src={settings.coverImage}
                alt=""
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
              />
            </HeroImage>
          ) : null}

          {settings.description ? (
            <Description>
              <h4>{t("aboutCourse")}</h4>
              {/* wie nach dem Speichern: unsanitisierte Editor-/Paste-
                  Artefakte erscheinen nie in der Vorschau */}
              <RichText html={sanitizeRichText(settings.description)} />
            </Description>
          ) : null}

          <Curriculum>
            <h4>{t("curriculum")}</h4>
            {sections.map((section, i) => (
              <SectionBlock key={section.id} open={i === 0}>
                <summary>
                  {section.title}
                  {section.hasQuiz ? " ✦" : ""}
                </summary>
                <LessonList>
                  {section.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <span>
                        {lesson.title}
                        {lesson.isPreview ? (
                          <PreviewTag>▶ {t("previewBadge")}</PreviewTag>
                        ) : null}
                      </span>
                      {lesson.durationSeconds > 0 ? (
                        <span className="duration">
                          {formatDuration(lesson.durationSeconds)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </LessonList>
              </SectionBlock>
            ))}
          </Curriculum>
        </div>
        <BuyBox>
          <Price>{formatPrice(settings.priceCents, "EUR", locale)}</Price>
          <Perk>{t("certificateIncluded")}</Perk>
          <Perk>
            {t("finalExamInfo", {
              percent: settings.requiredWatchPercent,
            })}
          </Perk>
          <FakeButton aria-hidden>
            {settings.priceCents === 0
              ? t("enrollFree")
              : t("buy", {
                  price: formatPrice(settings.priceCents, "EUR", locale),
                })}
          </FakeButton>
        </BuyBox>
      </Body>
    </Chrome>
  );
}
