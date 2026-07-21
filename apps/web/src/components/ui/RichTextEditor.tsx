"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import Mention from "@tiptap/extension-mention";
import { ensureHtml } from "@/lib/richtext";

export interface MentionItem {
  id: string;
  label: string;
}

/**
 * Leichtgewichtiges Vorschlags-Dropdown für @Mentions (ohne Zusatz-Lib):
 * fixed positioniert am Cursor, Pfeiltasten + Enter, ARIA-Listbox.
 */
function createMentionSuggestion(getItems: () => MentionItem[]) {
  return {
    char: "@",
    items: ({ query }: { query: string }) =>
      getItems()
        .filter((item) =>
          item.label.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 6),
    render: () => {
      let list: HTMLDivElement | null = null;
      let items: MentionItem[] = [];
      let selected = 0;
      let command: ((item: MentionItem) => void) | null = null;

      const draw = () => {
        if (!list) return;
        list.innerHTML = "";
        items.forEach((item, index) => {
          const option = document.createElement("button");
          option.type = "button";
          option.setAttribute("role", "option");
          option.setAttribute(
            "aria-selected",
            index === selected ? "true" : "false"
          );
          option.textContent = `@${item.label}`;
          option.style.cssText = `display:block;width:100%;text-align:left;padding:7px 12px;border:0;border-radius:8px;cursor:pointer;font-size:0.88rem;background:${
            index === selected ? "rgba(200,255,77,0.16)" : "transparent"
          };color:${index === selected ? "#C8FF4D" : "#E8EAF2"};`;
          option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            command?.(item);
          });
          list?.appendChild(option);
        });
      };

      const position = (rect: DOMRect | null) => {
        if (!list || !rect) return;
        list.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`;
        list.style.top = `${rect.bottom + 6}px`;
      };

      type SuggestionProps = {
        items: MentionItem[];
        command: (item: MentionItem) => void;
        clientRect?: (() => DOMRect | null) | null;
      };

      return {
        onStart(props: SuggestionProps) {
          items = props.items;
          command = props.command;
          selected = 0;
          list = document.createElement("div");
          list.setAttribute("role", "listbox");
          list.style.cssText =
            "position:fixed;z-index:80;min-width:200px;max-width:260px;padding:5px;border-radius:14px;background:#0d0f18;border:1px solid rgba(139,124,255,0.45);box-shadow:0 14px 44px rgba(0,0,0,0.6);";
          document.body.appendChild(list);
          draw();
          position(props.clientRect?.() ?? null);
        },
        onUpdate(props: SuggestionProps) {
          items = props.items;
          command = props.command;
          selected = Math.min(selected, Math.max(0, items.length - 1));
          draw();
          position(props.clientRect?.() ?? null);
        },
        onKeyDown({ event }: { event: KeyboardEvent }) {
          if (!list || items.length === 0) return false;
          if (event.key === "ArrowDown") {
            selected = (selected + 1) % items.length;
            draw();
            return true;
          }
          if (event.key === "ArrowUp") {
            selected = (selected - 1 + items.length) % items.length;
            draw();
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            command?.(items[selected]);
            return true;
          }
          if (event.key === "Escape") {
            list.remove();
            list = null;
            return true;
          }
          return false;
        },
        onExit() {
          list?.remove();
          list = null;
        },
      };
    },
  };
}

const Shell = styled.div<{ $compact?: boolean; $fixedHeight?: boolean }>`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  transition: border-color 180ms ease, box-shadow 180ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  /* Fokusring liegt AUF dem Rahmen (Border + Inset-Shadow) statt als
     äußeres Outline: folgt so exakt dem Radius und kann von overflow:hidden-
     Eltern (Aufklapp-Animationen, Cards) nicht abgeschnitten werden */
  &:focus-within {
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow:
      inset 0 0 0 1px ${({ theme }) => theme.colors.accent},
      0 0 32px rgba(200, 255, 77, 0.12);
  }

  .ProseMirror {
    /* mobile first: der Placeholder nimmt keinen Layoutplatz ein
       (float + height 0) – auf schmalen Screens braucht er bis zu
       drei Zeilen, deshalb dort mehr Grundhöhe */
    min-height: ${({ $compact }) => ($compact ? "128px" : "160px")};
    padding: 0.9rem 1rem;

    @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
      min-height: ${({ $compact }) => ($compact ? "84px" : "140px")};
    }
    outline: none;
    caret-color: ${({ theme }) => theme.colors.accent};
    line-height: 1.7;

    > * + * {
      margin-top: 0.6em;
    }

    h2 {
      font-size: 1.35rem;
    }

    h3 {
      font-size: 1.15rem;
    }

    ul,
    ol {
      padding-left: 1.4rem;
    }

    blockquote {
      border-left: 3px solid ${({ theme }) => theme.colors.violet};
      padding-left: 1rem;
      color: ${({ theme }) => theme.colors.textMuted};
      font-style: italic;
    }

    code {
      font-family: ${({ theme }) => theme.fonts.mono};
      font-size: 0.88em;
      background: ${({ theme }) => theme.colors.surface};
      border: 1px solid ${({ theme }) => theme.colors.border};
      border-radius: 5px;
      padding: 0.1em 0.4em;
      color: ${({ theme }) => theme.colors.accent};
    }

    pre {
      background: ${({ theme }) => theme.colors.bgDeep};
      border: 1px solid ${({ theme }) => theme.colors.border};
      border-radius: ${({ theme }) => theme.radii.sm};
      padding: 0.9rem 1rem;
      overflow-x: auto;

      code {
        background: none;
        border: none;
        padding: 0;
      }
    }

    a {
      color: ${({ theme }) => theme.colors.accent};
      text-underline-offset: 3px;
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
      color: ${({ theme }) => theme.colors.textFaint};
    }

    .mention {
      display: inline-block;
      padding: 0.05em 0.45em;
      border-radius: ${({ theme }) => theme.radii.pill};
      background: rgba(139, 124, 255, 0.18);
      border: 1px solid rgba(139, 124, 255, 0.4);
      color: ${({ theme }) => theme.colors.violet};
      font-weight: 600;
      font-size: 0.92em;
    }
  }

  /* Feste Höhe statt Mitwachsen: langer Text scrollt im Feld */
  ${({ $fixedHeight }) =>
    $fixedHeight
      ? css`
          .ProseMirror {
            max-height: 200px;
            overflow-y: auto;
          }
        `
      : ""}
`;

const rise = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const Bubble = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background:
    linear-gradient(${({ theme }) => theme.colors.bgDeep}, ${({ theme }) =>
      theme.colors.bgDeep}) padding-box,
    linear-gradient(120deg, ${({ theme }) => theme.colors.violet}, ${({
      theme,
    }) => theme.colors.accent}) border-box;
  border: 1.5px solid transparent;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.55),
    0 0 24px rgba(139, 124, 255, 0.25);
  backdrop-filter: blur(14px);
  animation: ${rise} 160ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Divider = styled.span`
  width: 1px;
  height: 18px;
  margin-inline: 3px;
  background: ${({ theme }) => theme.colors.border};
`;

const MenuButton = styled.button<{ $active: boolean }>`
  min-width: 30px;
  height: 30px;
  padding-inline: 7px;
  border-radius: ${({ theme }) => theme.radii.pill};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  font-weight: 650;
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.colors.accent};
          color: ${theme.colors.onAccent};
        `
      : css`
          color: ${theme.colors.textMuted};

          &:hover {
            color: ${theme.colors.text};
            background: ${theme.colors.surfaceHover};
            transform: translateY(-1px);
          }
        `}

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

function MarkButton({
  editor,
  label,
  shortcut,
  active,
  onRun,
  children,
}: {
  editor: Editor;
  label: string;
  shortcut?: string;
  active: boolean;
  onRun: () => void;
  children: React.ReactNode;
}) {
  return (
    <MenuButton
      type="button"
      $active={active}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onRun();
        editor.chain().focus().run();
      }}
    >
      {children}
    </MenuButton>
  );
}

interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** aktiviert @Mentions mit diesen Vorschlägen (z. B. Kommentatoren) */
  mentions?: MentionItem[];
  /** kompakter Editor (z. B. Kommentare) */
  compact?: boolean;
  /** nur Zeichen-Formatierung (fett/kursiv/durchgestrichen/unterstrichen) –
      keine Überschriften, Listen, Links etc. (z. B. Kurs-Reviews) */
  marksOnly?: boolean;
  /** feste Höhe mit Scrollbar statt Mitwachsen */
  fixedHeight?: boolean;
  /** "Mit KI verbessern" im Bubble-Menü: bekommt den markierten Text,
      liefert die verbesserte Fassung (null = Fehler, Auswahl bleibt) */
  onAiImprove?: (selectedText: string) => Promise<string | null>;
}

/**
 * TipTap-Editor mit Bubble-Menü: Formatierung erscheint schwebend über
 * der Textauswahl. Tastatur-Shortcuts (Strg+B/I/…) funktionieren nativ.
 * Mit `mentions` lassen sich per @ andere Personen erwähnen.
 */
export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  mentions,
  compact = false,
  marksOnly = false,
  fixedHeight = false,
  onAiImprove,
}: RichTextEditorProps) {
  const t = useTranslations("rte");
  const [improving, setImproving] = useState(false);

  // Vorschläge können sich ändern (neue Kommentatoren) – die Extension
  // liest sie deshalb über eine Ref statt bei der Initialisierung
  const mentionsRef = useRef<MentionItem[]>(mentions ?? []);
  useEffect(() => {
    mentionsRef.current = mentions ?? [];
  }, [mentions]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure(
        marksOnly
          ? {
              // nur Zeichen-Formatierung: Blöcke & Links abschalten,
              // eingefügter Reichtext wird dadurch automatisch reduziert
              heading: false,
              bulletList: false,
              orderedList: false,
              listItem: false,
              blockquote: false,
              code: false,
              codeBlock: false,
              horizontalRule: false,
              link: false,
            }
          : {
              heading: { levels: [2, 3] },
              link: {
                openOnClick: false,
                autolink: true,
                protocols: ["http", "https", "mailto"],
              },
            }
      ),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ...(mentions
        ? [
            Mention.configure({
              HTMLAttributes: { class: "mention" },
              renderText: ({ node }) =>
                `@${node.attrs.label ?? node.attrs.id}`,
              // eslint-disable-next-line react-hooks/refs -- der Getter läuft nur zur Event-Zeit (Tippen von "@"), nie im Render
              suggestion: createMentionSuggestion(() => mentionsRef.current),
            }),
          ]
        : []),
    ],
    content: ensureHtml(value),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.isEmpty ? "" : instance.getHTML());
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // Externe value-Änderungen (z. B. wiederhergestellter Entwurf) in den
  // Editor übernehmen – aber nie während des Tippens (Cursor-Sprünge)
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(ensureHtml(value), { emitUpdate: false });
    }
  }, [editor, value]);

  /** Markierten Text per KI verbessern und die Auswahl ersetzen. */
  async function runAiImprove() {
    if (!editor || !onAiImprove || improving) return;
    const { from, to } = editor.state.selection;
    if (to - from < 3) return;
    const selectedText = editor.state.doc.textBetween(from, to, "\n");
    setImproving(true);
    try {
      const improved = await onAiImprove(selectedText);
      if (improved) {
        editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, improved)
          .run();
      }
    } finally {
      setImproving(false);
    }
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt(t("linkPrompt"), previous ?? "https://");
    if (input === null) return;
    const url = input.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:")) {
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <Shell $compact={compact} $fixedHeight={fixedHeight}>
      {editor ? (
        <BubbleMenu editor={editor} options={{ placement: "top" }}>
          <Bubble role="toolbar" aria-label={t("toolbar")}>
            <MarkButton
              editor={editor}
              label={t("bold")}
              shortcut="Strg+B"
              active={editor.isActive("bold")}
              onRun={() => editor.chain().focus().toggleBold().run()}
            >
              <strong>B</strong>
            </MarkButton>
            <MarkButton
              editor={editor}
              label={t("italic")}
              shortcut="Strg+I"
              active={editor.isActive("italic")}
              onRun={() => editor.chain().focus().toggleItalic().run()}
            >
              <em>I</em>
            </MarkButton>
            <MarkButton
              editor={editor}
              label={t("strike")}
              active={editor.isActive("strike")}
              onRun={() => editor.chain().focus().toggleStrike().run()}
            >
              <s>S</s>
            </MarkButton>
            {marksOnly ? (
              <MarkButton
                editor={editor}
                label={t("underline")}
                shortcut="Strg+U"
                active={editor.isActive("underline")}
                onRun={() => editor.chain().focus().toggleUnderline().run()}
              >
                <u>U</u>
              </MarkButton>
            ) : null}
            {!marksOnly ? (
              <>
            <MarkButton
              editor={editor}
              label={t("code")}
              active={editor.isActive("code")}
              onRun={() => editor.chain().focus().toggleCode().run()}
            >
              {"</>"}
            </MarkButton>

            <Divider aria-hidden />

            <MarkButton
              editor={editor}
              label={t("h2")}
              active={editor.isActive("heading", { level: 2 })}
              onRun={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              H2
            </MarkButton>
            <MarkButton
              editor={editor}
              label={t("h3")}
              active={editor.isActive("heading", { level: 3 })}
              onRun={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              H3
            </MarkButton>
            <MarkButton
              editor={editor}
              label={t("bulletList")}
              active={editor.isActive("bulletList")}
              onRun={() => editor.chain().focus().toggleBulletList().run()}
            >
              ≔
            </MarkButton>
            <MarkButton
              editor={editor}
              label={t("orderedList")}
              active={editor.isActive("orderedList")}
              onRun={() => editor.chain().focus().toggleOrderedList().run()}
            >
              1.
            </MarkButton>
            <MarkButton
              editor={editor}
              label={t("blockquote")}
              active={editor.isActive("blockquote")}
              onRun={() => editor.chain().focus().toggleBlockquote().run()}
            >
              ❝
            </MarkButton>

            <Divider aria-hidden />

            <MarkButton
              editor={editor}
              label={t("link")}
              active={editor.isActive("link")}
              onRun={setLink}
            >
              ⌁
            </MarkButton>
              </>
            ) : null}
            {onAiImprove ? (
              <>
                <Divider aria-hidden />
                <MenuButton
                  type="button"
                  $active={false}
                  disabled={improving}
                  aria-label={t("aiImprove")}
                  title={t("aiImprove")}
                  aria-busy={improving}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void runAiImprove()}
                >
                  {improving ? "…" : "✦"}
                </MenuButton>
              </>
            ) : null}
          </Bubble>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </Shell>
  );
}
