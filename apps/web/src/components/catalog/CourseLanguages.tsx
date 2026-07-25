"use client";

import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import {
  languageDisplayName,
  type LanguageProvenance,
} from "@elearning/core/course-i18n";

/**
 * Sprach-Anzeige auf der Kursseite (öffentlich + Editor-Vorschau): macht
 * transparent, welche Sprachen ein Kurs anbietet und wie Übersetzungen
 * entstanden sind. Die Originalsprache steht ohne Fußnote vorn; automatisch
 * übersetzte Sprachen tragen eine hochgestellte Ziffer, die unten – und im
 * Tooltip – erklärt wird (KI-VO-Transparenz, Art. 50).
 */

export interface CourseLanguageMeta {
  code: string;
  provenance: LanguageProvenance;
}

const Wrap = styled.div`
  margin-top: 0.7rem;
`;

const Label = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-bottom: 0.4rem;
`;

const Chips = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const Chip = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  line-height: 1;
  padding: 0.34rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text};

  svg {
    flex: none;
    width: 14px;
    height: 14px;
    color: ${({ theme }) => theme.colors.violet};
  }
`;

const Marker = styled.sup`
  font-size: 0.62em;
  font-weight: 700;
  line-height: 1;
  margin-left: 0.05rem;
  color: ${({ theme }) => theme.colors.violet};
  cursor: help;
`;

const Notes = styled.ol`
  margin: 0.55rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.2rem;

  li {
    display: flex;
    gap: 0.35rem;
    font-size: 0.72rem;
    line-height: 1.35;
    color: ${({ theme }) => theme.colors.textMuted};
  }

  sup {
    font-weight: 700;
    color: ${({ theme }) => theme.colors.violet};
  }
`;

/** Vektor-Globus statt Emoji – identisch in allen Browsern/Systemen. */
function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="8" cy="8" r="6.2" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6.2" strokeWidth="1.2" />
      <path d="M2 8 H14 M2.8 5 H13.2 M2.8 11 H13.2" strokeWidth="1.1" />
    </svg>
  );
}

/** Reihenfolge der Fußnoten: erst „automatisch übersetzt", dann „optimiert". */
const NOTE_ORDER: Exclude<LanguageProvenance, "base">[] = ["auto", "optimized"];

export function CourseLanguages({
  languages,
}: {
  languages: CourseLanguageMeta[];
}) {
  const t = useTranslations("course");
  const locale = useLocale();

  // Nur die tatsächlich vorkommenden Herkunfts-Arten bekommen eine Fußnote,
  // fortlaufend nummeriert – so steht nie eine „²" ohne „¹".
  const usedKinds = NOTE_ORDER.filter((kind) =>
    languages.some((lang) => lang.provenance === kind)
  );
  const noteText: Record<Exclude<LanguageProvenance, "base">, string> = {
    auto: t("langAuto"),
    optimized: t("langOptimized"),
  };

  return (
    <Wrap>
      <Label>{t("courseLanguages")}</Label>
      <Chips aria-label={t("courseLanguages")}>
        {languages.map((lang) => {
          const note =
            lang.provenance === "base"
              ? null
              : usedKinds.indexOf(lang.provenance) + 1;
          return (
            <Chip key={lang.code}>
              <GlobeIcon />
              {languageDisplayName(lang.code, locale)}
              {note !== null ? (
                <Marker title={noteText[lang.provenance as "auto" | "optimized"]}>
                  {note}
                  {/* für Screenreader: die Fußnote ausgeschrieben */}
                  <span
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      overflow: "hidden",
                      clip: "rect(0 0 0 0)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {" "}
                    {noteText[lang.provenance as "auto" | "optimized"]}
                  </span>
                </Marker>
              ) : null}
            </Chip>
          );
        })}
      </Chips>
      {usedKinds.length > 0 ? (
        <Notes>
          {usedKinds.map((kind, index) => (
            <li key={kind}>
              <sup>{index + 1}</sup>
              <span>{noteText[kind]}</span>
            </li>
          ))}
        </Notes>
      ) : null}
    </Wrap>
  );
}
