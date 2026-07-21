"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { aiGeneratedProps } from "@/lib/ai-marking";

/**
 * Lernassistent-Dock: schwebende Pill am unteren Rand der Lernansicht,
 * ausgeklappt ein Chat-Panel (mobile: Bottom-Sheet, Desktop: rechts unten).
 * Kennt nur den aktuellen Kurs; der Verlauf liegt serverseitig je Nutzer+Kurs.
 */

const Dock = styled.div`
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  left: max(16px, env(safe-area-inset-left));
  z-index: 50;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    left: auto;
  }

  > * {
    pointer-events: auto;
  }
`;

const Pill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.8rem 1.25rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid rgba(200, 255, 77, 0.35);
  background: rgba(7, 8, 15, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.9rem;
  box-shadow: 0 12px 40px rgba(7, 8, 15, 0.5);
  transition: border-color 160ms ease, transform 160ms ease;

  span.star {
    color: ${({ theme }) => theme.colors.accent};
  }

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover {
      transform: none;
    }
  }
`;

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(70dvh, 640px);
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: rgba(10, 11, 20, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 24px 60px rgba(7, 8, 15, 0.6);
  overflow: hidden;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: 420px;
    max-height: min(60dvh, 640px);
  }
`;

const PanelHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  h2 {
    flex: 1;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;

    span {
      color: ${({ theme }) => theme.colors.accent};
    }
  }
`;

const HeadButton = styled.button`
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

const Log = styled.div`
  flex: 1;
  min-height: 160px;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-behavior: smooth;

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const Bubble = styled.div<{ $own: boolean }>`
  max-width: 88%;
  padding: 0.65rem 0.9rem;
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  ${({ $own, theme }) =>
    $own
      ? css`
          align-self: flex-end;
          background: ${theme.colors.accentSoft};
          border: 1px solid rgba(200, 255, 77, 0.35);
          border-bottom-right-radius: 4px;
        `
      : css`
          align-self: flex-start;
          background: ${theme.colors.bgElevated};
          border: 1px solid ${theme.colors.border};
          border-bottom-left-radius: 4px;
        `}
`;

const SourceRow = styled.div`
  align-self: flex-start;
  max-width: 88%;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: -0.35rem;
`;

const SourceChip = styled.button`
  font-size: 0.72rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  padding: 0.25rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid rgba(139, 124, 255, 0.4);
  background: rgba(139, 124, 255, 0.12);
  color: ${({ theme }) => theme.colors.violet};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.violet};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const blink = keyframes`
  0%, 80%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
`;

const Thinking = styled.div`
  align-self: flex-start;
  display: inline-flex;
  gap: 4px;
  padding: 0.8rem 0.9rem;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accent};
    animation: ${blink} 1.2s infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const SuggestionChip = styled.button`
  font-size: 0.8rem;
  padding: 0.45rem 0.8rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const LoadOlder = styled.button`
  align-self: center;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const InputRow = styled.form`
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  input {
    flex: 1;
    min-width: 0;
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.pill};
    padding: 0.6rem 1rem;
    font-size: 0.9rem;

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      border-color: transparent;
    }
  }

  button[type="submit"] {
    flex-shrink: 0;
    padding: 0.6rem 1.1rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
    font-weight: 650;
    font-size: 0.88rem;

    &:disabled {
      opacity: 0.5;
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      outline-offset: 2px;
    }
  }
`;

const ErrorLine = styled.p`
  padding: 0 1rem 0.6rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.danger};
`;

interface Source {
  lessonId: string;
  sectionTitle: string;
  lessonTitle: string;
}

interface ChatMessage {
  id?: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: Source[] | null;
  createdAt?: string;
}

export function AssistantDock({
  lessonId,
  lang,
  onJumpToLesson,
}: {
  lessonId: string;
  lang: string;
  onJumpToLesson: (lessonId: string) => void;
}) {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // beim Schließen/Unmount laufende Antwort abbrechen
  useEffect(() => () => abortRef.current?.abort(), []);

  // Escape schließt das Panel
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function scrollToEnd() {
    requestAnimationFrame(() => {
      const log = logRef.current;
      if (log) log.scrollTop = log.scrollHeight;
    });
  }

  async function openPanel() {
    setOpen(true);
    if (!historyLoaded) {
      try {
        const res = await fetch(`/api/assistant?lessonId=${lessonId}`);
        if (res.ok) {
          const data = (await res.json()) as {
            messages: ChatMessage[];
            hasMore: boolean;
          };
          setMessages(data.messages);
          setHasMore(data.hasMore);
        }
      } catch {
        // Verlauf ist optional – Chat funktioniert auch ohne
      }
      setHistoryLoaded(true);
      scrollToEnd();
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function loadOlder() {
    const oldest = messages[0]?.createdAt;
    if (!oldest) return;
    const res = await fetch(
      `/api/assistant?lessonId=${lessonId}&before=${encodeURIComponent(oldest)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: ChatMessage[];
      hasMore: boolean;
    };
    setMessages((current) => [...data.messages, ...current]);
    setHasMore(data.hasMore);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setError(null);
    setInput("");
    setStreaming(true);
    setMessages((current) => [...current, { role: "USER", content: message }]);
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, lang, message }),
        signal: controller.signal,
      });
      if (res.status === 429) {
        setError(t("errorRateLimited"));
        return;
      }
      if (!res.ok || !res.body) {
        setError(t("errorGeneric"));
        return;
      }

      // leere Assistenten-Bubble, die mit dem Stream wächst
      setMessages((current) => [
        ...current,
        { role: "ASSISTANT", content: "" },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const data = line.replace(/^data: ?/, "").trim();
          if (!data) continue;
          const event = JSON.parse(data) as
            | { type: "delta"; text: string }
            | { type: "done"; sources: Source[] }
            | { type: "error" };
          if (event.type === "delta") {
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last,
                content: last.content + event.text,
              };
              return next;
            });
            scrollToEnd();
          } else if (event.type === "done") {
            setMessages((current) => {
              const next = [...current];
              next[next.length - 1] = {
                ...next[next.length - 1],
                sources: event.sources,
              };
              return next;
            });
          } else {
            setError(t("errorGeneric"));
          }
        }
      }
      scrollToEnd();
    } catch {
      if (!controller.signal.aborted) setError(t("errorGeneric"));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function startNewChat() {
    setConfirmNew(false);
    try {
      await fetch("/api/assistant", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      setMessages([]);
      setHasMore(false);
    } catch {
      setError(t("errorGeneric"));
    }
  }

  const suggestions = [
    t("suggestSummary"),
    t("suggestExplain"),
    t("suggestLearnings"),
  ];
  const lastAssistant = messages[messages.length - 1];
  const showThinking =
    streaming &&
    (lastAssistant?.role !== "ASSISTANT" || lastAssistant.content === "");

  return (
    <Dock>
      {open ? (
        <Panel aria-label={t("title")}>
          <PanelHead>
            <h2>
              <span aria-hidden>✦</span> {t("title")}
            </h2>
            {messages.length > 0 ? (
              <HeadButton
                type="button"
                title={t("newChat")}
                aria-label={t("newChat")}
                onClick={() => setConfirmNew(true)}
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M13.5 8 A5.5 5.5 0 1 1 8 2.5 M13.5 2.5 V6 H10" />
                </svg>
              </HeadButton>
            ) : null}
            <HeadButton
              type="button"
              aria-label={t("close")}
              onClick={() => setOpen(false)}
            >
              ✕
            </HeadButton>
          </PanelHead>

          <Log ref={logRef} role="log" aria-live="polite">
            {hasMore ? (
              <LoadOlder type="button" onClick={() => void loadOlder()}>
                {t("loadOlder")}
              </LoadOlder>
            ) : null}
            {messages.length === 0 && historyLoaded ? (
              <>
                <Bubble $own={false}>{t("welcome")}</Bubble>
                <Suggestions>
                  {suggestions.map((suggestion) => (
                    <SuggestionChip
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </SuggestionChip>
                  ))}
                </Suggestions>
              </>
            ) : null}
            {messages.map((entry, i) => (
              <div key={entry.id ?? i} style={{ display: "contents" }}>
                <Bubble
                  $own={entry.role === "USER"}
                  // Assistent-Antworten sind KI-generiert → Kennzeichnung
                  {...(entry.role === "ASSISTANT" ? aiGeneratedProps : {})}
                >
                  {entry.content}
                </Bubble>
                {entry.role === "ASSISTANT" && entry.sources?.length ? (
                  <SourceRow>
                    {entry.sources.map((source) => (
                      <SourceChip
                        key={source.lessonId}
                        type="button"
                        onClick={() => onJumpToLesson(source.lessonId)}
                      >
                        {[source.sectionTitle, source.lessonTitle]
                          .filter(Boolean)
                          .join(" · ")}
                      </SourceChip>
                    ))}
                  </SourceRow>
                ) : null}
              </div>
            ))}
            {showThinking ? (
              <Thinking aria-label={t("thinking")}>
                <span />
                <span />
                <span />
              </Thinking>
            ) : null}
          </Log>

          {error ? <ErrorLine role="alert">{error}</ErrorLine> : null}

          <InputRow
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              maxLength={2000}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" disabled={streaming || !input.trim()}>
              {t("send")}
            </button>
          </InputRow>
        </Panel>
      ) : (
        <Pill type="button" onClick={() => void openPanel()}>
          <span className="star" aria-hidden>
            ✦
          </span>
          {t("pill")}
        </Pill>
      )}

      <ConfirmDialog
        open={confirmNew}
        title={t("newChatTitle")}
        message={t("newChatMessage")}
        confirmLabel={t("newChatConfirm")}
        cancelLabel={t("newChatCancel")}
        onConfirm={() => void startNewChat()}
        onCancel={() => setConfirmNew(false)}
      />
    </Dock>
  );
}
