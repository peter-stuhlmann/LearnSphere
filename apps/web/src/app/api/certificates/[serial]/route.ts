import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { renderCertificatePdf } from "@/lib/services/certificate-service";

/** Zertifikat-PDF (Web, Session-Cookie). Rendering: certificate-service. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serial: string }> }
) {
  const { serial } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await renderCertificatePdf(session.user.id, serial, {
    locale: request.nextUrl.searchParams.get("lang"),
    mode: request.nextUrl.searchParams.get("mode"),
  });
  if (!result.ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(result.pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
