"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import { useThrottledValue } from "@/lib/useThrottledValue";
import { Badge, Card, Muted } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/Pagination";
import { AdminSearchInput } from "./AdminCoursesView";

const TableWrap = styled(Card)`
  padding: 0;
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  th,
  td {
    text-align: left;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  }

  th {
    padding: 0.35rem 0.5rem;
  }

  tbody tr:hover {
    background: ${({ theme }) => theme.colors.bgElevated};
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }
`;

/** Klickbarer Spaltenkopf mit Sortier-Indikator */
const SortButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme, $active }) => ($active ? "#FFB84D" : theme.colors.textFaint)};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.bgElevated};
  }

  &:focus-visible {
    outline: 2px solid #ffb84d;
    outline-offset: 1px;
  }
`;

export type UserSortKey =
  | "email"
  | "name"
  | "role"
  | "courses"
  | "enrollments"
  | "createdAt";
export type UserSortDir = "asc" | "desc";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "CLIENT" | "CREATOR" | "ADMIN";
  createdAt: string;
  totpEnabled: boolean;
  courses: number;
  enrollments: number;
}

const ROLE_TONE: Record<AdminUser["role"], "accent" | "violet" | undefined> = {
  ADMIN: "accent",
  CREATOR: "violet",
  CLIENT: undefined,
};

interface Filters {
  q: string;
  page: number;
  per: number;
  sort: UserSortKey;
  dir: UserSortDir;
}

export function AdminUsersView({
  filters,
  pagination,
  users,
}: {
  filters: Filters;
  pagination: { total: number; pages: number; pageSizes: number[] };
  users: AdminUser[];
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();

  const [search, setSearch] = useState(filters.q);
  const throttledSearch = useThrottledValue(search, 400);

  function apply(next: Partial<Filters>) {
    const merged = { ...filters, q: search, ...next };
    const query: Record<string, string> = {};
    if (merged.q) query.q = merged.q;
    if (merged.page > 1) query.page = String(merged.page);
    if (merged.per !== pagination.pageSizes[0]) query.per = String(merged.per);
    if (merged.sort !== "createdAt") query.sort = merged.sort;
    if (merged.dir !== "desc") query.dir = merged.dir;
    router.replace({ pathname: "/admin/users", query });
  }

  useEffect(() => {
    if (throttledSearch !== filters.q) {
      apply({ q: throttledSearch, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst nur auf die gedrosselte Eingabe reagieren
  }, [throttledSearch]);

  /** Gleiche Spalte klicken = Richtung drehen, neue Spalte = aufsteigend */
  function toggleSort(key: UserSortKey) {
    if (filters.sort === key) {
      apply({ dir: filters.dir === "asc" ? "desc" : "asc", page: 1 });
    } else {
      apply({ sort: key, dir: "asc", page: 1 });
    }
  }

  const columns: { key: UserSortKey; label: string }[] = [
    { key: "email", label: t("userEmail") },
    { key: "name", label: t("userName") },
    { key: "role", label: t("userRole") },
    { key: "courses", label: t("userCourses") },
    { key: "enrollments", label: t("userEnrollments") },
    { key: "createdAt", label: t("userSince") },
  ];

  function ariaSort(key: UserSortKey): "ascending" | "descending" | undefined {
    if (filters.sort !== key) return undefined;
    return filters.dir === "asc" ? "ascending" : "descending";
  }

  return (
    <>
      <AdminSearchInput
        type="search"
        value={search}
        placeholder={t("searchUsers")}
        aria-label={t("searchUsers")}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Muted
        role="status"
        aria-live="polite"
        style={{ marginBottom: "0.8rem", fontSize: "0.85rem" }}
      >
        {t("usersCount", { count: pagination.total })}
      </Muted>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              {columns.slice(0, 3).map((column) => (
                <th key={column.key} aria-sort={ariaSort(column.key)}>
                  <SortButton
                    type="button"
                    $active={filters.sort === column.key}
                    onClick={() => toggleSort(column.key)}
                  >
                    {column.label}
                    {filters.sort === column.key
                      ? filters.dir === "asc"
                        ? " ▲"
                        : " ▼"
                      : ""}
                  </SortButton>
                </th>
              ))}
              <th>2FA</th>
              {columns.slice(3).map((column) => (
                <th key={column.key} aria-sort={ariaSort(column.key)}>
                  <SortButton
                    type="button"
                    $active={filters.sort === column.key}
                    onClick={() => toggleSort(column.key)}
                  >
                    {column.label}
                    {filters.sort === column.key
                      ? filters.dir === "asc"
                        ? " ▲"
                        : " ▼"
                      : ""}
                  </SortButton>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name}</td>
                <td>
                  <Badge $tone={ROLE_TONE[user.role]}>{user.role}</Badge>
                </td>
                <td>{user.totpEnabled ? "✓" : "–"}</td>
                <td>{user.courses}</td>
                <td>{user.enrollments}</td>
                <td>{new Date(user.createdAt).toLocaleDateString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>

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
