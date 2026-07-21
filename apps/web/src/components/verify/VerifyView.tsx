"use client";

import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import {
  Badge,
  Card,
  Container,
  GhostButton,
  Kicker,
  Muted,
  SectionTitle,
} from "@/components/ui/primitives";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const StatusCard = styled(Card)<{ $valid: boolean }>`
  margin-top: 2rem;
  border-color: ${({ theme, $valid }) =>
    $valid ? "rgba(200, 255, 77, 0.45)" : theme.colors.danger};
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const StatusHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const StatusIcon = styled.span<{ $valid: boolean }>`
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  font-weight: 700;
  background: ${({ theme, $valid }) =>
    $valid ? theme.colors.accentSoft : theme.colors.dangerSoft};
  color: ${({ theme, $valid }) =>
    $valid ? theme.colors.accent : theme.colors.danger};
`;

const SerialCode = styled.code`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  letter-spacing: 0.06em;
`;

const FactGrid = styled.dl`
  display: grid;
  gap: 1rem;
  margin: 0;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  dt {
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textFaint};
    margin-bottom: 0.2rem;
  }

  dd {
    margin: 0;
    font-size: 1.02rem;

    &.big {
      font-size: 1.35rem;
      font-family: ${({ theme }) => theme.fonts.display};
    }
  }
`;

const TwoCols = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-top: 1.5rem;
  align-items: start;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1.2fr 1fr;
  }
`;

const BlockCard = styled(Card)`
  h2 {
    font-size: 1.15rem;
    margin-bottom: 1rem;
  }
`;

const SectionList = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  > li > strong {
    display: block;
    font-size: 0.95rem;
    margin-bottom: 0.35rem;
  }
`;

const LessonList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  li {
    font-size: 0.88rem;
    color: ${({ theme }) => theme.colors.textMuted};
    padding-left: 1.1rem;
    position: relative;

    &::before {
      content: "✦";
      position: absolute;
      left: 0;
      font-size: 0.6rem;
      top: 0.35em;
      color: ${({ theme }) => theme.colors.accent};
    }
  }
`;

const ExamList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const ExamItem = styled.li`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 0.8rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  strong {
    font-size: 0.95rem;
  }
`;

const ExamMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export interface VerifyExam {
  title: string;
  passPercent: number;
  bestScorePercent: number | null;
  passedAt: string | null;
  passed: boolean;
}

export interface VerifyResult {
  recipientName: string;
  courseTitle: string;
  creatorName: string;
  scorePercent: number;
  issuedAt: string;
  /** true = Snapshot vom Ausstellungszeitpunkt; false = aktueller Kursstand */
  curriculumFrozen: boolean;
  sections: { title: string; lessons: string[] }[];
  exams: VerifyExam[];
}

export function VerifyView({
  serial,
  result,
}: {
  serial: string;
  /** null = Seriennummer unbekannt (ungültiges Zertifikat) */
  result: VerifyResult | null;
}) {
  const t = useTranslations("verify");
  const locale = useLocale();

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));

  return (
    <Wrap id="main">
      <Container>
        <Kicker>LearnSphere</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        <StatusCard $valid={Boolean(result)} as="section">
          <StatusHead>
            <StatusIcon $valid={Boolean(result)} aria-hidden>
              {result ? "✓" : "✕"}
            </StatusIcon>
            <div>
              <strong role="status">
                {result ? t("validTitle") : t("invalidTitle")}
              </strong>
              <br />
              <SerialCode>{serial}</SerialCode>
            </div>
          </StatusHead>

          {result ? (
            <>
              <Muted style={{ fontSize: "0.9rem", maxWidth: "65ch" }}>
                {t("validText")}
              </Muted>
              <FactGrid>
                <div>
                  <dt>{t("recipient")}</dt>
                  <dd className="big">{result.recipientName}</dd>
                </div>
                <div>
                  <dt>{t("course")}</dt>
                  <dd className="big">{result.courseTitle}</dd>
                </div>
                <div>
                  <dt>{t("creator")}</dt>
                  <dd>{result.creatorName}</dd>
                </div>
                <div>
                  <dt>{t("finalScore")}</dt>
                  <dd>
                    {result.scorePercent.toLocaleString(locale)} %{" "}
                    <Badge $tone="success">{t("passed")}</Badge>
                  </dd>
                </div>
                <div>
                  <dt>{t("issuedOn")}</dt>
                  <dd>{formatDate(result.issuedAt)}</dd>
                </div>
              </FactGrid>
            </>
          ) : (
            <>
              <Muted style={{ fontSize: "0.9rem", maxWidth: "65ch" }}>
                {t("invalidText")}
              </Muted>
              <div>
                <GhostButton as={Link} href="/verify">
                  {t("checkAnother")}
                </GhostButton>
              </div>
            </>
          )}
        </StatusCard>

        {result ? (
          <>
            <TwoCols>
              <BlockCard as="section" aria-label={t("curriculum")}>
                <h2>{t("curriculum")}</h2>
                <Muted
                  style={{ fontSize: "0.8rem", margin: "-0.5rem 0 1rem" }}
                >
                  {result.curriculumFrozen
                    ? t("curriculumFrozen", {
                        date: formatDate(result.issuedAt),
                      })
                    : t("curriculumCurrent")}
                </Muted>
                {result.sections.length === 0 ? (
                  <Muted style={{ fontSize: "0.88rem" }}>
                    {t("noCurriculum")}
                  </Muted>
                ) : (
                  <SectionList>
                    {result.sections.map((section, i) => (
                      <li key={i}>
                        <strong>
                          {i + 1}. {section.title}
                        </strong>
                        <LessonList>
                          {section.lessons.map((lesson, j) => (
                            <li key={j}>{lesson}</li>
                          ))}
                        </LessonList>
                      </li>
                    ))}
                  </SectionList>
                )}
              </BlockCard>

              <BlockCard as="section" aria-label={t("sectionExams")}>
                <h2>{t("sectionExams")}</h2>
                {result.exams.length === 0 ? (
                  <Muted style={{ fontSize: "0.88rem" }}>
                    {t("noSectionExams")}
                  </Muted>
                ) : (
                  <ExamList>
                    {result.exams.map((exam, i) => (
                      <ExamItem key={i}>
                        <strong>{exam.title}</strong>
                        <ExamMeta>
                          {exam.passed ? (
                            <Badge $tone="success">{t("passed")}</Badge>
                          ) : (
                            <Badge $tone="muted">{t("notPassed")}</Badge>
                          )}
                          {exam.bestScorePercent !== null ? (
                            <span>
                              {t("score", {
                                percent:
                                  Math.round(exam.bestScorePercent * 10) / 10,
                              })}
                            </span>
                          ) : (
                            <span>{t("noAttempt")}</span>
                          )}
                          {exam.passedAt ? (
                            <span>
                              {t("passedOn", {
                                date: formatDate(exam.passedAt),
                              })}
                            </span>
                          ) : null}
                        </ExamMeta>
                      </ExamItem>
                    ))}
                  </ExamList>
                )}
              </BlockCard>
            </TwoCols>

            <Muted style={{ marginTop: "1.5rem", fontSize: "0.8rem" }}>
              {t("hint")}{" "}
              <Link href="/verify" style={{ color: "inherit" }}>
                {t("checkAnother")}
              </Link>
            </Muted>
          </>
        ) : null}
      </Container>
    </Wrap>
  );
}
