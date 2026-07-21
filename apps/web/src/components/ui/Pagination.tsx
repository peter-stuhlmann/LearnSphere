"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { GhostButton, Muted } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";

const Bar = styled.nav`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2rem;
`;

const ArrowButton = styled(GhostButton)`
  /* rund statt oval: feste, gleiche Kantenlänge ohne Innenabstand */
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 50%;
  flex-shrink: 0;
`;

export interface PaginationProps {
  page: number;
  pages: number;
  per: number;
  pageSizes: number[];
  onChange: (next: { page?: number; per?: number }) => void;
}

/** Einheitliche Pagination: runde Pfeile, Seitenanzeige, Seitengröße. */
export function Pagination({
  page,
  pages,
  per,
  pageSizes,
  onChange,
}: PaginationProps) {
  const t = useTranslations("common");

  return (
    <Bar aria-label={t("pageInfo", { page, pages })}>
      <ArrowButton
        disabled={page <= 1}
        aria-label={t("prevPage")}
        onClick={() => onChange({ page: page - 1 })}
      >
        ←
      </ArrowButton>
      <Muted style={{ fontSize: "0.88rem" }}>
        {t("pageInfo", { page, pages })}
      </Muted>
      <ArrowButton
        disabled={page >= pages}
        aria-label={t("nextPage")}
        onClick={() => onChange({ page: page + 1 })}
      >
        →
      </ArrowButton>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Select
          inline
          pill
          value={String(per)}
          ariaLabel={t("perPageLabel")}
          options={pageSizes.map((size) => ({
            value: String(size),
            label: String(size),
          }))}
          onChange={(v) => onChange({ per: Number(v), page: 1 })}
        />
        <Muted style={{ fontSize: "0.85rem" }}>{t("perPage")}</Muted>
      </div>
    </Bar>
  );
}
