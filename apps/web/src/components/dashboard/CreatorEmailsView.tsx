"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import {
  cancelCreatorCampaign,
  countCreatorEmailRecipients,
  deleteCreatorDraft,
  listCreatorCampaigns,
  loadCreatorDraft,
  saveCreatorDraft,
  searchCreatorCourses,
  sendCreatorEmail,
} from "@/app/actions/creator-email-actions";
import {
  renderCreatorEmail,
  validateCreatorCampaign,
} from "@/lib/creator-emails";
import type { CampaignListItem } from "@/lib/services/creator-email-service";
import { RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { Field } from "@/components/ui/Field";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { toIsoDay } from "@/lib/usage-range";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormAlert } from "@/components/auth/AuthShell";
import {
  Badge,
  Card,
  Container,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const ComposeCard = styled(motion(Card))`
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
`;

const StepLabel = styled.h2`
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-bottom: 0.75rem;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.accent};
    margin-right: 0.45rem;
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;

/* Empfänger: Umschalter + Kurs-Chips */
const TargetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
`;

const TargetPill = styled.button<{ $active: boolean }>`
  padding: 0.55rem 1.1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.88rem;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.accent : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : theme.colors.bgElevated};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};
  transition: border-color 140ms ease, color 140ms ease, background 140ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const CourseChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.75rem;
`;

const CourseChip = styled.button<{ $active: boolean }>`
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.82rem;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.5)" : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};
  transition: border-color 140ms ease, color 140ms ease, background 140ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

/* Live-Zähler mit pulsierendem Punkt */
const CountLine = styled.p`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.9rem;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.accent};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 1.05rem;
  }
`;

const PulseDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accent};
  animation: creator-mail-pulse 2s ease-in-out infinite;

  @keyframes creator-mail-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.75);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CharCount = styled.span<{ $over: boolean }>`
  font-size: 0.75rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme, $over }) =>
    $over ? theme.colors.danger : theme.colors.textFaint};
`;

/* Vorschau: gerendertes Mail-HTML isoliert im iframe. Die Höhe wird nach
   dem Laden aus dem Inhalt gemessen – keine innere Scrollbar. */
const PreviewFrame = styled.iframe`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: #07080f;
  display: block;
`;

/* Versandzeitpunkt: DateTimePicker mit begrenzter Breite in der Zeile */
const ScheduleWrap = styled.div`
  max-width: 360px;
  margin-bottom: 1rem;
`;

const SendRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`;

/* Historie */
const HistoryCard = styled(Card)`
  margin-top: 1.5rem;

  h2 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
  }
`;

/* Filterleiste der Kampagnen-Liste – alle Elemente in einheitlicher
   Pill-Höhe (gleiche Paddings/Schriftgrößen wie der DateRangePicker) */
const ListFilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
`;

const ListSearchInput = styled.input`
  flex: 1;
  min-width: 180px;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.42rem 0.95rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const RowActionButton = styled.button`
  padding: 0.3rem 0.8rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 0.76rem;
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const HistoryList = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const HistoryRow = styled(motion.li)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  padding: 0.8rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-size: 0.88rem;

  strong {
    flex: 1 1 200px;
    min-width: 0;
  }
`;

interface CourseOption {
  id: string;
  title: string;
  enrolledCount: number;
}

interface CreatorEmailsViewProps {
  creatorName: string;
  courses: CourseOption[];
  campaigns: CampaignListItem[];
}

export function CreatorEmailsView({
  creatorName,
  courses,
  campaigns: initialCampaigns,
}: CreatorEmailsViewProps) {
  const t = useTranslations("creatorEmails");
  const locale = useLocale() === "en" ? ("en" as const) : ("de" as const);

  const [allCourses, setAllCourses] = useState(true);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(480);
  // "" = sofort senden, sonst datetime-local-Wert des geplanten Zeitpunkts
  const [scheduledAt, setScheduledAt] = useState("");
  const sendMode = scheduledAt ? ("later" as const) : ("now" as const);
  // Formular erst auf Klick öffnen – die Seite startet mit der Liste
  const [composeOpen, setComposeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, startSending] = useTransition();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [result, setResult] = useState<
    | { kind: "success"; sent: number }
    | { kind: "scheduled"; date: string }
    | { kind: "draftSaved" }
    | { kind: "partial"; sent: number; failed: number }
    | { kind: "error"; code: string }
    | null
  >(null);
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  // Entwurf, der gerade bearbeitet wird (null = frische Mail)
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);

  // Listen-Filter: Status, Zeitraum, Suchbegriff (sucht auch im Inhalt)
  const [today] = useState(() => toIsoDay(new Date()));
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const filtersActive =
    filterStatus !== "" ||
    filterFrom !== "" ||
    filterTo !== "" ||
    filterQuery !== "";

  const listRequest = useRef(0);
  const refreshList = useMemo(
    () =>
      (filters: {
        status: string;
        from: string;
        to: string;
        query: string;
      }) => {
        const request = ++listRequest.current;
        void listCreatorCampaigns({
          status: filters.status || null,
          from: filters.from || null,
          to: filters.to || null,
          query: filters.query || null,
        }).then((response) => {
          if (request === listRequest.current && response.ok) {
            setCampaigns(response.campaigns ?? []);
          }
        });
      },
    []
  );

  /* Filteränderungen gedrosselt anwenden (Suchbegriff tippt man) */
  useEffect(() => {
    const timer = setTimeout(
      () =>
        refreshList({
          status: filterStatus,
          from: filterFrom,
          to: filterTo,
          query: filterQuery,
        }),
      250
    );
    return () => clearTimeout(timer);
  }, [filterStatus, filterFrom, filterTo, filterQuery, refreshList]);

  /* Live-Empfängerzahl: gedrosselt nachladen, wenn sich das Ziel ändert */
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const countRequest = useRef(0);
  useEffect(() => {
    const request = ++countRequest.current;
    const timer = setTimeout(() => {
      setRecipientCount(null);
      void countCreatorEmailRecipients({ allCourses, courseIds }).then(
        (response) => {
          if (request === countRequest.current && response.ok) {
            setRecipientCount(response.count ?? 0);
          }
        }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [allCourses, courseIds]);

  function toggleCourse(id: string) {
    setCourseIds((previous) =>
      previous.includes(id)
        ? previous.filter((courseId) => courseId !== id)
        : [...previous, id]
    );
  }

  const validation = validateCreatorCampaign({
    subject,
    html,
    allCourses,
    courseIds,
  });
  /* Ob der Zeitpunkt weit genug in der Zukunft liegt, prüft die
     Server-Validierung (schedule_past) – der Picker liefert immer ein
     gültiges Format */
  const canSend =
    validation.ok &&
    !sending &&
    (recipientCount === null || recipientCount > 0);

  const preview = useMemo(() => {
    // Beispiel-Kopfzeile: Zielkurse (bzw. alle) – die echte Mail nennt je
    // Empfänger nur die eigenen Einschreibungen
    const sampleTitles = (
      allCourses
        ? courses
        : courses.filter((course) => courseIds.includes(course.id))
    )
      .slice(0, 3)
      .map((course) => course.title);
    return renderCreatorEmail({
      subject: subject.trim() || t("previewSubjectFallback"),
      bodyHtml: html || `<p>${t("previewBodyFallback")}</p>`,
      creatorName,
      courseTitles: sampleTitles,
      locale,
      // Vorschau: Platzhalter – der echte Link ist je Empfänger signiert
      unsubscribeUrl: "#",
    }).html;
  }, [subject, html, creatorName, locale, t, allCourses, courseIds, courses]);

  function onSend() {
    setConfirmOpen(false);
    setResult(null);
    const scheduledIso =
      sendMode === "later" && scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null;
    startSending(async () => {
      const response = await sendCreatorEmail({
        subject,
        html,
        allCourses,
        courseIds,
        locale,
        scheduledAt: scheduledIso,
        draftId,
      });
      if (!response.ok) {
        setResult({ kind: "error", code: response.error ?? "generic" });
        return;
      }
      const failed = response.failedCount ?? 0;
      setResult(
        response.scheduled && scheduledIso
          ? { kind: "scheduled", date: scheduledIso }
          : failed > 0
            ? { kind: "partial", sent: response.sentCount ?? 0, failed }
            : { kind: "success", sent: response.sentCount ?? 0 }
      );
      setDraftId(null);
      refreshList({
        status: filterStatus,
        from: filterFrom,
        to: filterTo,
        query: filterQuery,
      });
      if (failed === 0) {
        setSubject("");
        setHtml("");
        setShowPreview(false);
        setScheduledAt("");
        // zurück zur Liste – die Erfolgsmeldung steht darüber
        setComposeOpen(false);
      }
    });
  }

  function currentFilters() {
    return {
      status: filterStatus,
      from: filterFrom,
      to: filterTo,
      query: filterQuery,
    };
  }

  async function onSaveDraft() {
    if (draftSaving) return;
    setDraftSaving(true);
    setResult(null);
    const response = await saveCreatorDraft({
      draftId,
      subject,
      html,
      allCourses,
      courseIds,
      locale,
    });
    setDraftSaving(false);
    if (!response.ok) {
      setResult({ kind: "error", code: response.error ?? "generic" });
      return;
    }
    setDraftId(response.draftId ?? null);
    setResult({ kind: "draftSaved" });
    refreshList(currentFilters());
  }

  async function onEditDraft(id: string) {
    const response = await loadCreatorDraft({ draftId: id });
    if (!response.ok || !response.draft) return;
    setDraftId(id);
    setSubject(response.draft.subject);
    setHtml(response.draft.html);
    setAllCourses(response.draft.allCourses);
    setCourseIds(response.draft.courseIds);
    setResult(null);
    setComposeOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onDeleteDraft(id: string) {
    void deleteCreatorDraft({ draftId: id }).then((response) => {
      if (response.ok) {
        if (draftId === id) setDraftId(null);
        refreshList(currentFilters());
      }
    });
  }

  function onCancelCampaign(campaignId: string) {
    setCancelingId(campaignId);
    void cancelCreatorCampaign({ campaignId }).then((response) => {
      setCancelingId(null);
      if (response.ok) refreshList(currentFilters());
    });
  }

  const errorText = (code: string) => {
    const known = [
      "subject_required",
      "subject_too_long",
      "content_required",
      "content_too_long",
      "courses_required",
      "no_recipients",
      "rate_limited",
      "schedule_invalid",
      "schedule_past",
      "schedule_too_far",
      "draft_empty",
    ];
    return known.includes(code)
      ? t(`errors.${code}` as never)
      : t("errors.generic");
  };

  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <Muted style={{ marginTop: "0.4rem", maxWidth: "620px" }}>
          {t("intro")}
        </Muted>

        <div style={{ marginTop: "1.5rem" }}>
          <PrimaryButton
            type="button"
            aria-expanded={composeOpen}
            onClick={() => setComposeOpen((open) => !open)}
          >
            {composeOpen ? t("composeClose") : `✉️ ${t("composeButton")}`}
          </PrimaryButton>
        </div>

        <div aria-live="polite">
          {result?.kind === "success" ? (
            <FormAlert
              $tone="success"
              role="status"
              style={{ marginTop: "1rem" }}
            >
              {t("sentSuccess", { count: result.sent })}
            </FormAlert>
          ) : null}
          {result?.kind === "scheduled" ? (
            <FormAlert
              $tone="success"
              role="status"
              style={{ marginTop: "1rem" }}
            >
              {t("scheduledSuccess", {
                date: dateFormat.format(new Date(result.date)),
              })}
            </FormAlert>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {composeOpen ? (
            <motion.div
              key="compose"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
        <ComposeCard as="section" aria-label={t("composeLabel")}>
          <div>
            <StepLabel>
              <em aria-hidden>01</em>
              {t("stepRecipients")}
            </StepLabel>
            <TargetRow role="group" aria-label={t("stepRecipients")}>
              <TargetPill
                type="button"
                $active={allCourses}
                aria-pressed={allCourses}
                onClick={() => setAllCourses(true)}
              >
                {t("targetAll")}
              </TargetPill>
              <TargetPill
                type="button"
                $active={!allCourses}
                aria-pressed={!allCourses}
                onClick={() => setAllCourses(false)}
              >
                {t("targetSelected")}
              </TargetPill>
            </TargetRow>
            <AnimatePresence initial={false}>
              {!allCourses ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: "hidden" }}
                >
                  <CourseChips
                    role="group"
                    aria-label={t("coursePickerLabel")}
                  >
                    {courses.map((course) => (
                      <CourseChip
                        key={course.id}
                        type="button"
                        $active={courseIds.includes(course.id)}
                        aria-pressed={courseIds.includes(course.id)}
                        onClick={() => toggleCourse(course.id)}
                      >
                        {course.title}
                      </CourseChip>
                    ))}
                    {courses.length === 0 ? (
                      <Muted style={{ fontSize: "0.85rem" }}>
                        {t("noCourses")}
                      </Muted>
                    ) : null}
                  </CourseChips>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <CountLine role="status" aria-live="polite">
              <PulseDot aria-hidden />
              {recipientCount === null ? (
                t("countLoading")
              ) : (
                <span>
                  {t.rich("countReach", {
                    count: recipientCount,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </span>
              )}
            </CountLine>
          </div>

          <div>
            <StepLabel>
              <em aria-hidden>02</em>
              {t("stepContent")}
            </StepLabel>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div>
                <Field
                  label={t("subjectLabel")}
                  value={subject}
                  maxLength={160}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("subjectPlaceholder")}
                />
                <CharCount
                  aria-hidden
                  $over={subject.trim().length > 150}
                >
                  {subject.trim().length}/150
                </CharCount>
              </div>
              <RichTextEditor
                label={t("contentLabel")}
                value={html}
                onChange={setHtml}
                placeholder={t("contentPlaceholder")}
                emailBlocks={{
                  searchCourses: async (query) => {
                    const result = await searchCreatorCourses({ query });
                    return result.ok ? (result.courses ?? []) : [];
                  },
                }}
              />
            </div>
          </div>

          <div>
            <StepLabel>
              <em aria-hidden>03</em>
              {t("stepReview")}
            </StepLabel>
            <ScheduleWrap>
              <DateTimePicker
                label={t("sendModeLabel")}
                emptyLabel={t("sendModeNow")}
                value={scheduledAt}
                onChange={setScheduledAt}
              />
            </ScheduleWrap>

            <SendRow>
              <GhostButton
                type="button"
                aria-expanded={showPreview}
                onClick={() => setShowPreview((value) => !value)}
              >
                {showPreview ? t("previewHide") : t("previewShow")}
              </GhostButton>
              <GhostButton
                type="button"
                disabled={draftSaving}
                onClick={() => void onSaveDraft()}
              >
                {draftSaving
                  ? t("draftSaving")
                  : draftId
                    ? t("draftUpdate")
                    : t("draftSave")}
              </GhostButton>
              <PrimaryButton
                type="button"
                disabled={!canSend}
                onClick={() => setConfirmOpen(true)}
              >
                {sending
                  ? t("sending")
                  : sendMode === "later"
                    ? t("scheduleButton")
                    : t("sendButton")}
              </PrimaryButton>
              {recipientCount === 0 ? (
                <Muted style={{ fontSize: "0.85rem" }}>
                  {t("noRecipientsHint")}
                </Muted>
              ) : null}
            </SendRow>

            <AnimatePresence initial={false}>
              {showPreview ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: "hidden", marginTop: "1rem" }}
                >
                  <PreviewFrame
                    title={t("previewTitle")}
                    /* allow-same-origin (ohne Skripte): nötig, um die Höhe
                       aus dem Inhalt zu messen – Inhalt ist eigenes,
                       sanitisiertes HTML ohne Scripts */
                    sandbox="allow-same-origin"
                    srcDoc={preview}
                    style={{ height: previewHeight }}
                    onLoad={(event) => {
                      const doc = event.currentTarget.contentDocument;
                      const height = doc?.documentElement?.scrollHeight;
                      if (height) setPreviewHeight(height + 4);
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div aria-live="polite" style={{ marginTop: "1rem" }}>
              {result?.kind === "draftSaved" ? (
                <FormAlert $tone="success" role="status">
                  {t("draftSaved")}
                </FormAlert>
              ) : null}
              {result?.kind === "partial" ? (
                <FormAlert $tone="error" role="alert">
                  {t("sentPartial", {
                    sent: result.sent,
                    failed: result.failed,
                  })}
                </FormAlert>
              ) : null}
              {result?.kind === "error" ? (
                <FormAlert $tone="error" role="alert">
                  {errorText(result.code)}
                </FormAlert>
              ) : null}
            </div>
          </div>
        </ComposeCard>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <HistoryCard as="section" aria-labelledby="campaign-history-title">
          <h2 id="campaign-history-title">{t("historyTitle")}</h2>

          {campaigns.length === 0 && !filtersActive ? (
            <Muted role="status" style={{ fontSize: "0.9rem" }}>
              {t("historyNone")}
            </Muted>
          ) : (
            <>
            <ListFilterRow>
              <ListSearchInput
                type="search"
                value={filterQuery}
                placeholder={t("filterSearchPlaceholder")}
                aria-label={t("filterSearchPlaceholder")}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
              <Select
                inline
                pill
                ariaLabel={t("filterStatusLabel")}
                value={filterStatus}
                options={[
                  { value: "", label: t("filterStatusAll") },
                  { value: "DRAFT", label: t("statusDraft") },
                  { value: "SCHEDULED", label: t("statusScheduled") },
                  { value: "SENT", label: t("statusSent") },
                  { value: "CANCELED", label: t("historyCanceled") },
                ]}
                onChange={setFilterStatus}
              />
              <DateRangePicker
                from={filterFrom || today}
                to={filterTo || today}
                active={Boolean(filterFrom && filterTo)}
                maxDay={today}
                align="right"
                onApply={({ from, to }) => {
                  setFilterFrom(from);
                  setFilterTo(to);
                }}
              />
              {filtersActive ? (
                <RowActionButton
                  type="button"
                  onClick={() => {
                    setFilterStatus("");
                    setFilterFrom("");
                    setFilterTo("");
                    setFilterQuery("");
                  }}
                >
                  {t("filterReset")}
                </RowActionButton>
              ) : null}
            </ListFilterRow>

            {campaigns.length === 0 ? (
              <Muted role="status" style={{ fontSize: "0.88rem" }}>
                {t("historyEmpty")}
              </Muted>
            ) : null}

            <HistoryList>
              {campaigns.map((campaign, index) => (
                <HistoryRow
                  key={campaign.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.3) }}
                >
                  <strong>{campaign.subject}</strong>
                  <Muted as="span" style={{ fontSize: "0.8rem" }}>
                    {dateFormat.format(new Date(campaign.createdAt))}
                  </Muted>
                  <Muted as="span" style={{ fontSize: "0.8rem" }}>
                    {campaign.courseTitles === null
                      ? t("targetAll")
                      : t("historyCourses", {
                          count: campaign.courseTitles.length,
                        })}
                  </Muted>
                  {campaign.status === "DRAFT" ? (
                    <>
                      <Badge $tone="violet">{t("statusDraft")}</Badge>
                      <RowActionButton
                        type="button"
                        onClick={() => void onEditDraft(campaign.id)}
                      >
                        {t("draftEdit")}
                      </RowActionButton>
                      <RowActionButton
                        type="button"
                        onClick={() => onDeleteDraft(campaign.id)}
                      >
                        {t("draftDelete")}
                      </RowActionButton>
                    </>
                  ) : campaign.status === "SCHEDULED" && campaign.scheduledAt ? (
                    <>
                      <Badge $tone="violet">
                        {t("historyScheduled", {
                          date: dateFormat.format(
                            new Date(campaign.scheduledAt)
                          ),
                        })}
                      </Badge>
                      {!campaign.id.startsWith("local-") ? (
                        <GhostButton
                          type="button"
                          disabled={cancelingId === campaign.id}
                          style={{
                            padding: "0.35rem 0.9rem",
                            fontSize: "0.78rem",
                          }}
                          onClick={() => onCancelCampaign(campaign.id)}
                        >
                          {t("historyCancel")}
                        </GhostButton>
                      ) : null}
                    </>
                  ) : campaign.status === "CANCELED" ? (
                    <Badge $tone="muted">{t("historyCanceled")}</Badge>
                  ) : (
                    <>
                      <Badge $tone="success">
                        {t("historySent", { count: campaign.sentCount })}
                      </Badge>
                      {campaign.failedCount > 0 ? (
                        <Badge $tone="muted">
                          {t("historyFailed", {
                            count: campaign.failedCount,
                          })}
                        </Badge>
                      ) : null}
                    </>
                  )}
                </HistoryRow>
              ))}
            </HistoryList>
            </>
          )}
        </HistoryCard>

        <ConfirmDialog
          open={confirmOpen}
          title={
            sendMode === "later" ? t("confirmScheduleTitle") : t("confirmTitle")
          }
          message={
            sendMode === "later" && scheduledAt
              ? t("confirmScheduleMessage", {
                  count: recipientCount ?? 0,
                  date: dateFormat.format(new Date(scheduledAt)),
                })
              : t("confirmMessage", { count: recipientCount ?? 0 })
          }
          confirmLabel={
            sendMode === "later" ? t("confirmSchedule") : t("confirmSend")
          }
          cancelLabel={t("confirmCancel")}
          onConfirm={onSend}
          onCancel={() => setConfirmOpen(false)}
        />
      </Container>
    </Wrap>
  );
}
