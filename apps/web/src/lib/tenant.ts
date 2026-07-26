/**
 * Mandanten-Auflösung fürs Business-Whitelabel: Ein Host (Subdomain oder
 * verifizierte Kundendomain) wird auf einen BusinessWorkspace abgebildet.
 *
 * Wird sowohl von der Middleware (Bereichs-Gating) als auch vom TLS-Ask-
 * Endpoint und später von Server-Components (Branding, mandanten-scoped
 * Katalog) genutzt. Die DB wird bewusst dynamisch importiert, damit dieselbe
 * Funktion in der (Edge-nahen) Middleware wie in Node-Routen läuft.
 */

export interface WorkspaceHost {
  id: string;
  slug: string;
  ownerId: string;
  status: "ACTIVE" | "SUSPENDED";
  brandName: string;
  brandColor: string | null;
  logo: string | null;
  /** Anredeform der deutschen Portal-Texte */
  addressForm: "INFORMAL" | "FORMAL";
  /** Auf welchem Weg der Host aufgelöst wurde */
  kind: "subdomain" | "customDomain";
}

/** Subdomains, die nie ein Mandant sein dürfen (Infrastruktur/Marketing). */
const RESERVED_LABELS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "smtp",
  "static",
  "assets",
  "cdn",
  "embed",
  "uploads",
]);

function normalizeHost(raw: string): string {
  return raw.split(":")[0].trim().toLowerCase();
}

/** Host der Hauptanwendung (learnsphere.one) aus NEXT_PUBLIC_APP_URL. */
export function appHostname(): string {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ).hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}

/** Basisdomain für Mandanten-Subdomains (<slug>.<base>). */
export function tenantBaseDomain(): string {
  const explicit = process.env.TENANT_BASE_DOMAIN;
  return (explicit ? explicit : appHostname()).toLowerCase();
}

/**
 * Liefert das Subdomain-Label, wenn `host` die Form `<slug>.<base>` hat und
 * das Label nicht reserviert bzw. der App-Host selbst ist – sonst null.
 */
export function subdomainSlug(hostRaw: string): string | null {
  const host = normalizeHost(hostRaw);
  const base = tenantBaseDomain();
  if (!host || host === base || host === appHostname()) return null;
  if (!host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, host.length - base.length - 1);
  // nur genau eine Ebene tief; keine reservierten Labels
  if (!label || label.includes(".") || RESERVED_LABELS.has(label)) return null;
  return label;
}

// Kurzlebiger In-Memory-Cache (wie die bestehende Whitelabel-Auflösung).
const cache = new Map<string, { value: WorkspaceHost | null; expires: number }>();
const TTL_MS = 60_000;

/**
 * Host → Workspace. Prüft zuerst die Subdomain (per slug), sonst eine
 * verifizierte Kundendomain. Ergebnis (auch „nicht gefunden") wird kurz
 * gecacht, um DB-Last pro Request zu vermeiden.
 */
export async function lookupWorkspaceByHost(
  hostRaw: string
): Promise<WorkspaceHost | null> {
  const host = normalizeHost(hostRaw);
  if (!host || host === appHostname() || host === "localhost") return null;

  const cached = cache.get(host);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value: WorkspaceHost | null = null;
  try {
    const { db } = await import("@/lib/db");
    const slug = subdomainSlug(host);
    const select = {
      id: true,
      slug: true,
      ownerId: true,
      status: true,
      brandName: true,
      brandColor: true,
      logo: true,
      addressForm: true,
    } as const;

    if (slug) {
      const ws = await db.businessWorkspace.findUnique({
        where: { slug },
        select,
      });
      if (ws) value = { ...ws, kind: "subdomain" };
    } else {
      // Kundendomain nur, wenn sie verifiziert ist
      const ws = await db.businessWorkspace.findFirst({
        where: { customDomain: host, domainVerifiedAt: { not: null } },
        select,
      });
      if (ws) value = { ...ws, kind: "customDomain" };
    }
  } catch {
    value = null;
  }

  cache.set(host, { value, expires: Date.now() + TTL_MS });
  return value;
}
