"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/react";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { formatPrice } from "@elearning/core/format";

/**
 * E-Mail-Blöcke für den Creator-Mail-Editor: Kurs-Cards (mit Kurssuche),
 * Bild-Grid (mit Upload) und CTA-Button – eingefügt über ein Slash-Menü
 * ("/"). Die Nodes serialisieren zu leeren <div data-type=…>-Platzhaltern;
 * lib/creator-emails.ts übersetzt sie beim Versand in E-Mail-Tabellen.
 */

export interface EmailBlockCourse {
  slug: string;
  title: string;
  coverImage: string | null;
  priceCents: number;
  currency: string;
  /** eigener Kurs → beim Versand ohne Affiliate-Link */
  own?: boolean;
  creatorName?: string;
}

export interface EmailBlockOptions {
  searchCourses: (query: string) => Promise<EmailBlockCourse[]>;
}

/* ------------------------------------------------------------------ *
 * Gemeinsame Block-Optik im Editor
 * ------------------------------------------------------------------ */

const BlockCard = styled.div`
  margin: 0.6rem 0;
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
  padding: 0.85rem 1rem;

  .ProseMirror-selectednode & {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const BlockHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.7rem;

  strong {
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${({ theme }) => theme.colors.textMuted};
    flex: 1;
  }
`;

const RemoveBlockButton = styled.button`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};

  &:hover {
    color: ${({ theme }) => theme.colors.danger};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const ColumnPills = styled.div`
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.15rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
`;

const ColumnPill = styled.button<{ $active: boolean }>`
  min-width: 26px;
  padding: 0.2rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.75rem;
  font-weight: 600;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onAccent : theme.colors.textMuted};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

/* ------------------------------------------------------------------ *
 * Kurs-Grid
 * ------------------------------------------------------------------ */

const CourseChipGrid = styled.div<{ $columns: number }>`
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(
    ${({ $columns }) => Math.min($columns, 2)},
    1fr
  );

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(${({ $columns }) => $columns}, 1fr);
  }
`;

const CourseChip = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 0.45rem 0.55rem;
  min-width: 0;

  img {
    width: 42px;
    height: 24px;
    object-fit: cover;
    border-radius: 5px;
    flex-shrink: 0;
  }

  .title {
    flex: 1;
    min-width: 0;
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .price {
    font-size: 0.72rem;
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.accent};
    flex-shrink: 0;
  }

  button {
    color: ${({ theme }) => theme.colors.textFaint};
    font-size: 0.8rem;
    flex-shrink: 0;

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
    }
  }
`;

const SearchWrap = styled.div`
  position: relative;
  margin-top: 0.6rem;
`;

const SearchInput = styled.input`
  width: 100%;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.45rem 0.9rem;
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

const ResultList = styled.ul`
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  list-style: none;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};
  max-height: 220px;
  overflow-y: auto;
`;

const ResultButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text};

  img {
    width: 42px;
    height: 24px;
    object-fit: cover;
    border-radius: 5px;
  }

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.colors.accentSoft};
    color: ${({ theme }) => theme.colors.accent};
    outline: none;
  }
`;

const HintText = styled.p`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

function CourseGridView({ node, updateAttributes, deleteNode, extension }: NodeViewProps) {
  const t = useTranslations("rte");
  const locale = useLocale();
  const courses = (node.attrs.courses ?? []) as EmailBlockCourse[];
  const columns = (node.attrs.columns ?? 3) as number;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmailBlockCourse[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  function search(value: string) {
    setQuery(value);
    const request = ++requestId.current;
    if (value.trim().length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }
    const options = extension.options as EmailBlockOptions;
    void options.searchCourses(value).then((found) => {
      if (request !== requestId.current) return;
      setResults(
        found.filter(
          (course) => !courses.some((c) => c.slug === course.slug)
        )
      );
      setOpen(true);
    });
  }

  function addCourse(course: EmailBlockCourse) {
    if (courses.length >= 9) return;
    updateAttributes({ courses: [...courses, course] });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function removeCourse(slug: string) {
    updateAttributes({
      courses: courses.filter((course) => course.slug !== slug),
    });
  }

  return (
    <NodeViewWrapper data-drag-handle>
      <BlockCard contentEditable={false}>
        <BlockHead>
          <span aria-hidden>🎓</span>
          <strong>{t("courseGridTitle")}</strong>
          <ColumnPills
            role="group"
            aria-label={t("courseGridColumns")}
          >
            {[1, 2, 3].map((value) => (
              <ColumnPill
                key={value}
                type="button"
                $active={columns === value}
                aria-pressed={columns === value}
                onClick={() => updateAttributes({ columns: value })}
              >
                {value}
              </ColumnPill>
            ))}
          </ColumnPills>
          <RemoveBlockButton
            type="button"
            aria-label={t("removeBlock")}
            onClick={() => deleteNode()}
          >
            ✕
          </RemoveBlockButton>
        </BlockHead>

        {courses.length > 0 ? (
          <CourseChipGrid $columns={columns}>
            {courses.map((course) => (
              <CourseChip key={course.slug}>
                {course.coverImage?.startsWith("/uploads/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- kleines Editor-Thumbnail
                  <img src={course.coverImage} alt="" />
                ) : null}
                <span className="title">{course.title}</span>
                <span className="price">
                  {formatPrice(course.priceCents, course.currency, locale)}
                </span>
                <button
                  type="button"
                  aria-label={`${t("removeCourse")}: ${course.title}`}
                  onClick={() => removeCourse(course.slug)}
                >
                  ✕
                </button>
              </CourseChip>
            ))}
          </CourseChipGrid>
        ) : null}

        {courses.length < 9 ? (
          <SearchWrap>
            <SearchInput
              type="search"
              value={query}
              placeholder={t("courseSearchPlaceholder")}
              aria-label={t("courseSearchPlaceholder")}
              onChange={(event) => search(event.target.value)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {open && results.length > 0 ? (
              <ResultList role="listbox">
                {results.map((course) => (
                  <li key={course.slug} role="option" aria-selected={false}>
                    <ResultButton
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        addCourse(course);
                      }}
                    >
                      {course.coverImage?.startsWith("/uploads/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- kleines Editor-Thumbnail
                        <img src={course.coverImage} alt="" />
                      ) : null}
                      <span>
                        {course.title}
                        {course.creatorName ? (
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.72rem",
                              opacity: 0.65,
                            }}
                          >
                            {course.own
                              ? t("ownCourse")
                              : course.creatorName}
                          </span>
                        ) : null}
                      </span>
                    </ResultButton>
                  </li>
                ))}
              </ResultList>
            ) : null}
          </SearchWrap>
        ) : null}
        {courses.length === 0 ? (
          <HintText>{t("courseGridHint")}</HintText>
        ) : null}
      </BlockCard>
    </NodeViewWrapper>
  );
}

export const CourseGridNode = Node.create<EmailBlockOptions>({
  name: "courseGrid",
  group: "block",
  atom: true,

  addOptions() {
    return { searchCourses: async () => [] };
  },

  addAttributes() {
    return {
      columns: {
        default: 3,
        parseHTML: (el) => Number(el.getAttribute("data-columns")) || 3,
      },
      courses: {
        default: [],
        parseHTML: (el) => {
          try {
            const parsed: unknown = JSON.parse(
              el.getAttribute("data-courses") ?? "[]"
            );
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="course-grid"]' }];
  },

  renderHTML({ node }) {
    return [
      "div",
      mergeAttributes({
        "data-type": "course-grid",
        "data-columns": String(node.attrs.columns),
        "data-courses": JSON.stringify(node.attrs.courses),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CourseGridView);
  },
});

/* ------------------------------------------------------------------ *
 * Bild-Grid (1–3 Bilder, Spalten = Bildanzahl)
 * ------------------------------------------------------------------ */

const ImageRow = styled.div`
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(3, 1fr);
`;

const ImageSlot = styled.div`
  position: relative;

  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 10px;
    display: block;
  }

  button {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(7, 8, 15, 0.75);
    color: #fff;
    font-size: 0.7rem;

    &:hover {
      background: ${({ theme }) => theme.colors.danger};
    }
  }
`;

const UploadButton = styled.button`
  margin-top: 0.6rem;
  padding: 0.45rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 0.82rem;
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

function ImageGridView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("rte");
  const images = (node.attrs.images ?? []) as string[];
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);

  async function onUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setError(false);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", "image");
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("upload_failed");
      const data = (await res.json()) as { url?: string };
      if (data.url) updateAttributes({ images: [...images, data.url] });
      else throw new Error("upload_failed");
    } catch {
      setError(true);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <NodeViewWrapper data-drag-handle>
      <BlockCard contentEditable={false}>
        <BlockHead>
          <span aria-hidden>🖼️</span>
          <strong>{t("imageGridTitle")}</strong>
          <RemoveBlockButton
            type="button"
            aria-label={t("removeBlock")}
            onClick={() => deleteNode()}
          >
            ✕
          </RemoveBlockButton>
        </BlockHead>

        {images.length > 0 ? (
          <ImageRow>
            {images.map((url, index) => (
              <ImageSlot key={`${url}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Editor-Vorschau eigener Uploads */}
                <img src={url} alt="" />
                <button
                  type="button"
                  aria-label={t("removeImage")}
                  onClick={() =>
                    updateAttributes({
                      images: images.filter((_, i) => i !== index),
                    })
                  }
                >
                  ✕
                </button>
              </ImageSlot>
            ))}
          </ImageRow>
        ) : null}

        {images.length < 3 ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              aria-hidden
              tabIndex={-1}
              onChange={() => void onUpload()}
            />
            <UploadButton
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? t("uploading") : `📤 ${t("uploadImage")}`}
            </UploadButton>
          </>
        ) : null}
        {error ? <HintText role="alert">{t("uploadFailed")}</HintText> : null}
      </BlockCard>
    </NodeViewWrapper>
  );
}

export const ImageGridNode = Node.create({
  name: "imageGrid",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: (el) => {
          try {
            const parsed: unknown = JSON.parse(
              el.getAttribute("data-images") ?? "[]"
            );
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-grid"]' }];
  },

  renderHTML({ node }) {
    return [
      "div",
      mergeAttributes({
        "data-type": "image-grid",
        "data-images": JSON.stringify(node.attrs.images),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGridView);
  },
});

/* ------------------------------------------------------------------ *
 * CTA-Button
 * ------------------------------------------------------------------ */

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  input {
    flex: 1;
    min-width: 140px;
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.pill};
    padding: 0.45rem 0.9rem;
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
  }
`;

const CtaPreview = styled.span`
  display: inline-block;
  margin-top: 0.6rem;
  padding: 0.55rem 1.4rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-size: 0.85rem;
  font-weight: 700;
`;

function CtaButtonView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("rte");
  const label = (node.attrs.label ?? "") as string;
  const url = (node.attrs.url ?? "") as string;

  return (
    <NodeViewWrapper data-drag-handle>
      <BlockCard contentEditable={false}>
        <BlockHead>
          <span aria-hidden>🔘</span>
          <strong>{t("ctaTitle")}</strong>
          <RemoveBlockButton
            type="button"
            aria-label={t("removeBlock")}
            onClick={() => deleteNode()}
          >
            ✕
          </RemoveBlockButton>
        </BlockHead>
        <CtaRow>
          <input
            value={label}
            placeholder={t("ctaLabelPlaceholder")}
            aria-label={t("ctaLabelPlaceholder")}
            maxLength={60}
            onChange={(event) =>
              updateAttributes({ label: event.target.value })
            }
          />
          <input
            value={url}
            type="url"
            placeholder="https://…"
            aria-label={t("ctaUrlPlaceholder")}
            onChange={(event) => updateAttributes({ url: event.target.value })}
          />
        </CtaRow>
        {label ? <CtaPreview aria-hidden>{label}</CtaPreview> : null}
      </BlockCard>
    </NodeViewWrapper>
  );
}

export const CtaButtonNode = Node.create({
  name: "ctaButton",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      label: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-label") ?? "",
      },
      url: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-url") ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="cta-button"]' }];
  },

  renderHTML({ node }) {
    return [
      "div",
      mergeAttributes({
        "data-type": "cta-button",
        "data-label": String(node.attrs.label ?? ""),
        "data-url": String(node.attrs.url ?? ""),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CtaButtonView);
  },
});

/* ------------------------------------------------------------------ *
 * Slash-Menü
 * ------------------------------------------------------------------ */

export interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  run: (editor: Editor) => void;
}

export function buildSlashItems(labels: {
  courseCards: string;
  courseCardsHint: string;
  image: string;
  imageHint: string;
  cta: string;
  ctaHint: string;
}): SlashItem[] {
  return [
    {
      id: "course-cards",
      label: labels.courseCards,
      hint: labels.courseCardsHint,
      icon: "🎓",
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "courseGrid",
            attrs: { columns: 3, courses: [] },
          })
          .run(),
    },
    {
      id: "image",
      label: labels.image,
      hint: labels.imageHint,
      icon: "🖼️",
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: "imageGrid", attrs: { images: [] } })
          .run(),
    },
    {
      id: "cta",
      label: labels.cta,
      hint: labels.ctaHint,
      icon: "🔘",
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "ctaButton",
            attrs: { label: "", url: "" },
          })
          .run(),
    },
  ];
}

/**
 * Slash-Menü als Suggestion-Plugin ("/" am Zeilenanfang oder nach
 * Leerzeichen): gleiche leichtgewichtige Dropdown-Technik wie die
 * @Mentions – fixed am Cursor, Pfeiltasten + Enter, ARIA-Listbox.
 */
export function createSlashExtension(getItems: () => SlashItem[]) {
  return Extension.create({
    name: "slashMenu",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          command: ({ editor, range, props }) => {
            const item = props as SlashItem;
            editor.chain().focus().deleteRange(range).run();
            item.run(editor as Editor);
          },
          items: ({ query }) =>
            getItems().filter((item) =>
              item.label.toLowerCase().includes(query.toLowerCase())
            ),
          render: () => {
            let list: HTMLDivElement | null = null;
            let items: SlashItem[] = [];
            let selected = 0;
            let command: ((item: SlashItem) => void) | null = null;

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
                option.innerHTML = `<span style="margin-right:8px;">${item.icon}</span><span><strong style="display:block;font-size:0.86rem;">${item.label}</strong><span style="display:block;font-size:0.74rem;opacity:0.7;">${item.hint}</span></span>`;
                option.style.cssText = `display:flex;align-items:center;width:100%;text-align:left;padding:8px 12px;border:0;border-radius:10px;cursor:pointer;background:${
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
              list.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
              list.style.top = `${rect.bottom + 6}px`;
            };

            type SuggestionRenderProps = {
              items: SlashItem[];
              command: (item: SlashItem) => void;
              clientRect?: (() => DOMRect | null) | null;
            };

            return {
              onStart(props: SuggestionRenderProps) {
                items = props.items;
                command = props.command;
                selected = 0;
                list = document.createElement("div");
                list.setAttribute("role", "listbox");
                list.style.cssText =
                  "position:fixed;z-index:80;min-width:260px;max-width:300px;padding:5px;border-radius:14px;background:#0d0f18;border:1px solid rgba(200,255,77,0.35);box-shadow:0 14px 44px rgba(0,0,0,0.6);";
                document.body.appendChild(list);
                draw();
                position(props.clientRect?.() ?? null);
              },
              onUpdate(props: SuggestionRenderProps) {
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
        }),
      ];
    },
  });
}
