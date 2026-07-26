/**
 * Einladungs-Mail für LearnSphere-Business-Seats: fester, nicht
 * anpassbarer Inhalt im Aurora-Design (gleiche Optik wie die
 * Creator-Mails). Reine Funktion (TDD) – versendet wird im Service.
 */

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const THEME = {
  canvas: "#07080F",
  card: "#12141F",
  text: "#EDEDF2",
  muted: "#A7A9BC",
  accent: "#C8FF4D",
  border: "#262A3A",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TEXTS = {
  de: {
    subject: (course: string) => `Dein Team-Zugang: ${course}`,
    heading: "Du wurdest zu einem Kurs eingeladen",
    body: (owner: string, course: string) =>
      `${owner} hat dir über LearnSphere Business Zugriff auf den Kurs „${course}“ freigeschaltet. Melde dich mit dieser E-Mail-Adresse an – oder registriere dich damit, falls du noch kein Konto hast – und der Kurs wartet in deinem Lernbereich auf dich.`,
    cta: "Jetzt loslegen",
    footer:
      "Du erhältst diese E-Mail, weil deine Adresse für eine Team-Lizenz auf LearnSphere eingetragen wurde. Antworten auf diese Absender-Adresse werden nicht beantwortet.",
  },
  en: {
    subject: (course: string) => `Your team access: ${course}`,
    heading: "You've been invited to a course",
    body: (owner: string, course: string) =>
      `${owner} has granted you access to the course “${course}” via LearnSphere Business. Sign in with this email address – or register with it if you don't have an account yet – and the course will be waiting in your learning area.`,
    cta: "Get started",
    footer:
      "You are receiving this email because your address was added to a team license on LearnSphere. Replies to this sender address cannot be answered.",
  },
} as const;

export interface BusinessInviteInput {
  ownerName: string;
  courseTitle: string;
  loginUrl: string;
  locale: "de" | "en";
}

export function renderBusinessInviteEmail(input: BusinessInviteInput): {
  subject: string;
  html: string;
  text: string;
} {
  const t = TEXTS[input.locale];
  const owner = escapeHtml(input.ownerName);
  const course = escapeHtml(input.courseTitle);
  const loginUrl = escapeHtml(input.loginUrl);

  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t.subject(input.courseTitle))}</title>
</head>
<body style="margin:0;padding:0;background:${THEME.canvas};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${THEME.canvas};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${THEME.card};border:1px solid ${THEME.border};border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0B0C15;background-image:radial-gradient(ellipse at top,#2A3310 0%,#0B0C15 70%);padding:26px 32px;border-bottom:2px solid ${THEME.accent};">
          <span style="font-family:${FONT};font-size:20px;font-weight:700;color:#FFFFFF;">Learn<span style="color:${THEME.accent};">Sphere</span></span><br>
          <span style="display:inline-block;margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${THEME.accent};">LearnSphere Business</span>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;color:#FFFFFF;">${t.heading}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 8px;font-family:${FONT};font-size:15px;line-height:1.65;color:${THEME.text};">
          <p style="margin:0;">${t.body(owner, course)}</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 32px 30px;">
          <a href="${loginUrl}" style="display:inline-block;padding:13px 30px;border-radius:999px;background:${THEME.accent};color:#0B0C15;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;">${t.cta}</a>
        </td></tr>
        <tr><td style="padding:18px 32px 24px;border-top:1px solid ${THEME.border};">
          <p style="margin:0 0 8px;font-family:${FONT};font-size:11px;line-height:1.6;color:${THEME.muted};">${t.footer}</p>
          <p style="margin:0;font-family:${FONT};font-size:11px;color:${THEME.muted};">Learn<span style="color:${THEME.accent};">Sphere</span> · learnsphere.one</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    t.heading,
    "",
    TEXTS[input.locale].body(input.ownerName, input.courseTitle),
    "",
    `${t.cta}: ${input.loginUrl}`,
    "",
    "—",
    t.footer,
  ].join("\n");

  return { subject: t.subject(input.courseTitle), html, text };
}

/**
 * Whitelabel-Variante der Einladungs-Mail: KEIN LearnSphere. Nutzt die Marke
 * des Portal-Betreibers (Name + optionale Akzentfarbe) und verlinkt auf das
 * Portal. Das eingeladene Team erfährt so nichts über die Plattform dahinter.
 */
const WL_TEXTS = {
  de: {
    subject: (brand: string, course: string) => `${brand}: Dein Zugang zu „${course}“`,
    heading: (brand: string) => `Willkommen bei ${brand}`,
    body: (brand: string, course: string) =>
      `Du wurdest für den Kurs „${course}“ freigeschaltet. Melde dich mit dieser E-Mail-Adresse an – oder registriere dich damit, falls du noch kein Konto hast – und der Kurs wartet in deinem Lernbereich bei ${brand} auf dich.`,
    cta: "Jetzt loslegen",
    footer: (brand: string) =>
      `Du erhältst diese E-Mail, weil deine Adresse bei ${brand} für einen Kurs eingetragen wurde.`,
  },
  "de-formal": {
    subject: (brand: string, course: string) => `${brand}: Ihr Zugang zu „${course}“`,
    heading: (brand: string) => `Willkommen bei ${brand}`,
    body: (brand: string, course: string) =>
      `Sie wurden für den Kurs „${course}“ freigeschaltet. Melden Sie sich mit dieser E-Mail-Adresse an – oder registrieren Sie sich damit, falls Sie noch kein Konto haben – und der Kurs wartet in Ihrem Lernbereich bei ${brand} auf Sie.`,
    cta: "Jetzt loslegen",
    footer: (brand: string) =>
      `Sie erhalten diese E-Mail, weil Ihre Adresse bei ${brand} für einen Kurs eingetragen wurde.`,
  },
  en: {
    subject: (brand: string, course: string) => `${brand}: your access to “${course}”`,
    heading: (brand: string) => `Welcome to ${brand}`,
    body: (brand: string, course: string) =>
      `You've been given access to the course “${course}”. Sign in with this email address – or register with it if you don't have an account yet – and the course will be waiting in your learning area at ${brand}.`,
    cta: "Get started",
    footer: (brand: string) =>
      `You are receiving this email because your address was added to a course at ${brand}.`,
  },
} as const;

export interface WhitelabelInviteInput {
  brandName: string;
  /** Akzentfarbe (Hex) des Portals; ohne Angabe ein neutrales Blau. */
  accentColor?: string | null;
  courseTitle: string;
  loginUrl: string;
  locale: "de" | "en";
  /** Sie-Anrede (nur Deutsch); ohne Angabe du-Form. */
  formal?: boolean;
}

export function renderWhitelabelInviteEmail(input: WhitelabelInviteInput): {
  subject: string;
  html: string;
  text: string;
} {
  const t =
    input.formal && input.locale === "de" ? WL_TEXTS["de-formal"] : WL_TEXTS[input.locale];
  const accent =
    input.accentColor && /^#[0-9a-fA-F]{6}$/.test(input.accentColor)
      ? input.accentColor
      : "#4DD8FF";
  const brand = escapeHtml(input.brandName);
  const course = escapeHtml(input.courseTitle);
  const loginUrl = escapeHtml(input.loginUrl);
  const onAccent = "#0B0C15";

  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t.subject(input.brandName, input.courseTitle))}</title>
</head>
<body style="margin:0;padding:0;background:${THEME.canvas};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${THEME.canvas};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${THEME.card};border:1px solid ${THEME.border};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:26px 32px;border-bottom:2px solid ${accent};">
          <span style="font-family:${FONT};font-size:20px;font-weight:700;color:#FFFFFF;">${brand}</span>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;color:#FFFFFF;">${t.heading(brand)}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 8px;font-family:${FONT};font-size:15px;line-height:1.65;color:${THEME.text};">
          <p style="margin:0;">${t.body(brand, course)}</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 32px 30px;">
          <a href="${loginUrl}" style="display:inline-block;padding:13px 30px;border-radius:999px;background:${accent};color:${onAccent};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;">${t.cta}</a>
        </td></tr>
        <tr><td style="padding:18px 32px 24px;border-top:1px solid ${THEME.border};">
          <p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.6;color:${THEME.muted};">${t.footer(brand)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    t.heading(input.brandName),
    "",
    t.body(input.brandName, input.courseTitle),
    "",
    `${t.cta}: ${input.loginUrl}`,
    "",
    "—",
    t.footer(input.brandName),
  ].join("\n");

  return { subject: t.subject(input.brandName, input.courseTitle), html, text };
}
