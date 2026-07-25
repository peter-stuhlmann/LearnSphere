import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { renderPayoutReceiptPdf } from "@/lib/services/billing-service";

/** Auszahlungs-Quittung (PDF) zu einer eigenen, ausgezahlten Auszahlung. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const { payoutId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await renderPayoutReceiptPdf(
    session.user.id,
    payoutId,
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
