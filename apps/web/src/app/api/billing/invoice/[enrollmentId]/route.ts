import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { renderInvoicePdf } from "@/lib/services/billing-service";

/** Rechnungs-PDF zu einem eigenen Kurskauf (Session-Cookie). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await renderInvoicePdf(
    session.user.id,
    enrollmentId,
    request.nextUrl.searchParams.get("lang")
  );
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
