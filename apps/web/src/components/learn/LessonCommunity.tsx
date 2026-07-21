"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled, { css } from "styled-components";
import {
  addLessonComment,
  deleteLessonComment,
  loadLessonComments,
  type LessonCommentDto,
} from "@/app/actions/comment-actions";
import { RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RichText } from "@/components/ui/RichText";
import {
  Badge,
  GhostButton,
  Muted,
  PrimaryButton,
} from "@/components/ui/primitives";
import type { MentionItem } from "@/components/ui/RichTextEditor";

/* ---------- Layout ---------- */

const Section = styled.section`
  margin-top: 2.5rem;
  padding-top: 1.75rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const ToggleButton = styled.button`
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  /* nie die Bausteine einzeln umbrechen – lange Titel brechen im h3 um */
  flex-wrap: nowrap;
  max-width: 100%;
  text-align: left;

  h3 {
    font-size: 1.25rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &:hover h3 {
    color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

const Chevron = styled.span<{ $open: boolean }>`
  display: inline-block;
  align-self: center;
  flex-shrink: 0;
  transition: transform 250ms ease;
  transform: rotate(${({ $open }) => ($open ? "90deg" : "0deg")});

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* sanftes Auf-/Zuklappen auf unbekannte Höhe (Grid-Trick) */
const Collapse = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? "1fr" : "0fr")};
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  transition: grid-template-rows 300ms ease, opacity 300ms ease;

  > div {
    overflow: hidden;
    padding: 3px;
    margin: -3px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const CountBadge = styled.span`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Composer = styled.div`
  margin-top: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const ComposerActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
`;

const ErrorLine = styled.p`
  color: ${({ theme }) => theme.colors.danger};
  font-size: 0.85rem;
`;

const Thread = styled.ol`
  list-style: none;
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Replies = styled.ol`
  list-style: none;
  margin-top: 0.8rem;
  padding-left: clamp(0.8rem, 4vw, 1.6rem);
  border-left: 2px solid rgba(139, 124, 255, 0.35);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

/* ---------- Kommentar-Karte ---------- */

const CommentCard = styled.article<{ $creator: boolean }>`
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.9rem 1.1rem;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};

  ${({ $creator, theme }) =>
    $creator
      ? css`
          /* Creator-Antworten leuchten unverkennbar heraus – der innere
             Layer muss OPAK sein (bgDeep), sonst scheint der Rahmen-
             Verlauf durch die ganze Karte und macht Text unlesbar */
          border: 1.5px solid transparent;
          background:
            linear-gradient(${theme.colors.bgDeep}, ${theme.colors.bgDeep})
              padding-box,
            linear-gradient(120deg, ${theme.colors.violet}, ${theme.colors.accent})
              border-box;
          box-shadow: 0 0 22px rgba(139, 124, 255, 0.14);
        `
      : ""}
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
`;

const Avatar = styled.span<{ $creator: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.onAccent};
  background: ${({ $creator, theme }) =>
    $creator
      ? `linear-gradient(135deg, ${theme.colors.violet}, ${theme.colors.accent})`
      : theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const AuthorName = styled.span`
  font-weight: 600;
  font-size: 0.92rem;
`;

const TimeStamp = styled.time`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Content = styled.div`
  margin-top: 0.55rem;
  font-size: 0.95rem;
`;

const FootRow = styled.div`
  margin-top: 0.5rem;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;

  button {
    font-size: 0.78rem;
    padding: 0.25rem 0.7rem;
  }
`;

const DeletedNote = styled.p`
  margin-top: 0.5rem;
  font-size: 0.88rem;
  font-style: italic;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const EmptyState = styled.p`
  margin-top: 1.4rem;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.95rem;
`;

/** Antworten sind bis Ebene 2 erlaubt (3 Ebenen insgesamt). */
const MAX_REPLY_DEPTH = 2;

export interface CommunityViewer {
  viewerId: string;
  viewerName: string;
  creatorId: string;
  creatorName: string;
}

interface CommentNode extends LessonCommentDto {
  children: CommentNode[];
}

function buildTree(comments: LessonCommentDto[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, children: [] });
  }
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Antwort-Editor mit @Mention des Angesprochenen vorbefüllen. */
function mentionPrefill(name: string, id: string): string {
  const safe = name.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<p><span class="mention" data-type="mention" data-id="${id}" data-label="${safe}">@${safe}</span>&nbsp;</p>`;
}

export function LessonCommunity({
  lessonId,
  viewer,
}: {
  lessonId: string;
  viewer: CommunityViewer;
}) {
  const t = useTranslations("community");
  const locale = useLocale();

  const [comments, setComments] = useState<LessonCommentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [pending, setPending] = useState(false);
  /** Ziel einer Antwort (Kommentar-ID) oder null = Top-Level-Composer */
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /** remountet die Editoren nach dem Absenden (TipTap leert sich nicht selbst) */
  const [composerVersion, setComposerVersion] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // default zugeklappt – öffnet nur per Klick; Inhalte (und das Laden der
  // Kommentare) starten erst beim ersten Öffnen
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  // Lektion gewechselt → Zustand zurücksetzen (Render-Phase-Anpassung,
  // offizielles React-Muster statt setState im Effect)
  const [prevLessonId, setPrevLessonId] = useState(lessonId);
  if (prevLessonId !== lessonId) {
    setPrevLessonId(lessonId);
    setComments(null);
    setReplyTo(null);
    setDraft("");
    setOpen(false);
    setEverOpened(false);
  }

  // Kommentare der aktiven Lektion laden (erst beim ersten Öffnen)
  useEffect(() => {
    if (!everOpened) return;
    let cancelled = false;
    loadLessonComments(lessonId).then((result) => {
      if (cancelled) return;
      setComments(result.ok ? (result.comments ?? []) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId, everOpened]);

  const tree = useMemo(() => buildTree(comments ?? []), [comments]);

  // @Mention-Vorschläge: alle bisherigen Kommentatoren + Creator, ohne mich
  const mentionItems = useMemo<MentionItem[]>(() => {
    const map = new Map<string, string>();
    map.set(viewer.creatorId, viewer.creatorName);
    for (const comment of comments ?? []) {
      if (!comment.deleted) map.set(comment.userId, comment.userName);
    }
    map.delete(viewer.viewerId);
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [comments, viewer]);

  async function reload() {
    const result = await loadLessonComments(lessonId);
    if (result.ok) setComments(result.comments ?? []);
  }

  async function submit(parentId: string | null) {
    setPending(true);
    setError(null);
    setFlagReason("");
    const result = await addLessonComment({
      lessonId,
      parentId,
      content: draft,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "generic");
      setFlagReason(result.reason ?? "");
      return;
    }
    setDraft("");
    setReplyTo(null);
    setComposerVersion((v) => v + 1);
    await reload();
  }

  function startReply(comment: LessonCommentDto) {
    setError(null);
    setDraft(
      comment.userId === viewer.viewerId
        ? ""
        : mentionPrefill(comment.userName, comment.userId)
    );
    setReplyTo(comment.id);
    setComposerVersion((v) => v + 1);
  }

  async function removeComment(id: string) {
    setConfirmDelete(null);
    await deleteLessonComment(id);
    await reload();
  }

  function editor(parentId: string | null) {
    return (
      <Composer>
        <RichTextEditor
          key={`c-${parentId ?? "root"}-${composerVersion}`}
          compact
          label={parentId ? t("replyLabel") : t("composeLabel")}
          value={draft}
          placeholder={parentId ? t("replyPlaceholder") : t("placeholder")}
          mentions={mentionItems}
          onChange={setDraft}
        />
        <ComposerActions>
          {parentId ? (
            <GhostButton
              type="button"
              onClick={() => {
                setReplyTo(null);
                setDraft("");
              }}
            >
              {t("cancel")}
            </GhostButton>
          ) : null}
          <PrimaryButton
            type="button"
            disabled={pending || !draft.trim()}
            onClick={() => void submit(parentId)}
          >
            {pending ? t("posting") : t("post")}
          </PrimaryButton>
        </ComposerActions>
        {error ? (
          <ErrorLine role="alert">
            {error === "content_flagged"
              ? t("flagged", { reason: flagReason })
              : t(`errors.${error}` as never)}
          </ErrorLine>
        ) : null}
      </Composer>
    );
  }

  function renderComment(node: CommentNode) {
    const canReply = node.depth < MAX_REPLY_DEPTH && !node.deleted;
    const canDelete =
      !node.deleted &&
      (node.userId === viewer.viewerId ||
        viewer.viewerId === viewer.creatorId);
    const created = new Date(node.createdAt);

    return (
      <li key={node.id}>
        <CommentCard $creator={node.isCreator}>
          <MetaRow>
            <Avatar $creator={node.isCreator} aria-hidden="true">
              {node.userImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
                <img src={node.userImage} alt="" />
              ) : (
                (node.userName || "?").charAt(0).toUpperCase()
              )}
            </Avatar>
            <AuthorName>{node.userName}</AuthorName>
            {node.isCreator ? (
              <Badge $tone="accent">★ {t("creatorBadge")}</Badge>
            ) : null}
            <TimeStamp dateTime={node.createdAt}>
              {created.toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </TimeStamp>
          </MetaRow>

          {node.deleted ? (
            <DeletedNote>{t("deletedPlaceholder")}</DeletedNote>
          ) : (
            <Content>
              <RichText html={node.content} />
            </Content>
          )}

          <FootRow>
            {canReply ? (
              <GhostButton type="button" onClick={() => startReply(node)}>
                ↩ {t("reply")}
              </GhostButton>
            ) : null}
            {canDelete ? (
              <GhostButton
                type="button"
                onClick={() => setConfirmDelete(node.id)}
              >
                🗑 {t("delete")}
              </GhostButton>
            ) : null}
          </FootRow>

          {replyTo === node.id ? editor(node.id) : null}
        </CommentCard>

        {node.children.length > 0 ? (
          <Replies>{node.children.map(renderComment)}</Replies>
        ) : null}
      </li>
    );
  }

  const count = (comments ?? []).filter((c) => !c.deleted).length;

  return (
    <Section aria-label={t("title")}>
      <ToggleButton
        type="button"
        aria-expanded={open}
        aria-controls="lesson-community-panel"
        onClick={() => {
          setOpen((o) => !o);
          setEverOpened(true);
        }}
      >
        <Chevron $open={open} aria-hidden="true">
          ▸
        </Chevron>
        <h3>💬 {t("title")}</h3>
        <CountBadge aria-hidden="true">
          {everOpened ? (comments === null ? "…" : count) : ""}
        </CountBadge>
      </ToggleButton>

      <Collapse id="lesson-community-panel" $open={open} inert={!open}>
        <div>
          {everOpened ? (
            <>
              <Muted style={{ fontSize: "0.88rem", marginTop: "0.5rem" }}>
                {t("subtitle")}
              </Muted>

              {replyTo === null ? editor(null) : null}

              {comments === null ? (
                <EmptyState role="status">{t("loading")}</EmptyState>
              ) : tree.length === 0 ? (
                <EmptyState>{t("empty")}</EmptyState>
              ) : (
                <Thread>{tree.map(renderComment)}</Thread>
              )}
            </>
          ) : null}
        </div>
      </Collapse>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (confirmDelete) void removeComment(confirmDelete);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </Section>
  );
}
