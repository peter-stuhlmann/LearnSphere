import { NextResponse } from "next/server";
import { lookupWorkspaceByHost } from "@/lib/tenant";

/**
 * Caddy On-Demand-TLS „ask"-Endpoint.
 *
 * Caddy fragt hier VOR jeder Zertifikatsausstellung nach, ob der angefragte
 * Host bekannt ist. Ohne diese Prüfung könnte ein Angreifer über beliebige
 * Hostnamen massenhaft Zertifikate auslösen (Let's-Encrypt-Rate-Limits,
 * Ressourcen). Nur aktive Mandanten-Hosts (Subdomain oder verifizierte
 * Kundendomain) erhalten ein 200 – alles andere 403.
 *
 * Optional per INTERNAL_TLS_CHECK_TOKEN abgesichert (Caddy sendet den Header),
 * damit der Endpoint nicht öffentlich pollbar ist.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = process.env.INTERNAL_TLS_CHECK_TOKEN;
  if (token && request.headers.get("x-tls-check-token") !== token) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return new NextResponse("missing domain", { status: 400 });
  }

  const workspace = await lookupWorkspaceByHost(domain);
  if (workspace && workspace.status === "ACTIVE") {
    return new NextResponse("ok", { status: 200 });
  }
  return new NextResponse("unknown host", { status: 403 });
}
