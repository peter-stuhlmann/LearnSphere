import type { WorkspaceLegalData } from "@elearning/core/validation";
import { LegalArticle } from "@/components/marketing/LegalArticle";
import { AccessibilityFeedbackForm } from "@/components/marketing/AccessibilityFeedbackForm";

/**
 * Mandantenspezifische Rechtstexte fürs Whitelabel-Portal. Der Portal-Betreiber
 * ist Verantwortlicher i.S.d. DSGVO, die Plattform verarbeitet ausschließlich
 * weisungsgebunden als Auftragsverarbeiter (Art. 28 DSGVO). Es tauchen bewusst
 * KEINE LearnSphere-Daten auf. Ohne hinterlegte Angaben: Platzhalter.
 */

function AddressBlock({ legal }: { legal: WorkspaceLegalData }) {
  return (
    <address>
      {legal.operator}
      {legal.legalForm ? ` (${legal.legalForm})` : ""}
      <br />
      {legal.street}
      <br />
      {legal.zip} {legal.city}
      <br />
      {legal.country}
    </address>
  );
}

/* --------------------------------------------------------------- Impressum */

export function TenantImprint({
  legal,
  locale,
}: {
  brandName: string;
  legal: WorkspaceLegalData | null;
  locale: string;
}) {
  if (!legal) {
    return (
      <LegalArticle>
        <h1>{locale === "en" ? "Imprint" : "Impressum"}</h1>
        <p>
          {locale === "en"
            ? "The operator of this portal has not yet provided the legal information. Please contact the portal operator directly."
            : "Die Rechtsangaben für dieses Portal wurden vom Betreiber noch nicht hinterlegt. Bitte wende dich an den Betreiber dieses Portals."}
        </p>
      </LegalArticle>
    );
  }

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
        <AddressBlock legal={legal} />
        <h2>Contact</h2>
        <p>
          {legal.phone ? (
            <>
              Phone: {legal.phone}
              <br />
            </>
          ) : null}
          Email: <a href={`mailto:${legal.email}`}>{legal.email}</a>
        </p>
        <h2>Responsible for content pursuant to § 18 (2) MStV</h2>
        <p>{legal.representative}</p>
        {legal.vatId ? (
          <>
            <h2>VAT identification number</h2>
            <p>{legal.vatId}</p>
          </>
        ) : null}
        {legal.register ? (
          <>
            <h2>Register entry</h2>
            <p>{legal.register}</p>
          </>
        ) : null}
        <h2>Consumer dispute resolution</h2>
        <p>
          We are neither willing nor obliged to participate in dispute
          resolution proceedings before a consumer arbitration board.
        </p>
        <h2>Liability for content &amp; links</h2>
        <p>
          As a service provider, we are responsible for our own content on
          these pages in accordance with general law. Upon becoming aware of
          any specific infringement of the law, we will remove the content in
          question immediately. Our offering may contain links to external
          third-party websites over whose content we have no influence; the
          respective provider or operator of the linked pages is always
          responsible for their content.
        </p>
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <AddressBlock legal={legal} />
      <h2>Kontakt</h2>
      <p>
        {legal.phone ? (
          <>
            Telefon: {legal.phone}
            <br />
          </>
        ) : null}
        E-Mail: <a href={`mailto:${legal.email}`}>{legal.email}</a>
      </p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>{legal.representative}</p>
      {legal.vatId ? (
        <>
          <h2>Umsatzsteuer-Identifikationsnummer</h2>
          <p>{legal.vatId}</p>
        </>
      ) : null}
      {legal.register ? (
        <>
          <h2>Registereintrag</h2>
          <p>{legal.register}</p>
        </>
      ) : null}
      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
      <h2>Haftung für Inhalte &amp; Links</h2>
      <p>
        Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach
        den allgemeinen Gesetzen verantwortlich. Bei Bekanntwerden einer
        konkreten Rechtsverletzung entfernen wir die betreffenden Inhalte
        umgehend. Unser Angebot kann Links zu externen Webseiten Dritter
        enthalten, auf deren Inhalte wir keinen Einfluss haben; für die Inhalte
        der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
        verantwortlich.
      </p>
    </LegalArticle>
  );
}

/* ------------------------------------------------------------ Datenschutz */

export function TenantPrivacy({
  legal,
  locale,
  formal,
}: {
  brandName: string;
  legal: WorkspaceLegalData | null;
  locale: string;
  /** Sie-Anrede (deutsche Portal-Texte auf FORMAL) */
  formal: boolean;
}) {
  /** deutsche Anrede-Variante wählen (du/Sie) */
  const du = (informal: string, sie: string) => (formal ? sie : informal);

  if (!legal) {
    return (
      <LegalArticle>
        <h1>{locale === "en" ? "Privacy Policy" : "Datenschutzerklärung"}</h1>
        <p>
          {locale === "en"
            ? "The operator of this portal has not yet provided the legal information. Please contact the portal operator directly."
            : "Die Datenschutzangaben für dieses Portal wurden vom Betreiber noch nicht hinterlegt. Bitte wende dich an den Betreiber dieses Portals."}
        </p>
      </LegalArticle>
    );
  }

  if (locale === "en") {
    return (
      <LegalArticle>
        <h1>Privacy Policy</h1>
        <p>
          <em>
            This English translation is provided for convenience only. The
            German version is legally binding.
          </em>
        </p>

        <h2>Controller</h2>
        <p>The controller for data processing in this portal is:</p>
        <AddressBlock legal={legal} />
        <p>
          Email: <a href={`mailto:${legal.email}`}>{legal.email}</a>
          {legal.phone ? (
            <>
              <br />
              Phone: {legal.phone}
            </>
          ) : null}
        </p>
        <p>
          This learning portal is provided via a technical service provider
          which processes personal data exclusively on the controller&apos;s
          behalf and on its instructions (processing on behalf pursuant to
          Art. 28 GDPR). A corresponding data processing agreement is in place.
        </p>

        <h2>Hosting</h2>
        <p>
          The portal is operated on the servers of a professional hoster
          within the EU (data centre in Frankfurt am Main, Germany). The
          hosting is based on our legitimate interest in a secure and efficient
          provision of the portal (Art. 6(1)(f) GDPR) and a data processing
          agreement.
        </p>

        <h2>Data we process</h2>
        <p>
          <strong>Account:</strong> To use the portal you need a user account.
          We process your name, email address and password (stored exclusively
          as a cryptographic hash); if you enable two-factor authentication,
          additionally the TOTP secret. Legal basis: performance of the user
          contract (Art. 6(1)(b) GDPR).
        </p>
        <p>
          <strong>Learning data &amp; certificates:</strong> enrollments, watch
          progress, exam attempts and results as well as issued certificates,
          in order to provide the courses and issue certificates
          (Art. 6(1)(b) GDPR).
        </p>
        <p>
          <strong>Server log files:</strong> browser type/version, operating
          system, referrer URL, host name, time of request and IP address, for
          the technically error-free provision of the portal (Art. 6(1)(f)
          GDPR).
        </p>
        <p>
          <strong>Cookies:</strong> technically necessary cookies only
          (sign-in session, your cookie choice, language). No advertising
          cookies. With your consent, a reach-measurement service may
          additionally be used (Art. 6(1)(a) GDPR and § 25(1) TDDDG); you can
          revoke your consent at any time in the cookie settings.
        </p>

        <h2>Email dispatch</h2>
        <p>
          For transactional emails (e.g. registration confirmation, password
          reset, certificates) a dispatch service provider is used on the
          controller&apos;s behalf. Any transfer to third countries is
          safeguarded by standard contractual clauses.
        </p>

        <h2>Your rights</h2>
        <p>
          You have the right to information, rectification, erasure,
          restriction of processing, data portability and to object. You can
          exercise these rights at any time using the contact details of the
          controller above. You also have the right to lodge a complaint with a
          competent data protection supervisory authority.
        </p>

        <h2>Storage period</h2>
        <p>
          Your account data is stored until you delete your account. Issued
          certificates are retained so that their authenticity can be verified
          via the serial number. Statutory retention obligations remain
          unaffected.
        </p>
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Datenschutzerklärung</h1>

      <h2>Verantwortlicher</h2>
      <p>
        {du(
          "Verantwortlicher für die Verarbeitung deiner Daten in diesem Portal ist:",
          "Verantwortlicher für die Verarbeitung Ihrer Daten in diesem Portal ist:"
        )}
      </p>
      <AddressBlock legal={legal} />
      <p>
        E-Mail: <a href={`mailto:${legal.email}`}>{legal.email}</a>
        {legal.phone ? (
          <>
            <br />
            Telefon: {legal.phone}
          </>
        ) : null}
      </p>
      <p>
        Dieses Lern-Portal wird über einen technischen Dienstleister
        bereitgestellt, der personenbezogene Daten ausschließlich
        weisungsgebunden im Auftrag des Verantwortlichen verarbeitet
        (Auftragsverarbeitung nach Art. 28 DSGVO). Ein entsprechender
        Auftragsverarbeitungsvertrag liegt vor.
      </p>

      <h2>Hosting</h2>
      <p>
        Das Portal wird auf den Servern eines professionellen Hosters innerhalb
        der EU betrieben (Rechenzentrum in Frankfurt am Main). Das Hosting
        erfolgt im berechtigten Interesse an einer sicheren und effizienten
        Bereitstellung des Portals (Art. 6 Abs. 1 lit. f DSGVO) sowie auf
        Grundlage eines Auftragsverarbeitungsvertrags.
      </p>

      <h2>Welche Daten wir verarbeiten</h2>
      <p>
        <strong>Konto:</strong>{" "}
        {du(
          "Für die Nutzung des Portals benötigst du ein Nutzerkonto. Wir verarbeiten deinen Namen, deine E-Mail-Adresse und dein Passwort (ausschließlich als kryptografischer Hash gespeichert); aktivierst du die Zwei-Faktor-Authentifizierung, zusätzlich das TOTP-Geheimnis.",
          "Für die Nutzung des Portals benötigen Sie ein Nutzerkonto. Wir verarbeiten Ihren Namen, Ihre E-Mail-Adresse und Ihr Passwort (ausschließlich als kryptografischer Hash gespeichert); aktivieren Sie die Zwei-Faktor-Authentifizierung, zusätzlich das TOTP-Geheimnis."
        )}{" "}
        Rechtsgrundlage: Durchführung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b
        DSGVO).
      </p>
      <p>
        <strong>Lerndaten &amp; Zertifikate:</strong> Einschreibungen,
        Sehfortschritt, Prüfungsversuche und -ergebnisse sowie ausgestellte
        Zertifikate, um die Kurse bereitzustellen und Zertifikate auszustellen
        (Art. 6 Abs. 1 lit. b DSGVO).
      </p>
      <p>
        <strong>Server-Log-Dateien:</strong> Browsertyp/-version,
        Betriebssystem, Referrer-URL, Hostname, Uhrzeit der Anfrage und
        IP-Adresse, zur technisch fehlerfreien Bereitstellung des Portals
        (Art. 6 Abs. 1 lit. f DSGVO).
      </p>
      <p>
        <strong>Cookies:</strong>{" "}
        {du(
          "ausschließlich technisch notwendige Cookies (Anmelde-Session, deine Cookie-Auswahl, Spracheinstellung). Keine Werbe-Cookies. Mit deiner Einwilligung kann zusätzlich ein Dienst zur Reichweitenmessung eingesetzt werden (Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG); die Einwilligung kannst du jederzeit in den Cookie-Einstellungen widerrufen.",
          "ausschließlich technisch notwendige Cookies (Anmelde-Session, Ihre Cookie-Auswahl, Spracheinstellung). Keine Werbe-Cookies. Mit Ihrer Einwilligung kann zusätzlich ein Dienst zur Reichweitenmessung eingesetzt werden (Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG); die Einwilligung können Sie jederzeit in den Cookie-Einstellungen widerrufen."
        )}
      </p>

      <h2>E-Mail-Versand</h2>
      <p>
        Für Transaktionsmails (z. B. Registrierungsbestätigung,
        Passwort-Zurücksetzen, Zertifikate) wird im Auftrag des
        Verantwortlichen ein Versanddienstleister eingesetzt. Eine etwaige
        Übermittlung in Drittländer ist durch Standardvertragsklauseln
        abgesichert.
      </p>

      <h2>{du("Deine Rechte", "Ihre Rechte")}</h2>
      <p>
        {du(
          "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie ein Widerspruchsrecht. Diese Rechte kannst du jederzeit über die oben genannten Kontaktdaten des Verantwortlichen ausüben. Außerdem steht dir ein Beschwerderecht bei einer zuständigen Datenschutz-Aufsichtsbehörde zu.",
          "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie ein Widerspruchsrecht. Diese Rechte können Sie jederzeit über die oben genannten Kontaktdaten des Verantwortlichen ausüben. Außerdem steht Ihnen ein Beschwerderecht bei einer zuständigen Datenschutz-Aufsichtsbehörde zu."
        )}
      </p>

      <h2>Speicherdauer</h2>
      <p>
        {du(
          "Deine Kontodaten speichern wir, bis du dein Konto löschst.",
          "Ihre Kontodaten speichern wir, bis Sie Ihr Konto löschen."
        )}{" "}
        Ausgestellte Zertifikate bewahren wir auf, damit ihre Echtheit über die
        Seriennummer geprüft werden kann. Zwingende gesetzliche
        Aufbewahrungspflichten bleiben unberührt.
      </p>
    </LegalArticle>
  );
}

/* ------------------------------------------------------- Barrierefreiheit */

export function TenantAccessibility({
  brandName,
  formal,
  locale,
}: {
  brandName: string;
  /** Sie-Anrede (deutsche Portal-Texte auf FORMAL) */
  formal: boolean;
  locale: string;
}) {
  if (locale === "en") {
    return (
      <LegalArticle>
        <h1>Accessibility Statement</h1>
        <p>
          {brandName} aims to be usable by everyone. This portal is designed to
          conform to WCAG 2.2 level AA.
        </p>
        <h2>Measures</h2>
        <ul>
          <li>
            Full keyboard operability, including a skip link and visible focus
            indicators
          </li>
          <li>
            Semantic HTML, labelled form fields and ARIA live regions for
            feedback
          </li>
          <li>Color contrast of at least 4.5:1 for text in the design</li>
          <li>
            Support for <em>prefers-reduced-motion</em>: animations are reduced
            or disabled
          </li>
          <li>Responsive layout from 320px viewport width, zoomable up to 200%</li>
          <li>Video lessons support captions where provided</li>
        </ul>
        <h2>Known limitations</h2>
        <ul>
          <li>
            Accessibility of course materials (videos, files) depends on the
            respective provider.
          </li>
        </ul>
        <h2>Feedback</h2>
        <p>
          If you encounter barriers, please use the form below — we take every
          report seriously.
        </p>
        <AccessibilityFeedbackForm />
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Erklärung zur Barrierefreiheit</h1>
      <p>
        {brandName} soll für alle nutzbar sein. Dieses Portal ist auf
        Konformität mit WCAG 2.2, Stufe AA, ausgelegt.
      </p>
      <h2>Unsere Maßnahmen</h2>
      <ul>
        <li>
          Vollständige Tastaturbedienbarkeit inkl. Sprunglink und sichtbarer
          Fokus-Markierung
        </li>
        <li>
          Semantisches HTML, beschriftete Formularfelder und ARIA-Live-Regionen
          für Rückmeldungen
        </li>
        <li>Farbkontraste von mindestens 4,5:1 für Text im Design</li>
        <li>
          Unterstützung von <em>prefers-reduced-motion</em>: Animationen werden
          reduziert oder abgeschaltet
        </li>
        <li>Responsives Layout ab 320px Viewport-Breite, zoombar bis 200 %</li>
        <li>Video-Lektionen unterstützen Untertitel, sofern bereitgestellt</li>
      </ul>
      <h2>Bekannte Einschränkungen</h2>
      <ul>
        <li>
          Die Barrierefreiheit der Kursmaterialien (Videos, Dateien) hängt vom
          jeweiligen Anbieter ab.
        </li>
      </ul>
      <h2>Feedback</h2>
      <p>
        {formal
          ? "Wenn Sie auf Barrieren stoßen, nutzen Sie bitte das folgende Formular – wir nehmen jede Meldung ernst."
          : "Wenn du auf Barrieren stößt, nutze bitte das folgende Formular – wir nehmen jede Meldung ernst."}
      </p>
      <AccessibilityFeedbackForm />
    </LegalArticle>
  );
}
