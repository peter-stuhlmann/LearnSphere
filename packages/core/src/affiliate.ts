/**
 * Affiliate-Programm: 15 % Provision auf vermittelte Verkäufe.
 * Attribution per httpOnly-Cookie (?aff=CODE, letzter Klick gewinnt,
 * 7 Tage gültig) oder über die Affiliate-API (?affiliate=true).
 */

export const AFFILIATE_COOKIE = "ls_aff";
export const AFFILIATE_WINDOW_DAYS = 7;

/** Codes entstehen aus randomBytes(8).toString("hex") → 16 Hex-Zeichen. */
export function isValidAffiliateCode(code: string): boolean {
  return /^[a-z0-9]{8,32}$/.test(code);
}

export interface CommissionContext {
  affiliateUserId: string | null;
  buyerUserId: string;
  creatorUserId: string;
  priceCents: number;
}

/**
 * Sicherheitsregeln der Provision: kein Selbstkauf, kein Creator, der
 * seinen eigenen Kurs "vermittelt", keine kostenlosen Kurse.
 */
export function canEarnCommission(ctx: CommissionContext): boolean {
  if (!ctx.affiliateUserId) return false;
  if (ctx.affiliateUserId === ctx.buyerUserId) return false;
  if (ctx.affiliateUserId === ctx.creatorUserId) return false;
  if (ctx.priceCents <= 0) return false;
  return true;
}
