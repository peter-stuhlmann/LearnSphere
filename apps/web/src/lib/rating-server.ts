import { db } from "@/lib/db";

export interface RatingStats {
  average: number | null;
  count: number;
}

/**
 * Bewertungs-Schnitt und -Anzahl je Kurs als EIN Aggregat statt alle
 * Review-Zeilen zu laden und in JS zu mitteln (N Zeilen → 1 Gruppenzeile).
 */
export async function loadRatingStats(
  courseIds: string[]
): Promise<Map<string, RatingStats>> {
  if (courseIds.length === 0) return new Map();
  const groups = await db.review.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courseIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((g) => [
      g.courseId,
      {
        average:
          g._avg.rating !== null ? Math.round(g._avg.rating * 10) / 10 : null,
        count: g._count._all,
      },
    ])
  );
}

export const NO_RATING: RatingStats = { average: null, count: 0 };

/**
 * Ø-Bewertung über ALLE Kurse eines Creators – ein einzelnes Aggregat
 * über die Review-Zeilen (jede Bewertung zählt gleich, kein Kurs-Mittel
 * von Mitteln).
 */
export async function loadCreatorRating(
  creatorId: string
): Promise<RatingStats> {
  const agg = await db.review.aggregate({
    where: { course: { creatorId } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return {
    average:
      agg._avg.rating !== null ? Math.round(agg._avg.rating * 10) / 10 : null,
    count: agg._count._all,
  };
}
