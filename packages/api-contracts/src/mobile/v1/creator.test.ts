import { describe, expect, it } from "vitest";
import { creatorDashboardSchema } from "./creator";

describe("creator dashboard contract", () => {
  it("validiert das Dashboard", () => {
    expect(
      creatorDashboardSchema.safeParse({
        totals: {
          sales: 12,
          revenueCents: 45000,
          learners: 10,
          completion: 42,
          avgRating: 4.6,
          reviewCount: 7,
        },
        payout: {
          balanceCents: 30000,
          pendingCents: 15000,
          hasOpenRequest: false,
          history: [
            {
              id: "p1",
              amountCents: 10000,
              status: "PAID",
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
        courses: [
          {
            id: "c1",
            title: "Kurs",
            published: true,
            priceCents: 4999,
            enrollmentCount: 12,
            revenueCents: 45000,
          },
        ],
      }).success
    ).toBe(true);
  });

  it("lehnt unbekannte Payout-Status ab", () => {
    expect(
      creatorDashboardSchema.safeParse({
        totals: {
          sales: 0,
          revenueCents: 0,
          learners: 0,
          completion: 0,
          avgRating: null,
          reviewCount: 0,
        },
        payout: {
          balanceCents: 0,
          pendingCents: 0,
          hasOpenRequest: false,
          history: [
            {
              id: "p1",
              amountCents: 1,
              status: "OFFEN",
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
        courses: [],
      }).success
    ).toBe(false);
  });
});
