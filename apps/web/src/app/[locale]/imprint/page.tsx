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
  return { title: t("imprintTitle") };
}

export default async function ImprintPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale === "en") {
    return (
      <LegalArticle>
        <h1>Imprint</h1>
        <h2>Information pursuant to § 5 DDG</h2>
        <address>
          LearnSphere GmbH (Demo)
          <br />
          Musterstraße 12
          <br />
          10115 Berlin, Germany
        </address>
        <h2>Contact</h2>
        <p>
          Email: <a href="mailto:hello@learnsphere.one">hello@learnsphere.one</a>
          <br />
          Phone: +49 30 000000-0
        </p>
        <h2>Represented by</h2>
        <p>Managing director: Max Mustermann</p>
        <h2>Register entry</h2>
        <p>
          Commercial register: Amtsgericht Berlin-Charlottenburg, HRB 000000
          <br />
          VAT ID pursuant to § 27a UStG: DE000000000
        </p>
        <h2>Responsible for content pursuant to § 18 (2) MStV</h2>
        <p>Max Mustermann, address as above</p>
        <p>
          <strong>Note:</strong> This is a demo platform. All company details
          are placeholders and must be replaced before going live.
        </p>
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <address>
        LearnSphere GmbH (Demo)
        <br />
        Musterstraße 12
        <br />
        10115 Berlin, Deutschland
      </address>
      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:hello@learnsphere.one">hello@learnsphere.one</a>
        <br />
        Telefon: +49 30 000000-0
      </p>
      <h2>Vertreten durch</h2>
      <p>Geschäftsführer: Max Mustermann</p>
      <h2>Registereintrag</h2>
      <p>
        Handelsregister: Amtsgericht Berlin-Charlottenburg, HRB 000000
        <br />
        USt-IdNr. gemäß § 27a UStG: DE000000000
      </p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>Max Mustermann, Anschrift wie oben</p>
      <p>
        <strong>Hinweis:</strong> Dies ist eine Demo-Plattform. Alle
        Unternehmensangaben sind Platzhalter und müssen vor dem Livegang
        ersetzt werden.
      </p>
    </LegalArticle>
  );
}
