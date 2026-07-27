import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import { tenantUrlParts, type WorkspaceHost } from "@/lib/tenant";
import { getRequestWorkspace } from "@/lib/services/workspace-service";

/**
 * Basis-URL für Sitemap/robots je nach Host: auf einem Whitelabel-Mandanten
 * die EIGENE Domain (kein learnsphere.one-Leak), sonst die Hauptdomain.
 * Wird von /sitemap.xml, /sitemaps/[file] und /sitemap.xsl genutzt.
 */
export async function getSitemapContext(): Promise<{
  baseUrl: string;
  workspace: WorkspaceHost | null;
}> {
  const workspace = await getRequestWorkspace();
  if (!workspace) {
    return { baseUrl: getEnv().NEXT_PUBLIC_APP_URL, workspace: null };
  }
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(",")[0]
    .trim();
  const { protocol } = tenantUrlParts();
  return { baseUrl: `${protocol}//${host}`, workspace };
}
