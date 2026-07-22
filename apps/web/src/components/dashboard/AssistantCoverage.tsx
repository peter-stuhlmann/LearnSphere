"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { formatDuration } from "@elearning/core/format";
import {
  assistantCoverage,
  type CoverageSection,
} from "@/lib/assistant/coverage";

/**
 * Zeigt dem Creator, wie viel seines Kurses der Lernassistent überhaupt
 * lesen kann.
 *
 * Ohne diese Anzeige bleibt die häufigste Schwäche unsichtbar: Der Assistent
 * antwortet auch dann, wenn er die Hälfte der Videos nie gehört hat – nur
 * eben schlechter. Wer das nicht weiß, hält den Assistenten für schwach
 * statt den Kurs für unvollständig erschlossen.
 */

const Box = styled.div<{ $complete: boolean }>`
  margin-top: 1rem;
  padding: 1rem 1.15rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid
    ${({ $complete, theme }) =>
      $complete ? theme.colors.border : "rgba(245, 197, 66, 0.45)"};
  background: ${({ $complete, theme }) =>
    $complete ? theme.colors.bgElevated : "rgba(245, 197, 66, 0.07)"};
`;

const Head = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.text};

  strong {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 1.15rem;
  }
`;

const Note = styled.p`
  margin-top: 0.4rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Gaps = styled.ul`
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;

  li {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }

  b {
    color: ${({ theme }) => theme.colors.text};
    font-weight: 600;
  }
`;

/** Höchstzahl einzeln genannter Lücken – der Rest wird gezählt. */
const MAX_LISTED = 6;

export function AssistantCoverage({
  sections,
}: {
  sections: CoverageSection[];
}) {
  const t = useTranslations("assistantCoverage");
  const report = assistantCoverage(sections);

  // Reiner Textkurs: Es gibt nichts zu transkribieren, also nichts zu melden.
  if (report.mediaBlocks === 0) return null;

  const complete = report.gaps.length === 0;
  const listed = report.gaps.slice(0, MAX_LISTED);
  const rest = report.gaps.length - listed.length;

  return (
    <Box $complete={complete} role="status">
      <Head>
        <strong>{report.percent} %</strong>
        {t("title")}
      </Head>
      <Note>
        {complete
          ? t("complete")
          : t("incomplete", {
              blocks: report.mediaBlocks - report.withTranscript,
              duration: formatDuration(report.missingSeconds),
            })}
      </Note>

      {complete ? null : (
        <Gaps>
          {listed.map((gap) => (
            <li key={gap.lessonId}>
              <b>{gap.lessonTitle}</b> · {gap.sectionTitle}
              {gap.seconds > 0 ? ` · ${formatDuration(gap.seconds)}` : ""}
            </li>
          ))}
          {rest > 0 ? <li>{t("more", { count: rest })}</li> : null}
        </Gaps>
      )}
    </Box>
  );
}
