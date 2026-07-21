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
        <p>
          <em>
            This English translation is provided for convenience only. The
            German version is legally binding.
          </em>
        </p>
        <h2>Information pursuant to § 5 DDG</h2>
        <address>
          Peter R. Stuhlmann
          <br />
          Martha-Arendsee-Str. 10
          <br />
          12681 Berlin, Germany
        </address>
        <h2>Contact</h2>
        <p>
          Phone: +49 (0) 1578 5630944
          <br />
          Email:{" "}
          <a href="mailto:info@peter-stuhlmann.de">info@peter-stuhlmann.de</a>
        </p>
        <h2>Responsible for content pursuant to § 18 (2) MStV</h2>
        <p>Peter R. Stuhlmann, address as above</p>
        <h2>Consumer dispute resolution</h2>
        <p>
          We are neither willing nor obliged to participate in dispute
          resolution proceedings before a consumer arbitration board.
        </p>
        <h2>Liability for content</h2>
        <p>
          As a service provider, we are responsible for our own content on
          these pages in accordance with general law pursuant to § 7 (1) DDG.
          Pursuant to §§ 8 to 10 DDG, however, we as a service provider are
          not obliged to monitor transmitted or stored third-party information
          or to investigate circumstances that indicate illegal activity.
          Obligations to remove or block the use of information under general
          law remain unaffected. However, liability in this respect is only
          possible from the point in time at which we become aware of a
          specific infringement. Upon becoming aware of such infringements, we
          will remove the content in question immediately.
        </p>
        <p>
          Courses published on LearnSphere are created by the respective
          course creators. The creators are responsible for their course
          content. If you become aware of content that infringes the law,
          please notify us at the address above.
        </p>
        <h2>Liability for links</h2>
        <p>
          Our offering contains links to external third-party websites over
          whose content we have no influence. We therefore cannot accept any
          liability for this third-party content. The respective provider or
          operator of the linked pages is always responsible for their
          content. The linked pages were checked for possible legal
          infringements at the time of linking. No illegal content was
          identifiable at the time of linking. Permanent monitoring of the
          content of the linked pages is, however, not reasonable without
          concrete indications of an infringement. Upon becoming aware of
          infringements, we will remove such links immediately.
        </p>
        <h2>Copyright</h2>
        <p>
          The content and works created by the site operator on these pages
          are subject to German copyright law. Reproduction, editing,
          distribution and any kind of exploitation beyond the limits of
          copyright law require the written consent of the respective author
          or creator. Downloads and copies of this site are only permitted
          for private, non-commercial use. Insofar as content on this site
          was not created by the operator, the copyrights of third parties
          are respected — in particular, course content remains the
          intellectual property of the respective creators. Should you
          nevertheless become aware of a copyright infringement, please
          notify us accordingly. Upon becoming aware of infringements, we
          will remove such content immediately.
        </p>
        <p>
          Source: <a href="https://www.e-recht24.de">eRecht24</a>
        </p>
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <address>
        Peter R. Stuhlmann
        <br />
        Martha-Arendsee-Str. 10
        <br />
        12681 Berlin, Deutschland
      </address>
      <h2>Kontakt</h2>
      <p>
        Telefon: +49 (0) 1578 5630944
        <br />
        E-Mail:{" "}
        <a href="mailto:info@peter-stuhlmann.de">info@peter-stuhlmann.de</a>
      </p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>Peter R. Stuhlmann, Anschrift wie oben</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>
      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte
        auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
        §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht
        verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
        überwachen oder nach Umständen zu forschen, die auf eine
        rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung
        oder Sperrung der Nutzung von Informationen nach den allgemeinen
        Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist
        jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
        Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
        Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
      </p>
      <p>
        Die auf LearnSphere veröffentlichten Kurse werden von den jeweiligen
        Kurs-Creatorn erstellt. Für die Kursinhalte sind die Creator
        verantwortlich. Solltest du auf rechtswidrige Inhalte aufmerksam
        werden, bitten wir um einen Hinweis an die oben genannte Adresse.
      </p>
      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
        fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
        verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
        der Seiten verantwortlich. Die verlinkten Seiten wurden zum
        Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
        Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht
        erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten
        Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung
        nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir
        derartige Links umgehend entfernen.
      </p>
      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
        diesen Seiten unterliegen dem deutschen Urheberrecht. Die
        Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
        Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
        schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
        Downloads und Kopien dieser Seite sind nur für den privaten, nicht
        kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser
        Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte
        Dritter beachtet — insbesondere bleiben Kursinhalte geistiges
        Eigentum der jeweiligen Creator. Solltest du trotzdem auf eine
        Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
        entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen
        werden wir derartige Inhalte umgehend entfernen.
      </p>
      <p>
        Quelle: <a href="https://www.e-recht24.de">eRecht24</a>
      </p>
    </LegalArticle>
  );
}
