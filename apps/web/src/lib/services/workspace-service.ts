import { db } from "@/lib/db";
import {
  appHostname,
  lookupWorkspaceByHost,
  tenantBaseDomain,
  tenantUrlParts,
  type WorkspaceHost,
} from "@/lib/tenant";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { parseTags } from "@elearning/core/tags";
import {
  workspaceLegalSchema,
  type WorkspaceLegalData,
} from "@elearning/core/validation";
import { loadRatingStats } from "@/lib/rating-server";
import type { CourseCardCourse } from "@/components/catalog/CourseCard";

export type { WorkspaceLegalData };

/** Rohe Rechtsangaben (JSON) sicher in ein vollständiges Objekt parsen. */
export function parseWorkspaceLegal(
  value: unknown
): WorkspaceLegalData | null {
  if (!value || typeof value !== "object") return null;
  const parsed = workspaceLegalSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** DNS-Label, unter dem der Owner den Verifikations-Token als TXT hinterlegt. */
export const DOMAIN_VERIFY_HOST_PREFIX = "_learnsphere-verify";

export interface WorkspaceData {
  slug: string;
  brandName: string;
  brandColor: string;
  colorBackground: string;
  colorText: string;
  colorSecondary: string;
  emailFromName: string;
  addressForm: "INFORMAL" | "FORMAL";
  customDomain: string | null;
  domainVerified: boolean;
  /** DNS-Records, die der Owner bei seiner Domain setzen muss (nur wenn Domain gesetzt). */
  dns: { txtHost: string; txtValue: string; cnameTarget: string } | null;
  status: "ACTIVE" | "SUSPENDED";
  /** Rechtsangaben des Betreibers (Impressum/Verantwortlicher) – null = noch nicht hinterlegt. */
  legal: WorkspaceLegalData | null;
}

export interface WorkspacePageData {
  workspace: WorkspaceData | null;
  baseDomain: string;
  appHost: string;
  /** Protokoll (z. B. "https:") für Portal-Links – lokal "http:". */
  portalProtocol: string;
  /** Port für Portal-Links – lokal "3000", in Produktion leer. */
  portalPort: string;
}

/** Workspace des Owners + Basis-/App-Domain fürs Business-Dashboard laden. */
export async function loadWorkspacePageData(
  ownerId: string
): Promise<WorkspacePageData> {
  const ws = await db.businessWorkspace.findUnique({ where: { ownerId } });
  const baseDomain = tenantBaseDomain();
  const appHost = appHostname();
  const { protocol: portalProtocol, port: portalPort } = tenantUrlParts();
  if (!ws)
    return { workspace: null, baseDomain, appHost, portalProtocol, portalPort };

  return {
    workspace: {
      slug: ws.slug,
      brandName: ws.brandName,
      brandColor: ws.brandColor ?? "",
      colorBackground: ws.colorBackground ?? "",
      colorText: ws.colorText ?? "",
      colorSecondary: ws.colorSecondary ?? "",
      emailFromName: ws.emailFromName ?? "",
      addressForm: ws.addressForm,
      customDomain: ws.customDomain,
      domainVerified: ws.domainVerifiedAt !== null,
      dns:
        ws.customDomain && ws.domainVerifyToken
          ? {
              txtHost: `${DOMAIN_VERIFY_HOST_PREFIX}.${ws.customDomain}`,
              txtValue: ws.domainVerifyToken,
              cnameTarget: appHost,
            }
          : null,
      status: ws.status,
      legal: parseWorkspaceLegal(ws.legal),
    },
    baseDomain,
    appHost,
    portalProtocol,
    portalPort,
  };
}

/**
 * Aktueller Mandant aus dem Request-Host (Server-Components/Metadata). Liefert
 * nur AKTIVE Workspaces – suspendierte werden bereits in der Middleware zu 404.
 */
export async function getRequestWorkspace(): Promise<WorkspaceHost | null> {
  const { headers } = await import("next/headers");
  const h = await headers();
  // Hinter Caddy trägt i. d. R. x-forwarded-host die echte Kundendomain,
  // lokal/direkt nur host. Beide (in dieser Reihenfolge) versuchen – die
  // Auflösung liefert für Apex/localhost ohnehin null.
  const candidates = [h.get("x-forwarded-host"), h.get("host")].filter(
    (value): value is string => Boolean(value)
  );
  for (const host of candidates) {
    const ws = await lookupWorkspaceByHost(host);
    if (ws && ws.status === "ACTIVE") return ws;
  }
  return null;
}

/**
 * Rechtsangaben für die Rechtsseiten (Impressum/Datenschutz) des aktuellen
 * Mandanten-Hosts. Liefert null auf der Hauptdomain (dort gelten die
 * Plattform-Rechtstexte). `legal` ist null, wenn der Betreiber noch nichts
 * hinterlegt hat → die Seite zeigt dann einen Platzhalter, nie LearnSphere-Daten.
 */
export async function getRequestWorkspaceLegal(): Promise<{
  brandName: string;
  legal: WorkspaceLegalData | null;
} | null> {
  const workspace = await getRequestWorkspace();
  if (!workspace) return null;
  const ws = await db.businessWorkspace.findUnique({
    where: { id: workspace.id },
    select: { legal: true },
  });
  return { brandName: workspace.brandName, legal: parseWorkspaceLegal(ws?.legal) };
}

export interface WorkspaceMailContext {
  brandName: string;
  brandColor: string | null;
  emailFromName: string | null;
  emailDomain: string | null;
  addressForm: "INFORMAL" | "FORMAL";
  /** Portal-Host: verifizierte Kundendomain, sonst <slug>.<base>. */
  portalHost: string;
}

/** Whitelabel-Mail-Kontext des Owners (nur bei aktivem Workspace). */
export async function loadWorkspaceMailContext(
  ownerId: string
): Promise<WorkspaceMailContext | null> {
  const ws = await db.businessWorkspace.findUnique({
    where: { ownerId },
    select: {
      slug: true,
      brandName: true,
      brandColor: true,
      emailFromName: true,
      emailDomain: true,
      addressForm: true,
      customDomain: true,
      domainVerifiedAt: true,
      status: true,
    },
  });
  if (!ws || ws.status !== "ACTIVE") return null;
  const portalHost =
    ws.customDomain && ws.domainVerifiedAt
      ? ws.customDomain
      : `${ws.slug}.${tenantBaseDomain()}`;
  return {
    brandName: ws.brandName,
    brandColor: ws.brandColor,
    emailFromName: ws.emailFromName,
    emailDomain: ws.emailDomain,
    addressForm: ws.addressForm,
    portalHost,
  };
}

/**
 * Absender ("Name <adresse>") für Whitelabel-Mails. Bevorzugt die verifizierte
 * eigene Domain des Portals, sonst eine neutrale Plattform-Domain
 * (WHITELABEL_MAIL_DOMAIN). Ohne beides null → Aufrufer nutzt den Default,
 * wenigstens mit der Marke als Anzeigename.
 */
export function workspaceMailFrom(ctx: WorkspaceMailContext): string | null {
  const domain = ctx.emailDomain || process.env.WHITELABEL_MAIL_DOMAIN;
  if (!domain) return null;
  const name = ctx.emailFromName || ctx.brandName;
  return `${name} <noreply@${domain}>`;
}

/**
 * Auf einem Whitelabel-Mandanten-Host: Kurse sind nur eingeloggt sichtbar.
 * Nicht angemeldete Besucher werden serverseitig zur Login-Seite geleitet.
 * Auf der Hauptdomain (kein Workspace) passiert nichts.
 */
export async function requireTenantAuth(locale: string): Promise<void> {
  const workspace = await getRequestWorkspace();
  if (!workspace) return;
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    const { redirect } = await import("@/i18n/navigation");
    redirect({ href: "/login", locale });
  }
}

/** Kurs-IDs, die der Owner per aktiver Lizenz für sein Team bereitstellt. */
export async function licensedCourseIds(ownerId: string): Promise<string[]> {
  const licenses = await db.businessLicense.findMany({
    where: { ownerId, status: "ACTIVE" },
    select: { courseId: true },
  });
  return [...new Set(licenses.map((l) => l.courseId))];
}

/**
 * Mandanten-Katalog: die vom Owner lizenzierten, veröffentlichten Kurse als
 * fertige Karten (inkl. Sprachen, Ø-Bewertung, „eingeschrieben"-Status des
 * aktuellen Mitglieds).
 */
export async function loadTenantCatalog(
  ownerId: string,
  locale: string,
  viewerId: string | null
): Promise<CourseCardCourse[]> {
  const ids = await licensedCourseIds(ownerId);
  if (ids.length === 0) return [];

  const courses = await db.course.findMany({
    where: { id: { in: ids }, published: true },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      language: true,
      extraLanguages: true,
      translations: true,
      priceCents: true,
      currency: true,
      category: true,
      tags: true,
      coverImage: true,
      creator: { select: { name: true, storefrontName: true } },
      _count: { select: { enrollments: true } },
    },
  });

  const [ratings, enrolled] = await Promise.all([
    loadRatingStats(courses.map((c) => c.id)),
    viewerId
      ? db.enrollment
          .findMany({
            where: { userId: viewerId, courseId: { in: courses.map((c) => c.id) } },
            select: { courseId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.courseId)))
      : Promise.resolve(new Set<string>()),
  ]);

  return courses.map((c) => {
    const languages = courseLanguages(c);
    const texts = resolveCourseText(c, pickCourseLanguage(languages, locale));
    return {
      slug: c.slug,
      title: texts.title,
      subtitle: texts.subtitle ?? "",
      languages,
      priceCents: c.priceCents,
      currency: c.currency,
      // Im Whitelabel-Portal wird der Creator-Name bewusst nicht als Marke
      // hervorgehoben – die Karte zeigt ihn nur dezent (wie im Katalog).
      creatorName: c.creator.storefrontName ?? c.creator.name ?? null,
      enrolledCount: c._count.enrollments,
      category: c.category,
      tags: parseTags(c.tags),
      coverImage: c.coverImage,
      avgRating: ratings.get(c.id)?.average ?? null,
      enrolled: enrolled.has(c.id),
    };
  });
}
