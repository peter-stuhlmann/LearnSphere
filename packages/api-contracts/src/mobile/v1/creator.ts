import { z } from "zod";

/* Creator-Dashboard der App (read-only): KPIs, Guthaben, Kursliste. */

export const creatorTotalsSchema = z.object({
  sales: z.number(),
  revenueCents: z.number(),
  learners: z.number(),
  /** Abschlussquote in Prozent (0–100) */
  completion: z.number(),
  avgRating: z.number().nullable(),
  reviewCount: z.number(),
});

export const creatorDashboardSchema = z.object({
  totals: creatorTotalsSchema,
  payout: z.object({
    balanceCents: z.number(),
    pendingCents: z.number(),
    hasOpenRequest: z.boolean(),
    history: z.array(
      z.object({
        id: z.string(),
        amountCents: z.number(),
        status: z.enum(["REQUESTED", "PAID"]),
        createdAt: z.string(),
      })
    ),
  }),
  courses: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      published: z.boolean(),
      priceCents: z.number(),
      enrollmentCount: z.number(),
      revenueCents: z.number(),
    })
  ),
});
export type CreatorDashboard = z.infer<typeof creatorDashboardSchema>;
