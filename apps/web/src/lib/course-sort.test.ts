import { describe, expect, it } from "vitest";
import { COURSE_SORTS, courseOrderBy, parseCourseSort } from "./course-sort";

describe("parseCourseSort", () => {
  it("erkennt alle angebotenen Sortierungen", () => {
    for (const sort of COURSE_SORTS) {
      expect(parseCourseSort(sort)).toBe(sort);
    }
  });

  it("fällt bei unbekannten oder fehlenden Werten auf 'newest' zurück", () => {
    expect(parseCourseSort("gibt-es-nicht")).toBe("newest");
    expect(parseCourseSort(undefined)).toBe("newest");
    expect(parseCourseSort("")).toBe("newest");
  });
});

describe("courseOrderBy", () => {
  it("sortiert neueste zuerst", () => {
    expect(courseOrderBy("newest")).toEqual({ createdAt: "desc" });
  });

  it("sortiert älteste zuerst", () => {
    expect(courseOrderBy("oldest")).toEqual({ createdAt: "asc" });
  });

  it("sortiert nach Teilnehmerzahl", () => {
    expect(courseOrderBy("popular")).toEqual({
      enrollments: { _count: "desc" },
    });
  });

  it("sortiert nach Titel", () => {
    expect(courseOrderBy("title")).toEqual({ title: "asc" });
  });

  /* Bei gleichem Preis (etwa allen kostenlosen Kursen) entscheidet das
     Datum – sonst wäre die Reihenfolge zwischen Seiten nicht stabil. */
  it("ergänzt bei Preissortierung das Datum als zweites Kriterium", () => {
    expect(courseOrderBy("price-asc")).toEqual([
      { priceCents: "asc" },
      { createdAt: "desc" },
    ]);
    expect(courseOrderBy("price-desc")).toEqual([
      { priceCents: "desc" },
      { createdAt: "desc" },
    ]);
  });
});
