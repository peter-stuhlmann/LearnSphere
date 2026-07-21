"use client";

import Image from "next/image";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { createCourse } from "@/app/actions/course-actions";
import { formatPrice } from "@elearning/core/format";
import { useThrottledValue } from "@/lib/useThrottledValue";
import {
  Badge,
  Container,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/AuthShell";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

/* Neuen Kurs direkt hier anlegen – Titel eingeben, los geht's im Editor */
const NewCourseForm = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  margin-top: 2rem;
  padding: 1.25rem;
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.lg};

  > div {
    flex: 1;
    min-width: 220px;
  }
`;

const FilterBar = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2rem;
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

const CourseGrid = styled.div`
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const CourseCard = styled(motion.button)`
  text-align: left;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  overflow: hidden;
  transition: border-color 180ms ease, transform 180ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-3px);
  }

  h2 {
    font-size: 1.25rem;
  }
`;

const CardCover = styled.div`
  /* volle Kartenbreite trotz Karten-Padding (1.5rem) */
  margin: -1.5rem -1.5rem 0;
  /* fester 16:9-Rahmen – Bezugsrahmen für next/image mit fill */
  position: relative;
  aspect-ratio: 16 / 9;
  background: ${({ theme }) => theme.colors.bgElevated};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;

  img {
    object-fit: cover;
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: auto;
`;

const Price = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;
`;


interface MyCourse {
  id: string;
  title: string;
  published: boolean;
  priceCents: number;
  currency: string;
  coverImage: string | null;
  enrollments: number;
}

interface MyCoursesViewProps {
  filters: { q: string; status: string; page: number; per: number };
  pagination: { total: number; pages: number; pageSizes: number[] };
  courses: MyCourse[];
}

export function MyCoursesView({
  filters,
  pagination,
  courses,
}: MyCoursesViewProps) {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const throttledSearch = useThrottledValue(search, 400);
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    startCreate(async () => {
      const result = await createCourse({ title: newTitle });
      if (!result.ok || !result.courseId) {
        setCreateError(result.error ?? "generic");
        return;
      }
      router.push({
        pathname: "/creator/courses/[id]",
        params: { id: result.courseId },
      });
    });
  }

  /** Filter/Pagination leben in der URL – teilbar und Back-Button-tauglich. */
  function apply(next: Partial<typeof filters>) {
    const merged = { ...filters, q: search, ...next };
    const query: Record<string, string> = {};
    if (merged.q) query.q = merged.q;
    if (merged.status !== "all") query.status = merged.status;
    if (merged.page > 1) query.page = String(merged.page);
    if (merged.per !== 12) query.per = String(merged.per);
    router.replace({ pathname: "/creator/courses", query });
  }

  // Live-Suche: gedrosselt beim Tippen anwenden, kein Such-Button nötig
  useEffect(() => {
    if (throttledSearch !== filters.q) {
      apply({ q: throttledSearch, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst nur auf die gedrosselte Eingabe reagieren
  }, [throttledSearch]);

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("title")}</Kicker>
        <SectionTitle as="h1">{tNav("myCourses")}</SectionTitle>

        <NewCourseForm onSubmit={onCreate}>
          <Field
            label={t("courseTitle")}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
            minLength={3}
          />
          <PrimaryButton type="submit" disabled={creating}>
            + {t("newCourse")}
          </PrimaryButton>
          {createError ? (
            <FormAlert $tone="error" role="alert" style={{ width: "100%" }}>
              {createError}
            </FormAlert>
          ) : null}
        </NewCourseForm>

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
          <Select
            inline
            pill
            value={filters.status}
            ariaLabel={t("statusFilterLabel")}
            options={[
              { value: "all", label: t("statusAll") },
              { value: "published", label: t("statusPublished") },
              { value: "draft", label: t("statusDraft") },
            ]}
            onChange={(status) => apply({ status, page: 1 })}
          />
        </FilterBar>

        <Muted
          role="status"
          aria-live="polite"
          style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}
        >
          {t("resultCount", { count: pagination.total })}
        </Muted>

        {courses.length === 0 ? (
          <Muted style={{ marginTop: "2rem" }}>{t("noResults")}</Muted>
        ) : (
          <CourseGrid>
            {courses.map((course, i) => (
              <CourseCard
                key={course.id}
                onClick={() =>
                  router.push({
                    pathname: "/creator/courses/[id]",
                    params: { id: course.id },
                  })
                }
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
              >
                <CardCover>
                  {course.coverImage ? (
                    <Image
                      src={course.coverImage}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                  ) : (
                    <CoverPlaceholder />
                  )}
                </CardCover>
                <h2>{course.title}</h2>
                <MetaRow>
                  <Badge $tone={course.published ? "success" : "muted"}>
                    {course.published ? t("published") : t("draft")}
                  </Badge>
                  <Badge $tone="violet">
                    {t("enrollments", { count: course.enrollments })}
                  </Badge>
                  <Price>
                    {formatPrice(course.priceCents, course.currency, locale)}
                  </Price>
                </MetaRow>
              </CourseCard>
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
