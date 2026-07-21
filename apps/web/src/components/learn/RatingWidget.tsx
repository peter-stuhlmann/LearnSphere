"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import { rateCourse, saveReviewComment } from "@/app/actions/review-actions";
import { GhostButton } from "@/components/ui/primitives";
import { RichTextEditor } from "@/components/ui/RichTextEditorLazy";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const StarRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const Label = styled.span`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Stars = styled.div`
  display: inline-flex;
  gap: 2px;
`;

const Star = styled.button<{ $filled: boolean }>`
  font-size: 1.35rem;
  line-height: 1;
  padding: 0.2rem;
  color: ${({ theme, $filled }) =>
    $filled ? theme.colors.accent : theme.colors.textFaint};
  transition: transform 120ms ease, color 120ms ease;
  text-shadow: ${({ $filled }) =>
    $filled ? "0 0 14px rgba(200, 255, 77, 0.5)" : "none"};

  &:hover {
    transform: scale(1.2);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const Thanks = styled.span`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.success};
`;

const ReviewArea = styled(motion.div)`
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ReviewFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ReviewError = styled.span`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.danger};
`;

export function RatingWidget({
  courseId,
  initialRating,
  initialComment,
}: {
  courseId: string;
  initialRating: number | null;
  initialComment: string | null;
}) {
  const t = useTranslations("rating");
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState(initialComment ?? "");
  const [savedComment, setSavedComment] = useState(initialComment ?? "");
  const [commentSaved, setCommentSaved] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  /* Nach der Aufklapp-Animation overflow freigeben, sonst clippt der
     Container das Bubble-Menü und den Fokus-Rahmen des Editors. Existiert
     beim Laden schon eine Bewertung, läuft KEINE Animation (initial=false)
     und onAnimationComplete feuert nie – dann direkt freigeben. */
  const [entered, setEntered] = useState(initialRating !== null);
  const [pending, startTransition] = useTransition();

  function submit(value: number) {
    setRating(value);
    setSaved(false);
    startTransition(async () => {
      const result = await rateCourse({ courseId, rating: value });
      if (result.ok) setSaved(true);
    });
  }

  function submitComment() {
    setCommentSaved(false);
    setCommentError(null);
    startTransition(async () => {
      const result = await saveReviewComment({ courseId, comment });
      if (result.ok) {
        setSavedComment(comment.trim());
        setCommentSaved(true);
      } else {
        setCommentError(
          result.error === "comment_too_long"
            ? t("reviewTooLong")
            : t("reviewError")
        );
      }
    });
  }

  const display = hovered ?? rating ?? 0;
  const commentDirty = comment.trim() !== savedComment.trim();

  return (
    <Wrap role="group" aria-label={t("title")}>
      <StarRow>
        <Label id={`rating-label-${courseId}`}>{t("title")}:</Label>
        <Stars
          aria-labelledby={`rating-label-${courseId}`}
          onMouseLeave={() => setHovered(null)}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              type="button"
              $filled={value <= display}
              aria-label={t("star", { count: value })}
              aria-pressed={rating === value}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onBlur={() => setHovered(null)}
              onClick={() => submit(value)}
            >
              {value <= display ? "★" : "☆"}
            </Star>
          ))}
        </Stars>
        {saved ? <Thanks role="status">{t("saved")}</Thanks> : null}
      </StarRow>

      {/* Textfeld klappt auf, sobald eine Bewertung existiert */}
      <AnimatePresence initial={false}>
        {rating !== null ? (
          <ReviewArea
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.21, 0.8, 0.35, 1] }}
            style={{ overflow: entered ? "visible" : "hidden" }}
            onAnimationComplete={() => setEntered(true)}
          >
            <RichTextEditor
              label={t("reviewLabel")}
              value={comment}
              placeholder={t("reviewPlaceholder")}
              marksOnly
              fixedHeight
              compact
              onChange={(html) => {
                setComment(html);
                setCommentSaved(false);
              }}
            />
            <ReviewFooter>
              <GhostButton
                type="button"
                disabled={pending || !commentDirty}
                onClick={submitComment}
              >
                {t("reviewSave")}
              </GhostButton>
              {commentSaved ? (
                <Thanks role="status">{t("reviewSaved")}</Thanks>
              ) : null}
              {commentError ? (
                <ReviewError role="alert">{commentError}</ReviewError>
              ) : null}
            </ReviewFooter>
          </ReviewArea>
        ) : null}
      </AnimatePresence>
    </Wrap>
  );
}
