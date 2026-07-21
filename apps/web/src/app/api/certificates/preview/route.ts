import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  CertificateDocument,
  type CertificateData,
} from "@/lib/certificate/CertificateDocument";
import { parseCertificateTheme } from "@elearning/core/certificate/theme";

/**
 * PDF-Vorschau für den Zertifikat-Designer: rendert das Zertifikat des
 * eigenen Kurses mit Beispieldaten. Ein optionales `theme` (JSON im
 * Query-Parameter) erlaubt die Vorschau ungespeicherter Änderungen –
 * parseCertificateTheme normalisiert dabei jeden Input auf sichere Werte.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "missing_course" }, { status: 400 });
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      creatorId: true,
      title: true,
      certificateTheme: true,
      creator: { select: { name: true } },
    },
  });
  if (!course || course.creatorId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const langParam = request.nextUrl.searchParams.get("lang");
  const locale: CertificateData["locale"] = langParam === "en" ? "en" : "de";

  const themeParam = request.nextUrl.searchParams.get("theme");
  let themeInput: unknown = course.certificateTheme;
  if (themeParam) {
    try {
      themeInput = JSON.parse(themeParam);
    } catch {
      // ungültiges JSON → gespeichertes bzw. Default-Theme verwenden
    }
  }
  const theme = parseCertificateTheme(themeInput);

  const mode =
    request.nextUrl.searchParams.get("mode") === "dark" ? "dark" : "light";

  const data: CertificateData = {
    recipientName: locale === "de" ? "Maxi Musterfrau" : "Sam Sample",
    courseTitle: course.title,
    creatorName: course.creator.name ?? "LearnSphere",
    scorePercent: 92,
    issuedAt: new Date(),
    serial: "LS-PREVIEW-0000",
    locale,
  };

  // Logo-Pfad ist per Theme-Validierung auf /uploads/*.png|jpg begrenzt;
  // als Buffer übergeben (Dateipfad-src ist unter Windows unzuverlässig)
  const logoSrc = theme.logo
    ? await readFile(path.join(process.cwd(), "public", theme.logo))
        .then((data) => ({
          data,
          format: theme.logo!.endsWith(".png")
            ? ("png" as const)
            : ("jpg" as const),
        }))
        .catch(() => null)
    : null;

  // Auch in der Vorschau verlinkt – zeigt Creators, wie der Klick wirkt
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/${locale}/${
    locale === "de" ? "verifizieren" : "verify"
  }/${encodeURIComponent(data.serial)}`;

  const buffer = await renderToBuffer(
    createElement(CertificateDocument, {
      data,
      theme,
      mode,
      logoSrc,
      verifyUrl,
    }) as ReactElement<DocumentProps>
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="learnsphere-certificate-preview.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
