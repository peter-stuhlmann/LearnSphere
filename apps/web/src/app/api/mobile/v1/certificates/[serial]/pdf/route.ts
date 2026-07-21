import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError } from "@/lib/mobile/http";
import { renderCertificatePdf } from "@/lib/services/certificate-service";

/** Zertifikat-PDF für die App (Bearer statt Session-Cookie). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serial: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { serial } = await params;
  const result = await renderCertificatePdf(auth.userId, serial, {
    locale: request.nextUrl.searchParams.get("lang"),
    mode: request.nextUrl.searchParams.get("mode"),
  });
  if (!result.ok) return jsonError("not_found", 404);

  return new Response(result.pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
