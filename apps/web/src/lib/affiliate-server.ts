import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  AFFILIATE_COOKIE,
  canEarnCommission,
  isValidAffiliateCode,
} from "@elearning/core/affiliate";
import { affiliateShareCents } from "@elearning/core/revenue";
import { loadBalanceCents } from "@/lib/payout-server";

export interface AffiliateAttribution {
  affiliateUserId: string | null;
  affiliateShareCents: number;
}

/**
 * Liest die Affiliate-Attribution aus dem httpOnly-Cookie und wendet die
 * Sicherheitsregeln an (Programm-Mitglied, kein Selbstkauf, kein eigener
 * Kurs, kein Gratis-Kurs). Der Client kann die Provision nicht steuern –
 * alles wird serverseitig geprüft.
 */
export async function resolveAffiliateForPurchase(input: {
  buyerUserId: string;
  creatorUserId: string;
  priceCents: number;
}): Promise<AffiliateAttribution> {
  const none: AffiliateAttribution = {
    affiliateUserId: null,
    affiliateShareCents: 0,
  };

  const store = await cookies();
  const code = store.get(AFFILIATE_COOKIE)?.value ?? "";
  if (!isValidAffiliateCode(code)) return none;

  const affiliate = await db.user.findUnique({
    where: { affiliateCode: code },
    select: { id: true, affiliateJoinedAt: true },
  });
  if (!affiliate?.affiliateJoinedAt) return none;

  if (
    !canEarnCommission({
      affiliateUserId: affiliate.id,
      buyerUserId: input.buyerUserId,
      creatorUserId: input.creatorUserId,
      priceCents: input.priceCents,
    })
  ) {
    return none;
  }

  return {
    affiliateUserId: affiliate.id,
    affiliateShareCents: affiliateShareCents(input.priceCents),
  };
}

/** Einsetzbares Guthaben des Käufers (nie negativ). */
export async function availableCreditCents(userId: string): Promise<number> {
  return Math.max(0, await loadBalanceCents(userId));
}
