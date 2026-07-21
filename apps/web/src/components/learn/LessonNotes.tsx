"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import {
  addLessonNote,
  deleteLessonNote,
  listLessonNotes,
  updateLessonNote,
  type LessonNoteDto,
} from "@/app/actions/note-actions";
import { formatChapterTime } from "@elearning/core/chapters";
import { GhostButton, PrimaryButton } from "@/components/ui/primitives";

/**
 * Persönliche Notizen zur Lektion – optional an eine Medien-Sekunde
 * geheftet ("Notiz bei 4:32"); der Zeit-Chip springt im Player dorthin.
 * Nur für den Verfasser sichtbar; Export als Markdown.
 */

const Card = styled.section`
  margin-top: 1.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.25rem 1.4rem;
`;

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;

  h3 {
    font-size: 1.05rem;
    margin-right: auto;

    span {
      margin-right: 0.4rem;
    }
  }
`;

const Count = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  padding: 0.15rem 0.55rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.violetSoft};
  color: ${({ theme }) => theme.colors.violet};
`;

const ExportButton = styled.button`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const NoteList = styled.ul`
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const NoteItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
`;

const TimeChip = styled.button`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
  border: 1px solid rgba(200, 255, 77, 0.35);

  &:hover {
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const NoteText = styled.p`
  flex: 1;
  font-size: 0.9rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
`;

const NoteButton = styled.button`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.8rem;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }
`;

const NoteArea = styled.textarea`
  width: 100%;
  min-height: 72px;
  resize: none;
  overflow-y: auto;
  max-height: 180px;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.65rem 0.9rem;
  font-size: 0.9rem;
  line-height: 1.55;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const Composer = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ComposerRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
`;

const StampToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;

  input {
    accent-color: ${({ theme }) => theme.colors.accent};
    width: 15px;
    height: 15px;
  }
`;

const Empty = styled.p`
  margin-top: 0.9rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export interface MediaStamp {
  blockId: string;
  seconds: number;
}

export function LessonNotes({
  lessonId,
  lessonTitle,
  getStamp,
  onSeek,
}: {
  lessonId: string;
  lessonTitle: string;
  /** aktuelle Medienposition (null = noch kein Medium gestartet) */
  getStamp: () => MediaStamp | null;
  /** springt im passenden Medienblock an die Sekunde */
  onSeek: (blockId: string, seconds: number) => void;
}) {
  const t = useTranslations("learn");
  const tc = useTranslations("common");
  const [notes, setNotes] = useState<LessonNoteDto[]>([]);
  const [draft, setDraft] = useState("");
  const [withStamp, setWithStamp] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  /* Zeitstempel wird beim Fokussieren des Eingabefelds eingefroren –
     "Notiz bei 4:32" meint den Moment, in dem man zu schreiben beginnt */
  const [stamp, setStamp] = useState<MediaStamp | null>(null);

  useEffect(() => {
    let cancelled = false;
    listLessonNotes(lessonId).then((result) => {
      if (!cancelled && result.ok) setNotes(result.notes ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function add() {
    if (!draft.trim()) return;
    setBusy(true);
    const useStamp = withStamp && stamp ? stamp : null;
    const result = await addLessonNote({
      lessonId,
      content: draft,
      blockId: useStamp?.blockId ?? null,
      timeSeconds: useStamp?.seconds ?? null,
    });
    setBusy(false);
    if (result.ok && result.notes?.[0]) {
      const note = result.notes[0];
      setNotes((prev) =>
        [...prev, note].sort(
          (a, b) => (a.timeSeconds ?? -1) - (b.timeSeconds ?? -1)
        )
      );
      setDraft("");
      setStamp(null);
    }
  }

  async function saveEdit(noteId: string) {
    const result = await updateLessonNote({ noteId, content: editText });
    if (result.ok) {
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, content: editText } : n))
      );
      setEditingId(null);
    }
  }

  async function remove(noteId: string) {
    const result = await deleteLessonNote(noteId);
    if (result.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  function exportMarkdown() {
    const lines = [
      `# ${t("notesTitle")} – ${lessonTitle}`,
      "",
      ...notes.map((note) =>
        note.timeSeconds !== null
          ? `- **${formatChapterTime(note.timeSeconds)}** – ${note.content}`
          : `- ${note.content}`
      ),
      "",
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notizen-${lessonId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card aria-label={t("notesTitle")}>
      <Head>
        <h3>
          <span aria-hidden>📝</span>
          {t("notesTitle")}
        </h3>
        {notes.length > 0 ? (
          <>
            <Count>{notes.length}</Count>
            <ExportButton type="button" onClick={exportMarkdown}>
              ↓ {t("notesExport")}
            </ExportButton>
          </>
        ) : null}
      </Head>

      {notes.length === 0 ? <Empty>{t("notesEmpty")}</Empty> : null}

      <NoteList>
        {notes.map((note) => (
          <NoteItem key={note.id}>
            {note.timeSeconds !== null && note.blockId ? (
              <TimeChip
                type="button"
                aria-label={t("notesJump", {
                  time: formatChapterTime(note.timeSeconds),
                })}
                onClick={() => onSeek(note.blockId!, note.timeSeconds!)}
              >
                ⏱ {formatChapterTime(note.timeSeconds)}
              </TimeChip>
            ) : null}

            {editingId === note.id ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <NoteArea
                  value={editText}
                  aria-label={t("notesEditLabel")}
                  onChange={(e) => setEditText(e.target.value)}
                  maxLength={4000}
                />
                <ComposerRow>
                  <PrimaryButton
                    type="button"
                    disabled={!editText.trim()}
                    onClick={() => saveEdit(note.id)}
                  >
                    {tc("save")}
                  </PrimaryButton>
                  <GhostButton type="button" onClick={() => setEditingId(null)}>
                    {tc("cancel")}
                  </GhostButton>
                </ComposerRow>
              </div>
            ) : (
              <>
                <NoteText>{note.content}</NoteText>
                <NoteButton
                  type="button"
                  aria-label={`${tc("edit")}: ${note.content.slice(0, 30)}`}
                  onClick={() => {
                    setEditingId(note.id);
                    setEditText(note.content);
                  }}
                >
                  ✎
                </NoteButton>
                <NoteButton
                  type="button"
                  aria-label={`${tc("delete")}: ${note.content.slice(0, 30)}`}
                  onClick={() => remove(note.id)}
                >
                  ✕
                </NoteButton>
              </>
            )}
          </NoteItem>
        ))}
      </NoteList>

      <Composer>
        <NoteArea
          value={draft}
          placeholder={t("notesPlaceholder")}
          aria-label={t("notesTitle")}
          maxLength={4000}
          onFocus={() => {
            if (!draft.trim()) setStamp(getStamp());
          }}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ComposerRow>
          <PrimaryButton
            type="button"
            disabled={busy || !draft.trim()}
            onClick={add}
          >
            {t("notesAdd")}
          </PrimaryButton>
          {stamp ? (
            <StampToggle>
              <input
                type="checkbox"
                checked={withStamp}
                onChange={(e) => setWithStamp(e.target.checked)}
              />
              {t("notesAtTime", {
                time: formatChapterTime(stamp.seconds),
              })}
            </StampToggle>
          ) : null}
        </ComposerRow>
      </Composer>
    </Card>
  );
}
