"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import { useThrottledValue } from "@/lib/useThrottledValue";
import { COURSE_CATEGORIES } from "@elearning/core/categories";
import { Container, Kicker, Muted, SectionTitle } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { COURSE_SORTS, type CourseSort } from "@/lib/course-sort";
import {
  CourseCard,
  CourseGrid,
  type CourseCardCourse,
} from "./CourseCard";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const FilterBar = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
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

/* Kostenlos-Umschalter: gleiche Pillenform wie die Kategorie-Chips,
   aber mit Häkchen und kräftigerem Akzent im aktiven Zustand */
const FreeToggle = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  white-space: nowrap;
  padding: 0.6rem 1.1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.85rem;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.accent : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : theme.colors.bgElevated};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};
  transition:
    border-color 140ms ease,
    color 140ms ease,
    background 140ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  /* Markierung nur als Zustandsanzeige – der Text trägt die Information */
  span[aria-hidden] {
    display: inline-flex;
    width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    font-size: 0.7rem;
    border: 1px solid
      ${({ theme, $active }) =>
        $active ? theme.colors.accent : theme.colors.borderStrong};
    background: ${({ theme, $active }) =>
      $active ? theme.colors.accent : "transparent"};
    color: ${({ theme }) => theme.colors.onAccent};
  }
`;

const CategoryChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.9rem;
`;

const CategoryChip = styled.button<{ $active: boolean }>`
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.8rem;
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

interface CatalogCourse extends CourseCardCourse {
  creatorName: string;
  lessonCount: number;
  category: string | null;
  tags: string[];
}

interface CatalogViewProps {
  filters: {
    q: string;
    page: number;
    per: number;
    categories: string[];
    /** nur kostenlose Kurse zeigen */
    freeOnly: boolean;
    sort: CourseSort;
  };
  /** Kategorien mit mindestens einem sichtbaren Kurs – nur die werden angeboten */
  availableCategories: string[];
  pagination: { total: number; pages: number; pageSizes: number[] };
  courses: CatalogCourse[];
}

export function CatalogView({
  filters,
  availableCategories,
  pagination,
  courses,
}: CatalogViewProps) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const throttledSearch = useThrottledValue(search, 400);

  /** Filter/Pagination leben in der URL – teilbar und Back-Button-tauglich. */
  function apply(next: Partial<typeof filters>) {
    const merged = { ...filters, q: search, ...next };
    const query: Record<string, string> = {};
    if (merged.q) query.q = merged.q;
    if (merged.categories.length > 0) query.cat = merged.categories.join(",");
    if (merged.freeOnly) query.free = "1";
    if (merged.sort !== "newest") query.sort = merged.sort;
    if (merged.page > 1) query.page = String(merged.page);
    if (merged.per !== 12) query.per = String(merged.per);
    router.replace({ pathname: "/courses", query });
  }

  function toggleCategory(id: string) {
    const categories = filters.categories.includes(id)
      ? filters.categories.filter((c) => c !== id)
      : [...filters.categories, id];
    apply({ categories, page: 1 });
  }

  // Nur Kategorien mit Kursen zeigen – aktive Filter bleiben abwählbar
  const shownCategories = COURSE_CATEGORIES.filter(
    (category) =>
      availableCategories.includes(category.id) ||
      filters.categories.includes(category.id)
  );

  // Live-Suche: gedrosselt beim Tippen anwenden, kein Such-Button nötig
  useEffect(() => {
    if (throttledSearch !== filters.q) {
      apply({ q: throttledSearch, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst nur auf die gedrosselte Eingabe reagieren
  }, [throttledSearch]);

  const hasFilter =
    filters.q.length > 0 || filters.freeOnly || filters.categories.length > 0;

  const sortLabels: Record<CourseSort, string> = {
    newest: t("sortNewest"),
    oldest: t("sortOldest"),
    popular: t("sortPopular"),
    "price-asc": t("sortPriceAsc"),
    "price-desc": t("sortPriceDesc"),
    title: t("sortTitle"),
  };

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("subtitle")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        <FilterBar
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ page: 1 });
          }}
        >
          <SearchInput
            type="search"
            value={search}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FreeToggle
            type="button"
            $active={filters.freeOnly}
            aria-pressed={filters.freeOnly}
            onClick={() => apply({ freeOnly: !filters.freeOnly, page: 1 })}
          >
            <span aria-hidden>{filters.freeOnly ? "✓" : ""}</span>
            {t("freeOnly")}
          </FreeToggle>
          <Select
            inline
            pill
            value={filters.sort}
            ariaLabel={t("sortLabel")}
            options={COURSE_SORTS.map((sort) => ({
              value: sort,
              label: sortLabels[sort],
            }))}
            onChange={(sort) =>
              apply({ sort: sort as CourseSort, page: 1 })
            }
          />
        </FilterBar>

        {shownCategories.length > 0 ? (
          <CategoryChips role="group" aria-label={t("categoriesLabel")}>
            {shownCategories.map((category) => (
              <CategoryChip
                key={category.id}
                type="button"
                $active={filters.categories.includes(category.id)}
                aria-pressed={filters.categories.includes(category.id)}
                onClick={() => toggleCategory(category.id)}
              >
                {locale === "en" ? category.en : category.de}
              </CategoryChip>
            ))}
          </CategoryChips>
        ) : null}

        <Muted
          role="status"
          aria-live="polite"
          style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}
        >
          {t("resultCount", { count: pagination.total })}
        </Muted>

        {courses.length === 0 ? (
          <Muted style={{ marginTop: "2rem" }}>
            {hasFilter ? t("noResults") : t("empty")}
          </Muted>
        ) : (
          <CourseGrid>
            {courses.map((course, i) => (
              <CourseCard key={course.slug} course={course} index={i} />
            ))}
          </CourseGrid>
        )}

        <Pagination
          page={filters.page}
          pages={pagination.pages}
          per={filters.per}
          pageSizes={pagination.pageSizes}
          onChange={(next) => apply(next)}
        />
      </Container>
    </Wrap>
  );
}
