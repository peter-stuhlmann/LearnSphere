import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { CertificateItem } from "@elearning/api-contracts/mobile/v1/quiz";
import { parseCertificateTheme } from "@elearning/core/certificate/theme";
import {
  CertificateDocument,
  type CertificateData,
} from "@/lib/certificate/CertificateDocument";
import { db } from "@/lib/db";

/**
 * Zertifikate: Liste + PDF-Rendering, geteilt zwischen der Web-Route
 * (Session-Cookie) und der Mobile-Route (Bearer). Der Besitz-Check läuft
 * über die userId des Aufrufers.
 */

export async function listCertificates(
  userId: string
): Promise<CertificateItem[]> {
  const certificates = await db.certificate.findMany({
    where: { enrollment: { userId } },
    orderBy: { issuedAt: "desc" },
    include: {
      enrollment: { select: { course: { select: { title: true } } } },
    },
  });
  return certificates.map((certificate) => ({
    serial: certificate.serial,
    courseTitle: certificate.enrollment.course.title,
    scorePercent: certificate.scorePercent,
    issuedAt: certificate.issuedAt.toISOString(),
  }));
}

export type CertificatePdfResult =
  | { ok: true; pdf: Uint8Array<ArrayBuffer>; filename: string }
  | { ok: false; error: "not_found" };

export async function renderCertificatePdf(
  ownerUserId: string,
  serial: string,
  options: { locale?: string | null; mode?: string | null }
): Promise<CertificatePdfResult> {
  const certificate = await db.certificate.findUnique({
    where: { serial },
    include: {
      enrollment: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          course: {
            select: {
              title: true,
              certificateTheme: true,
              creator: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!certificate || certificate.enrollment.user.id !== ownerUserId) {
    return { ok: false, error: "not_found" };
  }

  const locale: CertificateData["locale"] =
    options.locale === "en" ? "en" : "de";
  // Lernende wählen die Variante: hell = Daybreak, dunkel = Midnight
  const mode = options.mode === "dark" ? "dark" : "light";

  const data: CertificateData = {
    recipientName:
      certificate.enrollment.user.name ?? certificate.enrollment.user.email,
    courseTitle: certificate.enrollment.course.title,
    creatorName: certificate.enrollment.course.creator.name ?? "LearnSphere",
    scorePercent: certificate.scorePercent,
    issuedAt: certificate.issuedAt,
    serial: certificate.serial,
    locale,
  };

  const theme = parseCertificateTheme(
    certificate.enrollment.course.certificateTheme
  );

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

  // Öffentliche Verifikations-Seite: Klick auf die Seriennummer im PDF
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/${locale}/${
    locale === "de" ? "verifizieren" : "verify"
  }/${encodeURIComponent(serial)}`;

  const buffer = await renderToBuffer(
    createElement(CertificateDocument, {
      data,
      theme,
      mode,
      logoSrc,
      verifyUrl,
    }) as ReactElement<DocumentProps>
  );

  return {
    ok: true,
    pdf: new Uint8Array(buffer),
    filename: `learnsphere-certificate-${serial}-${locale}-${mode}.pdf`,
  };
}
