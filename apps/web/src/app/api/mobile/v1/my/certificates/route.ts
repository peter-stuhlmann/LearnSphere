import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { listCertificates } from "@/lib/services/certificate-service";

/** Zertifikate des angemeldeten Users. */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const data = await listCertificates(auth.userId);
  return jsonResponse({ data });
}
