"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { formatPrice } from "@elearning/core/format";
import { SEARCH_MIN_CHARS } from "@/lib/course-search";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";

/**
 * Live-Suche im Header: Lupe öffnet ein Eingabefeld, ab 3 Zeichen wird
 * gedrosselt gesucht (Titel, Untertitel, Tags, Beschreibung). Ergebnisse
 * als ARIA-Combobox (Pfeiltasten + Enter), Enter ohne Auswahl führt zur
 * Katalog-Suche mit dem Begriff.
 */

const IconButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.text : theme.colors.textMuted};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.accent : theme.colors.border};

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const drop = keyframes`
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

/* Panel unterhalb des Headers: mobile volle Breite, ab sm rechts verankert */
const Panel = styled.div`
  position: fixed;
  z-index: 60;
  top: 64px;
  left: 12px;
  right: 12px;
  padding: 0.75rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};
  animation: ${drop} 180ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    position: absolute;
    top: calc(100% + 10px);
    left: auto;
    right: 0;
    width: 420px;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.6rem 1.1rem;

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
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  max-height: min(52vh, 420px);
  overflow-y: auto;
`;

const ResultItem = styled.li<{ $active: boolean }>`
  border-radius: ${({ theme }) => theme.radii.md};

  ${({ $active, theme }) =>
    $active &&
    css`
      background: ${theme.colors.surfaceHover};
      outline: 2px solid ${theme.colors.accent};
      outline-offset: -2px;
    `}
`;

const ResultButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.5rem;
  border-radius: ${({ theme }) => theme.radii.md};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const Thumb = styled.span`
  position: relative;
  flex-shrink: 0;
  width: 72px;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};

  img {
    object-fit: cover;
  }
`;

const ResultText = styled.span`
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  small {
    display: block;
    font-size: 0.76rem;
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const ResultPrice = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.accent};
  flex-shrink: 0;
`;

const StatusRow = styled.p`
  margin: 0.6rem 0.25rem 0.15rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const AllResults = styled.button`
  display: block;
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.55rem;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.accent};

  &:hover {
    background: ${({ theme }) => theme.colors.accentSoft};
  }
`;

interface SearchResult {
  slug: string;
  title: string;
  subtitle: string | null;
  coverImage: string | null;
  priceCents: number;
  currency: string;
  creatorName: string;
}

export function HeaderSearch() {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
    setActiveIndex(-1);
  }, []);

  // Klick außerhalb / Escape schließt das Panel
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  /** Tippen: unterhalb der Mindestlänge Ergebnisse sofort leeren */
  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < SEARCH_MIN_CHARS) {
      setResults([]);
      setSearched(false);
      setActiveIndex(-1);
    }
  }

  // Live-Suche: gedrosselt ab SEARCH_MIN_CHARS Zeichen
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_CHARS) return;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/search/courses?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);
        setSearched(true);
        setActiveIndex(-1);
      } catch {
        // abgebrochen oder Netzfehler – alte Ergebnisse stehen lassen
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  function goTo(slug: string) {
    close();
    router.push({ pathname: "/courses/[slug]", params: { slug } });
  }

  function goToCatalog() {
    const q = query.trim();
    close();
    router.push({ pathname: "/courses", query: q ? { q } : undefined });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) =>
        results.length ? (i - 1 + results.length) % results.length : -1
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        goTo(results[activeIndex].slug);
      } else if (query.trim().length >= SEARCH_MIN_CHARS) {
        goToCatalog();
      }
    }
  }

  const listboxId = "header-search-results";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <IconButton
        type="button"
        $active={open}
        aria-label={t("open")}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
            // Fokus nach dem Rendern des Panels
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
      </IconButton>

      {open ? (
        <Panel>
          <SearchInput
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
            }
            aria-label={t("label")}
            placeholder={t("placeholder")}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
          />

          {query.trim().length > 0 &&
          query.trim().length < SEARCH_MIN_CHARS ? (
            <StatusRow>{t("minChars", { count: SEARCH_MIN_CHARS })}</StatusRow>
          ) : null}

          {results.length > 0 ? (
            <>
              <ResultList id={listboxId} role="listbox" aria-label={t("label")}>
                {results.map((result, index) => (
                  <ResultItem
                    key={result.slug}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    $active={index === activeIndex}
                  >
                    <ResultButton
                      type="button"
                      tabIndex={-1}
                      onClick={() => goTo(result.slug)}
                    >
                      <Thumb aria-hidden>
                        {result.coverImage ? (
                          <Image
                            src={result.coverImage}
                            alt=""
                            fill
                            sizes="72px"
                          />
                        ) : (
                          <CoverPlaceholder />
                        )}
                      </Thumb>
                      <ResultText>
                        <strong>{result.title}</strong>
                        <small>{result.creatorName}</small>
                      </ResultText>
                      <ResultPrice>
                        {result.priceCents === 0
                          ? t("free")
                          : formatPrice(
                              result.priceCents,
                              result.currency,
                              locale
                            )}
                      </ResultPrice>
                    </ResultButton>
                  </ResultItem>
                ))}
              </ResultList>
              <AllResults type="button" onClick={goToCatalog}>
                {t("allResults")} →
              </AllResults>
            </>
          ) : searched ? (
            <StatusRow role="status">{t("noResults")}</StatusRow>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
