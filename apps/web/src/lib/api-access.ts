/**
 * Wer darf die API nutzen?
 *
 * Der API-Zugang ist ein kostenpflichtiges Feature (25 €/Monat). Zwei
 * Ausnahmen gibt es:
 *
 * - ADMIN (die Superadmins der Plattform): Sie betreiben LearnSphere. Sie
 *   an die eigene Kasse zu bitten, wäre ein Ringtausch mit Buchungsaufwand,
 *   und im Fehlerfall müsste ausgerechnet der Betreiber erst ein Abo
 *   abschließen, um die API prüfen zu können.
 * - Affiliates dürfen einen Key anlegen, aber nur für die Affiliate-API –
 *   die prüft die Mitgliedschaft selbst. Für die Creator-API reicht das
 *   nicht (deshalb steht es nur in der Key-Erstellung, nicht hier).
 *
 * Bewusst eine Regel im Code und kein vorgetäuschtes Abo in der Datenbank:
 * Ein künstlicher ACTIVE-Datensatz für den Betreiber sähe in jeder
 * Umsatzauswertung wie ein zahlender Kunde aus.
 */

export type ApiSubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED";

/** Ein API-Plan gilt bei aktivem Abo; PAST_DUE = Kulanzfenster. */
export function isApiPlanUsable(
  status: ApiSubscriptionStatus | undefined | null
): boolean {
  return status === "ACTIVE" || status === "PAST_DUE";
}

/** Zugang zur bezahlten API: über ein Abo oder als Betreiber der Plattform. */
export function hasApiAccess(input: {
  role: string | undefined | null;
  status: ApiSubscriptionStatus | undefined | null;
}): boolean {
  return input.role === "ADMIN" || isApiPlanUsable(input.status);
}
