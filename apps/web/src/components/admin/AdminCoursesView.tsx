"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@elearning/core/format";
import { useThrottledValue } from "@/lib/useThrottledValue";
import { setCourseFlag } from "@/app/actions/admin-actions";
import { Pagination } from "@/components/ui/Pagination";
import {
  Badge,
  Card,
  DangerButton,
  GhostButton,
  Muted,
  PrimaryButton,
} from "@/components/ui/primitives";

export const AdminSearchInput = styled.input`
  width: 100%;
  max-width: 420px;
  margin-bottom: 0.9rem;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.6rem 1.1rem;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid #ffb84d;
    outline-offset: 0;
    border-color: transparent;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const Row = styled(Card)<{ $flagged: boolean }>`
  padding: 1rem 1.3rem;
  border-color: ${({ $flagged }) =>
    $flagged ? "rgba(255, 92, 92, 0.55)" : undefined};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;

  a {
    color: inherit;
    font-weight: 600;
    text-underline-offset: 3px;
  }
`;

const FlagForm = styled.div`
  margin-top: 0.7rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;

  input {
    flex: 1;
    min-width: 220px;
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.sm};
    padding: 0.45rem 0.75rem;
    font-size: 0.85rem;
  }
`;

const Actions = styled.div`
  margin-top: 0.6rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  flagged: boolean;
  flagReason: string;
  priceCents: number;
  currency: string;
  createdAt: string;
  creator: string;
  enrollments: number;
}

export function AdminCoursesView({
  filters,
  pagination,
  courses,
}: {
  filters: { q: string; page: number; per: number };
  pagination: { total: number; pages: number; pageSizes: number[] };
  courses: AdminCourse[];
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  /** Kurs-ID, für die gerade der Sperr-Grund eingegeben wird */
  const [flagging, setFlagging] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // Live-Filter: Suche/Seite leben in der URL (teilbar, Back-Button-tauglich)
  const [search, setSearch] = useState(filters.q);
  const throttledSearch = useThrottledValue(search, 400);

  function apply(next: Partial<typeof filters>) {
    const merged = { ...filters, q: search, ...next };
    const query: Record<string, string> = {};
    if (merged.q) query.q = merged.q;
    if (merged.page > 1) query.page = String(merged.page);
    if (merged.per !== pagination.pageSizes[0]) query.per = String(merged.per);
    router.replace({ pathname: "/admin/courses", query });
  }

  useEffect(() => {
    if (throttledSearch !== filters.q) {
      apply({ q: throttledSearch, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst nur auf die gedrosselte Eingabe reagieren
  }, [throttledSearch]);

  function submitFlag(courseId: string, flagged: boolean) {
    startTransition(async () => {
      await setCourseFlag({ courseId, flagged, reason });
      setFlagging(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <AdminSearchInput
        type="search"
        value={search}
        placeholder={t("searchCourses")}
        aria-label={t("searchCourses")}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Muted
        role="status"
        aria-live="polite"
        style={{ fontSize: "0.85rem", marginBottom: "0.8rem" }}
      >
        {t("resultCourses", { count: pagination.total })}
      </Muted>

    <List>
      {courses.map((course) => (
        <Row key={course.id} $flagged={course.flagged}>
          <TitleRow>
            <Link
              href={{
                pathname: "/courses/[slug]",
                params: { slug: course.slug },
              }}
            >
              {course.title}
            </Link>
            {course.flagged ? (
              <Badge $tone="accent">🚫 {t("flagged")}</Badge>
            ) : null}
            <Badge $tone={course.published ? "violet" : undefined}>
              {course.published ? t("published") : t("draft")}
            </Badge>
          </TitleRow>
          <Muted style={{ fontSize: "0.82rem", marginTop: "0.3rem" }}>
            {course.creator} · {t("enrollments", { count: course.enrollments })}{" "}
            · {formatPrice(course.priceCents, course.currency, locale)} ·{" "}
            {new Date(course.createdAt).toLocaleDateString(locale)}
          </Muted>
          {course.flagged && course.flagReason ? (
            <Muted style={{ fontSize: "0.85rem", marginTop: "0.3rem", color: "#FF7A7A" }}>
              {t("flagReason")}: {course.flagReason}
            </Muted>
          ) : null}

          {flagging === course.id ? (
            <FlagForm>
              <input
                autoFocus
                value={reason}
                maxLength={500}
                placeholder={t("flagReasonPlaceholder")}
                aria-label={t("flagReason")}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitFlag(course.id, true);
                  if (e.key === "Escape") setFlagging(null);
                }}
              />
              <DangerButton
                type="button"
                onClick={() => submitFlag(course.id, true)}
              >
                {t("flagConfirm")}
              </DangerButton>
              <GhostButton type="button" onClick={() => setFlagging(null)}>
                {t("cancel")}
              </GhostButton>
            </FlagForm>
          ) : (
            <Actions>
              {course.flagged ? (
                <PrimaryButton
                  type="button"
                  onClick={() => submitFlag(course.id, false)}
                >
                  ✓ {t("unflag")}
                </PrimaryButton>
              ) : (
                <GhostButton
                  type="button"
                  onClick={() => {
                    setFlagging(course.id);
                    setReason("");
                  }}
                >
                  🚩 {t("flag")}
                </GhostButton>
              )}
            </Actions>
          )}
        </Row>
      ))}
    </List>

      <Pagination
        page={filters.page}
        pages={pagination.pages}
        per={filters.per}
        pageSizes={pagination.pageSizes}
        onChange={(next) => apply(next)}
      />
    </>
  );
}
