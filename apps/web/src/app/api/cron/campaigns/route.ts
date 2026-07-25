import { NextRequest, NextResponse } from "next/server";
import { processDueCampaigns } from "@/lib/services/creator-email-service";

/**
 * Externer Trigger für geplante Creator-Mails – optional: Der eigentliche
 * Scheduler läuft in-process (instrumentation.ts, minütlich), diese Route
 * ist der Zusatzweg für Host-Cron/Monitoring ("curl -H 'Authorization:
 * Bearer <CRON_SECRET>' /api/cron/campaigns"). Ohne konfiguriertes Secret
 * (lokale Entwicklung) ist die Route offen – dort verschickt sie ohnehin
 * nur Dev-Log-Mails.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processDueCampaigns(new Date());
  return NextResponse.json({ ok: true, processed: result.processed });
}
