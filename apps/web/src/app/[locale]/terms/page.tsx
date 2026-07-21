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
  return { title: t("termsTitle") };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale === "en") {
    return (
      <LegalArticle>
        <h1>Terms and Conditions</h1>
        <h2>1. Scope</h2>
        <p>
          These terms govern the use of the LearnSphere platform by learners
          (clients) and course creators.
        </p>
        <h2>2. Account</h2>
        <p>
          An account is required to use the platform. You must provide accurate
          information and keep your credentials secure. Accounts are not
          transferable.
        </p>
        <h2>3. Courses and purchases</h2>
        <p>
          Creators decide whether a course is free or paid. Paid courses are
          bought per course; the price shown at checkout applies. After
          purchase you receive permanent access to the course content as long
          as the course is offered on the platform.
        </p>
        <h2>4. Exams and certificates</h2>
        <p>
          Admission to the final exam may require a minimum watch share set by
          the creator. Certificates document a passed exam and are issued in
          the name stored in your account.
        </p>
        <h2>5. Creator revenue share</h2>
        <p>
          There are no fixed fees for creators. Per completed sale, the
          creator receives 50% of the sale price for sales via LearnSphere and
          75% for sales via their own channels (widget/API); the remainder
          goes to LearnSphere. Payouts are made via Stripe Connect.
        </p>
        <h2>6. Content and conduct</h2>
        <p>
          Creators warrant they hold the rights to uploaded content. Unlawful,
          discriminatory or misleading content is prohibited and may be
          removed.
        </p>
        <h2>7. Right of withdrawal</h2>
        <p>
          Consumers have a statutory 14-day right of withdrawal for paid
          purchases. It expires for digital content once you expressly consent
          to immediate performance and acknowledge losing the right.
        </p>
        <h2>8. Liability</h2>
        <p>
          We are liable without limitation for intent and gross negligence.
          For slight negligence, liability is limited to breaches of essential
          contractual duties and foreseeable, typical damage.
        </p>
        <h2>9. Final provisions</h2>
        <p>
          German law applies. Should individual provisions be invalid, the
          remainder stays unaffected.
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
      <h1>Allgemeine Geschäftsbedingungen</h1>
      <h2>1. Geltungsbereich</h2>
      <p>
        Diese AGB regeln die Nutzung der Plattform LearnSphere durch Lernende
        (Clients) und Kurs-Creator.
      </p>
      <h2>2. Konto</h2>
      <p>
        Für die Nutzung ist ein Konto erforderlich. Du bist verpflichtet,
        zutreffende Angaben zu machen und deine Zugangsdaten sicher zu
        verwahren. Konten sind nicht übertragbar.
      </p>
      <h2>3. Kurse und Käufe</h2>
      <p>
        Creator legen fest, ob ein Kurs kostenlos oder kostenpflichtig ist.
        Kostenpflichtige Kurse werden je Kurs erworben; es gilt der im
        Bestellvorgang angezeigte Preis. Nach dem Kauf erhältst du dauerhaften
        Zugriff auf die Kursinhalte, solange der Kurs auf der Plattform
        angeboten wird.
      </p>
      <h2>4. Prüfungen und Zertifikate</h2>
      <p>
        Die Zulassung zur Abschlussprüfung kann einen vom Creator
        festgelegten Mindest-Sehanteil voraussetzen. Zertifikate dokumentieren
        eine bestandene Prüfung und werden auf den im Konto hinterlegten Namen
        ausgestellt.
      </p>
      <h2>5. Umsatzbeteiligung für Creator</h2>
      <p>
        Für Creator fallen keine festen Gebühren an. Pro abgeschlossenem
        Verkauf erhält der Creator 50 % des Verkaufspreises bei Verkäufen
        über LearnSphere und 75 % bei Verkäufen über eigene Kanäle
        (Widget/API); der Rest geht an LearnSphere. Die Auszahlung erfolgt
        über Stripe Connect.
      </p>
      <h2>6. Inhalte und Verhalten</h2>
      <p>
        Creator sichern zu, die Rechte an hochgeladenen Inhalten zu halten.
        Rechtswidrige, diskriminierende oder irreführende Inhalte sind
        untersagt und können entfernt werden.
      </p>
      <h2>7. Widerrufsrecht</h2>
      <p>
        Verbraucher:innen haben bei kostenpflichtigen Käufen ein gesetzliches
        14-tägiges Widerrufsrecht. Bei digitalen Inhalten erlischt es, wenn du
        der sofortigen Vertragserfüllung ausdrücklich zustimmst und den
        Verlust des Widerrufsrechts bestätigst.
      </p>
      <h2>8. Haftung</h2>
      <p>
        Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit. Bei
        leichter Fahrlässigkeit haften wir nur für die Verletzung
        wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren,
        vertragstypischen Schaden.
      </p>
      <h2>9. Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht. Sollten einzelne Bestimmungen unwirksam sein,
        bleibt der Rest unberührt.
      </p>
      <p>
        <strong>Hinweis:</strong> Demo-Inhalt – vor dem Livegang bitte
        juristisch prüfen lassen.
      </p>
    </LegalArticle>
  );
}
