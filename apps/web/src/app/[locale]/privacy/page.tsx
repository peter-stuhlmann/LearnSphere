import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalArticle } from "@/components/marketing/LegalArticle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("privacyTitle") };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale === "en") {
    return (
      <LegalArticle>
        <h1>Privacy Policy</h1>
        <h2>1. Controller</h2>
        <p>
          LearnSphere GmbH (Demo), Musterstraße 12, 10115 Berlin, Germany,
          email: hello@learnsphere.one.
        </p>
        <h2>2. Data we process</h2>
        <ul>
          <li>Account data: name, email address, password (stored as a hash)</li>
          <li>Optional: secret for two-factor authentication (TOTP)</li>
          <li>Learning data: enrollments, watch progress, exam attempts, certificates</li>
          <li>Technical data: server logs (IP address, time, requested resource)</li>
        </ul>
        <h2>3. Purposes and legal bases</h2>
        <p>
          We process account and learning data to fulfil the contract of use
          (Art. 6(1)(b) GDPR): providing courses, tracking progress, grading
          exams and issuing certificates. Server logs are processed based on
          our legitimate interest in secure operation (Art. 6(1)(f) GDPR).
        </p>
        <h2>4. Recipients</h2>
        <p>
          Hosting: Vercel Inc. (deployment) and our database provider. Course
          creators see aggregated learning progress of their participants, but
          never your password or security settings.
        </p>
        <h2>5. Storage period</h2>
        <p>
          Account data is stored until you delete your account. Certificates
          are retained so their authenticity can be verified via the serial
          number.
        </p>
        <h2>6. Your rights</h2>
        <p>
          You have the right to access, rectification, erasure, restriction,
          data portability and objection (Art. 15–21 GDPR), and to lodge a
          complaint with a supervisory authority.
        </p>
        <h2>7. Cookies</h2>
        <p>
          We only use cookies that are strictly necessary for operating the
          platform (session cookie for sign-in, language preference). No
          tracking or advertising cookies are used.
        </p>
        <p>
          <strong>Note:</strong> Demo content – have this reviewed by a legal
          professional before going live.
        </p>
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Datenschutzerklärung</h1>
      <h2>1. Verantwortlicher</h2>
      <p>
        LearnSphere GmbH (Demo), Musterstraße 12, 10115 Berlin, Deutschland,
        E-Mail: hello@learnsphere.one.
      </p>
      <h2>2. Welche Daten wir verarbeiten</h2>
      <ul>
        <li>Kontodaten: Name, E-Mail-Adresse, Passwort (als Hash gespeichert)</li>
        <li>Optional: Geheimnis für die Zwei-Faktor-Authentifizierung (TOTP)</li>
        <li>Lerndaten: Einschreibungen, Sehfortschritt, Prüfungsversuche, Zertifikate</li>
        <li>Technische Daten: Server-Logs (IP-Adresse, Zeitpunkt, aufgerufene Ressource)</li>
      </ul>
      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <p>
        Konto- und Lerndaten verarbeiten wir zur Erfüllung des
        Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO): Bereitstellung der
        Kurse, Fortschrittsverfolgung, Bewertung von Prüfungen und Ausstellung
        von Zertifikaten. Server-Logs verarbeiten wir auf Grundlage unseres
        berechtigten Interesses am sicheren Betrieb (Art. 6 Abs. 1 lit. f
        DSGVO).
      </p>
      <h2>4. Empfänger</h2>
      <p>
        Hosting: Vercel Inc. (Deployment) sowie unser Datenbank-Anbieter.
        Kurs-Creator sehen den aggregierten Lernfortschritt ihrer
        Teilnehmer:innen, niemals aber Passwörter oder
        Sicherheitseinstellungen.
      </p>
      <h2>5. Speicherdauer</h2>
      <p>
        Kontodaten speichern wir, bis du dein Konto löschst. Zertifikate
        bewahren wir auf, damit ihre Echtheit über die Seriennummer geprüft
        werden kann.
      </p>
      <h2>6. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung,
        Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie das
        Recht auf Beschwerde bei einer Aufsichtsbehörde.
      </p>
      <h2>7. Cookies</h2>
      <p>
        Wir setzen ausschließlich technisch notwendige Cookies ein
        (Session-Cookie für die Anmeldung, Spracheinstellung). Tracking- oder
        Werbe-Cookies verwenden wir nicht.
      </p>
      <p>
        <strong>Hinweis:</strong> Demo-Inhalt – vor dem Livegang bitte
        juristisch prüfen lassen.
      </p>
    </LegalArticle>
  );
}
