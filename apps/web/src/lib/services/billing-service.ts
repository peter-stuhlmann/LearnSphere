import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { formatPrice } from "@elearning/core/format";
import {
  BillingDocument,
  type BillingDocumentData,
} from "@/lib/billing/BillingDocument";
import { db } from "@/lib/db";

/**
 * Belege: Kaufrechnungen (je bezahlter Einschreibung) und Auszahlungs-
 * Quittungen (je ausgezahltem Payout) als PDF. Besitz-Check über die
 * userId des Aufrufers; Texte liegen wie beim Zertifikat direkt hier.
 */

const TEXTS = {
  de: {
    invoiceTitle: "Rechnung",
    payoutTitle: "Auszahlungs-Quittung",
    numberLabel: "Belegnummer",
    dateLabel: "Datum",
    recipientLabel: "Empfänger:in",
    totalLabel: "Gesamtbetrag",
    courseBy: (name: string) => `Online-Kurs von ${name}`,
    couponNote: (code: string) => `Gutschein „${code}“ wurde angewendet.`,
    creditNote: (amount: string) =>
      `Davon mit LearnSphere-Guthaben bezahlt: ${amount}.`,
    paidNote: "Der Betrag wurde vollständig bezahlt.",
    payoutLine: "Auszahlung des Creator-Guthabens",
    payoutTransfer: (holder: string, iban: string) =>
      `Überwiesen an ${holder}, IBAN ${iban}.`,
    payoutRequested: (date: string) => `Beantragt am ${date}.`,
    businessTitle: "Rechnung – LearnSphere Business",
    businessOneTimeNote: (seats: number) =>
      `Einmalzahlung für ${seats} Zertifizierungs-Seats; kein Abo, keine Verlängerung.`,
    footer:
      "LearnSphere · learnsphere.one – dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig.",
  },
  en: {
    invoiceTitle: "Invoice",
    payoutTitle: "Payout receipt",
    numberLabel: "Document no.",
    dateLabel: "Date",
    recipientLabel: "Recipient",
    totalLabel: "Total",
    courseBy: (name: string) => `Online course by ${name}`,
    couponNote: (code: string) => `Coupon “${code}” was applied.`,
    creditNote: (amount: string) =>
      `Paid with LearnSphere credit: ${amount}.`,
    paidNote: "The amount has been paid in full.",
    payoutLine: "Payout of creator balance",
    payoutTransfer: (holder: string, iban: string) =>
      `Transferred to ${holder}, IBAN ${iban}.`,
    payoutRequested: (date: string) => `Requested on ${date}.`,
    businessTitle: "Invoice – LearnSphere Business",
    businessOneTimeNote: (seats: number) =>
      `One-time payment for ${seats} certification seats; no subscription, no renewal.`,
    footer:
      "LearnSphere · learnsphere.one – this document was generated automatically and is valid without a signature.",
  },
} as const;

const ISSUER = ["LearnSphere", "learnsphere.one"];

export type BillingPdfResult =
  | { ok: true; pdf: Uint8Array<ArrayBuffer>; filename: string }
  | { ok: false; error: "not_found" };

function resolveLocale(value: string | null | undefined): "de" | "en" {
  return value === "en" ? "en" : "de";
}

function formatDate(date: Date, locale: "de" | "en"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
}

/** IBAN nur angerissen zeigen – der Beleg kann weitergereicht werden. */
function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, "");
  if (compact.length <= 8) return compact;
  return `${compact.slice(0, 4)} **** ${compact.slice(-4)}`;
}

async function renderPdf(
  data: BillingDocumentData,
  filename: string
): Promise<BillingPdfResult> {
  const buffer = await renderToBuffer(
    createElement(BillingDocument, { data }) as ReactElement<DocumentProps>
  );
  return { ok: true, pdf: new Uint8Array(buffer), filename };
}

/** Rechnung zu einem bezahlten Kurskauf des Users. */
export async function renderInvoicePdf(
  userId: string,
  enrollmentId: string,
  localeInput: string | null | undefined
): Promise<BillingPdfResult> {
  const locale = resolveLocale(localeInput);
  const t = TEXTS[locale];

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      userId: true,
      pricePaidCents: true,
      couponCode: true,
      creditUsedCents: true,
      createdAt: true,
      course: {
        select: {
          title: true,
          currency: true,
          creator: { select: { name: true, storefrontName: true } },
        },
      },
      user: {
        select: {
          name: true,
          email: true,
          billingAddress: true,
        },
      },
    },
  });
  if (
    !enrollment ||
    enrollment.userId !== userId ||
    enrollment.pricePaidCents <= 0
  ) {
    return { ok: false, error: "not_found" };
  }

  const address = enrollment.user.billingAddress;
  const recipient = address
    ? [
        `${address.firstName} ${address.lastName}`,
        address.street,
        ...(address.addressExtra ? [address.addressExtra] : []),
        `${address.zip} ${address.city}`,
        address.country,
      ]
    : [enrollment.user.name ?? enrollment.user.email, enrollment.user.email];

  const currency = enrollment.course.currency;
  const total = formatPrice(enrollment.pricePaidCents, currency, locale);
  const creatorName =
    enrollment.course.creator.storefrontName ??
    enrollment.course.creator.name ??
    "Creator";

  const notes: string[] = [t.paidNote];
  if (enrollment.couponCode) notes.push(t.couponNote(enrollment.couponCode));
  if (enrollment.creditUsedCents > 0) {
    notes.push(
      t.creditNote(formatPrice(enrollment.creditUsedCents, currency, locale))
    );
  }

  const number = `R-${enrollment.createdAt.getFullYear()}-${enrollment.id
    .slice(-8)
    .toUpperCase()}`;

  return renderPdf(
    {
      title: t.invoiceTitle,
      number,
      numberLabel: t.numberLabel,
      dateLabel: t.dateLabel,
      date: formatDate(enrollment.createdAt, locale),
      issuer: ISSUER,
      recipientLabel: t.recipientLabel,
      recipient,
      lines: [
        {
          label: `${enrollment.course.title} – ${t.courseBy(creatorName)}`,
          amount: total,
        },
      ],
      totalLabel: t.totalLabel,
      total,
      notes,
      footer: t.footer,
    },
    `learnsphere-${t.invoiceTitle.toLowerCase().replace(/[^a-z]+/g, "-")}-${number}.pdf`
  );
}

/**
 * Rechnung zu einer LearnSphere-Business-Lizenz (je Abrechnungszeitraum:
 * Monatsbetrag bzw. Jahresbetrag bei jährlicher Zahlweise).
 */
export async function renderBusinessInvoicePdf(
  userId: string,
  licenseId: string,
  localeInput: string | null | undefined
): Promise<BillingPdfResult> {
  const locale = resolveLocale(localeInput);
  const t = TEXTS[locale];

  const license = await db.businessLicense.findFirst({
    where: { id: licenseId, ownerId: userId },
    select: {
      id: true,
      seats: true,
      seatPriceCents: true,
      createdAt: true,
      course: { select: { title: true } },
      owner: {
        select: { name: true, email: true, billingAddress: true },
      },
    },
  });
  if (!license) return { ok: false, error: "not_found" };

  const address = license.owner.billingAddress;
  const recipient = address
    ? [
        `${address.firstName} ${address.lastName}`,
        address.street,
        ...(address.addressExtra ? [address.addressExtra] : []),
        `${address.zip} ${address.city}`,
        address.country,
      ]
    : [license.owner.name ?? license.owner.email, license.owner.email];

  // Einmalzahlung: Seats × (rabattierter) Seat-Preis.
  const seatPrice = license.seatPriceCents;
  const totalCents = seatPrice * license.seats;

  const lines = [
    {
      label: `${license.course.title} – ${license.seats} × ${formatPrice(seatPrice, "EUR", locale)}`,
      amount: formatPrice(totalCents, "EUR", locale),
    },
  ];

  const number = `B-${license.createdAt.getFullYear()}-${license.id
    .slice(-8)
    .toUpperCase()}`;

  return renderPdf(
    {
      title: t.businessTitle,
      number,
      numberLabel: t.numberLabel,
      dateLabel: t.dateLabel,
      date: formatDate(license.createdAt, locale),
      issuer: ISSUER,
      recipientLabel: t.recipientLabel,
      recipient,
      lines,
      totalLabel: t.totalLabel,
      total: formatPrice(totalCents, "EUR", locale),
      notes: [t.businessOneTimeNote(license.seats)],
      footer: t.footer,
    },
    `learnsphere-business-${number}.pdf`
  );
}

/** Quittung zu einer ausgezahlten Auszahlung des Creators. */
export async function renderPayoutReceiptPdf(
  userId: string,
  payoutId: string,
  localeInput: string | null | undefined
): Promise<BillingPdfResult> {
  const locale = resolveLocale(localeInput);
  const t = TEXTS[locale];

  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      userId: true,
      amountCents: true,
      status: true,
      holder: true,
      iban: true,
      createdAt: true,
      paidAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  // Quittung gibt es erst, wenn tatsächlich ausgezahlt wurde
  if (!payout || payout.userId !== userId || payout.status !== "PAID") {
    return { ok: false, error: "not_found" };
  }

  const total = formatPrice(payout.amountCents, "EUR", locale);
  const number = `A-${payout.createdAt.getFullYear()}-${payout.id
    .slice(-8)
    .toUpperCase()}`;

  return renderPdf(
    {
      title: t.payoutTitle,
      number,
      numberLabel: t.numberLabel,
      dateLabel: t.dateLabel,
      date: formatDate(payout.paidAt ?? payout.createdAt, locale),
      issuer: ISSUER,
      recipientLabel: t.recipientLabel,
      recipient: [payout.user.name ?? payout.user.email, payout.user.email],
      lines: [{ label: t.payoutLine, amount: total }],
      totalLabel: t.totalLabel,
      total,
      notes: [
        t.payoutTransfer(payout.holder, maskIban(payout.iban)),
        t.payoutRequested(formatDate(payout.createdAt, locale)),
      ],
      footer: t.footer,
    },
    `learnsphere-payout-${number}.pdf`
  );
}
