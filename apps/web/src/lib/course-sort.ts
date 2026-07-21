import type { Prisma } from "@prisma/client";

/**
 * Sortierung des Kurskatalogs. Der gewählte Wert steht in der URL
 * (?sort=…), damit Ansichten teilbar und über den Zurück-Knopf
 * erreichbar bleiben.
 */
export const COURSE_SORTS = [
  "newest",
  "oldest",
  "popular",
  "price-asc",
  "price-desc",
  "title",
] as const;

export type CourseSort = (typeof COURSE_SORTS)[number];

/** Unbekannte Werte aus der URL fallen still auf die Standardsortierung. */
export function parseCourseSort(value: string | undefined): CourseSort {
  return COURSE_SORTS.includes(value as CourseSort)
    ? (value as CourseSort)
    : "newest";
}

/** Prisma-Sortierung zur gewählten Reihenfolge. */
export function courseOrderBy(
  sort: CourseSort
): Prisma.CourseOrderByWithRelationInput | Prisma.CourseOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" };
    case "popular":
      return { enrollments: { _count: "desc" } };
    case "title":
      return { title: "asc" };
    // Bei gleichem Preis (z. B. allen kostenlosen Kursen) entscheidet das
    // Datum – sonst wäre die Reihenfolge über Seitengrenzen hinweg zufällig
    case "price-asc":
      return [{ priceCents: "asc" }, { createdAt: "desc" }];
    case "price-desc":
      return [{ priceCents: "desc" }, { createdAt: "desc" }];
    default:
      return { createdAt: "desc" };
  }
}
