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
        <p>
          <em>
            This English translation is provided for convenience only. The
            German version is legally binding.
          </em>
        </p>

        <h2>1. Privacy at a glance</h2>
        <h3>General information</h3>
        <p>
          The following notes provide a simple overview of what happens to
          your personal data when you visit LearnSphere. Personal data is any
          data by which you can be personally identified. For detailed
          information on data protection, please refer to the privacy policy
          below.
        </p>
        <h3>Data collection on this platform</h3>
        <p>
          <strong>
            Who is responsible for data collection on this platform?
          </strong>
        </p>
        <p>
          Data processing on this platform is carried out by the platform
          operator, whose contact details can be found in the imprint.
        </p>
        <p>
          <strong>How do we collect your data?</strong>
        </p>
        <p>
          On the one hand, your data is collected when you provide it to us —
          for example when you register an account, enroll in a course, take
          an exam or contact us by email. On the other hand, technical data
          (e.g. browser, operating system, time of page view) is collected
          automatically by our IT systems when you visit the platform.
        </p>
        <p>
          <strong>What do we use your data for?</strong>
        </p>
        <p>
          We use your data to operate the platform: providing courses,
          tracking your learning progress, grading exams and issuing
          certificates. Some technical data is collected to ensure
          error-free provision of the platform. With your consent, usage
          data may additionally be analyzed statistically (see “Analytics”).
        </p>
        <p>
          <strong>What rights do you have regarding your data?</strong>
        </p>
        <p>
          You have the right to receive information free of charge at any
          time about the origin, recipients and purpose of your stored
          personal data. You also have the right to request the
          rectification or erasure of this data. You can contact us at any
          time at the address given in the imprint regarding this and any
          other questions on data protection. You also have the right to
          lodge a complaint with the competent supervisory authority, and,
          under certain circumstances, to request the restriction of the
          processing of your personal data.
        </p>

        <h2>2. Hosting</h2>
        <p>
          This platform is hosted on servers of an external service
          provider (hoster). The personal data collected on this platform is
          stored on the hoster&apos;s servers. This may include IP addresses,
          account data, learning data, meta and communication data,
          contractual data, contact details, names, website accesses and
          other data generated via a website.
        </p>
        <p>
          Our hoster is Hostinger International Ltd.; the server is located
          in Frankfurt am Main, Germany (EU). Hosting is carried out for the
          purpose of fulfilling the contract with our potential and existing
          users (Art. 6(1)(b) GDPR) and in the interest of a secure, fast
          and efficient provision of our online offering by a professional
          provider (Art. 6(1)(f) GDPR). Our hoster will only process your
          data to the extent necessary to fulfil its service obligations and
          will follow our instructions with regard to this data. We have
          concluded a data processing agreement with our hoster to ensure
          GDPR-compliant processing.
        </p>

        <h2>3. General notes and mandatory information</h2>
        <h3>Data protection</h3>
        <p>
          The operator of this platform takes the protection of your
          personal data very seriously. We treat your personal data
          confidentially and in accordance with the statutory data
          protection regulations and this privacy policy. We point out that
          data transmission on the internet (e.g. communication by email)
          can have security gaps. Complete protection of data against access
          by third parties is not possible.
        </p>
        <h3>Controller</h3>
        <p>The controller for data processing on this platform is:</p>
        <address>
          Peter R. Stuhlmann
          <br />
          Martha-Arendsee-Str. 10
          <br />
          12681 Berlin, Germany
        </address>
        <p>
          Phone: +49 (0) 1578 5630944
          <br />
          Email:{" "}
          <a href="mailto:info@peter-stuhlmann.de">info@peter-stuhlmann.de</a>
        </p>
        <h3>Storage period</h3>
        <p>
          Unless a more specific storage period is stated in this privacy
          policy, your personal data remains with us until the purpose of
          processing no longer applies. Account data is stored until you
          delete your account. Issued certificates are retained so that
          their authenticity can be verified via the serial number.
          Statutory retention obligations (e.g. under tax and commercial
          law) remain unaffected.
        </p>
        <h3>Revocation of your consent to data processing</h3>
        <p>
          Many data processing operations are only possible with your
          express consent. You can revoke consent you have already given at
          any time — an informal notification by email is sufficient; for
          cookie consent, you can change your choice at any time in the
          cookie settings. The legality of the data processing carried out
          up to the revocation remains unaffected by the revocation.
        </p>
        <h3>
          Right to object to data collection in special cases and to direct
          marketing (Art. 21 GDPR)
        </h3>
        <p>
          <strong>
            If data processing is based on Art. 6(1)(e) or (f) GDPR, you
            have the right to object to the processing of your personal data
            at any time for reasons arising from your particular situation;
            this also applies to profiling based on these provisions. If you
            object, we will no longer process your personal data concerned
            unless we can demonstrate compelling legitimate grounds for the
            processing which override your interests, rights and freedoms,
            or the processing serves the establishment, exercise or defence
            of legal claims (objection pursuant to Art. 21(1) GDPR).
          </strong>
        </p>
        <p>
          <strong>
            If your personal data is processed for the purpose of direct
            marketing, you have the right to object at any time to the
            processing of personal data concerning you for the purpose of
            such marketing. If you object, your personal data will
            subsequently no longer be used for direct marketing (objection
            pursuant to Art. 21(2) GDPR).
          </strong>
        </p>
        <h3>Right to lodge a complaint with a supervisory authority</h3>
        <p>
          In the event of violations of the GDPR, data subjects have the
          right to lodge a complaint with a supervisory authority, in
          particular in the member state of their habitual residence, place
          of work or the place of the alleged violation. The right to lodge
          a complaint exists without prejudice to other administrative or
          judicial remedies.
        </p>
        <h3>Right to data portability</h3>
        <p>
          You have the right to have data that we process automatically on
          the basis of your consent or in fulfilment of a contract handed
          over to you or to a third party in a common, machine-readable
          format. If you request the direct transfer of the data to another
          controller, this will only be done to the extent technically
          feasible.
        </p>
        <h3>SSL/TLS encryption</h3>
        <p>
          For security reasons and to protect the transmission of
          confidential content, such as login data or inquiries you send to
          us as the platform operator, this site uses SSL/TLS encryption.
          You can recognize an encrypted connection by the fact that the
          address line of the browser changes from “http://” to “https://”
          and by the lock symbol in your browser line. When encryption is
          activated, the data you transmit to us cannot be read by third
          parties.
        </p>
        <h3>Information, erasure and rectification</h3>
        <p>
          Within the framework of the applicable legal provisions, you have
          the right at any time to free information about your stored
          personal data, its origin and recipients and the purpose of the
          data processing and, if applicable, a right to rectification or
          erasure of this data. You can contact us at any time at the
          address given in the imprint regarding this and any other
          questions on the subject of personal data.
        </p>
        <h3>Right to restriction of processing</h3>
        <p>
          You have the right to request the restriction of the processing
          of your personal data. You can contact us at any time at the
          address given in the imprint. The right to restriction of
          processing exists in the following cases:
        </p>
        <ul>
          <li>
            If you dispute the accuracy of your personal data stored by us,
            we usually need time to verify this. For the duration of the
            review, you have the right to request the restriction of the
            processing of your personal data.
          </li>
          <li>
            If the processing of your personal data happened/happens
            unlawfully, you can request the restriction of data processing
            instead of erasure.
          </li>
          <li>
            If we no longer need your personal data, but you need it to
            exercise, defend or assert legal claims, you have the right to
            request the restriction of the processing of your personal data
            instead of erasure.
          </li>
          <li>
            If you have lodged an objection pursuant to Art. 21(1) GDPR, a
            balancing of your and our interests must be carried out. As
            long as it has not yet been determined whose interests prevail,
            you have the right to request the restriction of the processing
            of your personal data.
          </li>
        </ul>
        <p>
          If you have restricted the processing of your personal data, this
          data may — apart from its storage — only be processed with your
          consent or for the establishment, exercise or defence of legal
          claims or for the protection of the rights of another natural or
          legal person or for reasons of an important public interest of
          the European Union or a member state.
        </p>

        <h2>4. Data collection on this platform</h2>
        <h3>Cookies</h3>
        <p>
          This platform uses cookies. Cookies are small text files and do
          not cause any damage to your device. They are stored either
          temporarily for the duration of a session (session cookies) or
          permanently (permanent cookies) on your device.
        </p>
        <p>
          Technically necessary cookies (session cookie for sign-in, your
          cookie consent choice, language preference) are stored on the
          basis of § 25(2) TDDDG and Art. 6(1)(f) GDPR — we have a
          legitimate interest in the technically error-free provision of
          our services. Analytics cookies (see “Analytics”) are only set
          with your consent on the basis of Art. 6(1)(a) GDPR and § 25(1)
          TDDDG. You can revoke your consent at any time in the cookie
          settings. No advertising cookies are used.
        </p>
        <h3>Server log files</h3>
        <p>
          The provider of the pages automatically collects and stores
          information in so-called server log files, which your browser
          automatically transmits to us. These are:
        </p>
        <ul>
          <li>Browser type and browser version</li>
          <li>Operating system used</li>
          <li>Referrer URL</li>
          <li>Host name of the accessing computer</li>
          <li>Time of the server request</li>
          <li>IP address</li>
        </ul>
        <p>
          This data is not merged with other data sources. The collection
          of this data is based on Art. 6(1)(f) GDPR. The platform operator
          has a legitimate interest in the technically error-free
          presentation and optimization of the platform — for this purpose,
          the server log files must be collected.
        </p>
        <h3>Registration and user account</h3>
        <p>
          To use LearnSphere you need a user account. When registering, we
          process your name, email address and password (stored exclusively
          as a cryptographic hash). If you optionally enable two-factor
          authentication, we additionally store the secret for your
          authenticator app (TOTP). Processing is carried out for the
          performance of the user contract (Art. 6(1)(b) GDPR). Account
          data is stored until you delete your account.
        </p>
        <h3>Learning data and certificates</h3>
        <p>
          When you use courses, we process your enrollments, watch
          progress, exam attempts and results as well as issued
          certificates. This data is required to provide the courses, check
          admission requirements for exams and issue certificates
          (Art. 6(1)(b) GDPR). Course creators see the learning progress
          and exam results of their participants, but never your password
          or security settings. Certificates contain a serial number by
          which their authenticity can be verified.
        </p>
        <h3>Inquiries by email or phone</h3>
        <p>
          If you contact us by email or phone, your inquiry including all
          resulting personal data (name, inquiry) will be stored and
          processed by us for the purpose of handling your request. We do
          not pass on this data without your consent. Processing is based
          on Art. 6(1)(b) GDPR if your inquiry is related to the
          fulfilment of a contract or is necessary for the implementation
          of pre-contractual measures. In all other cases, the processing
          is based on your consent (Art. 6(1)(a) GDPR) and/or on our
          legitimate interests (Art. 6(1)(f) GDPR) in the effective
          handling of inquiries addressed to us. The data you send to us
          via contact inquiries remains with us until you request erasure,
          revoke your consent to storage or the purpose for data storage no
          longer applies. Mandatory statutory provisions — in particular
          retention periods — remain unaffected.
        </p>

        <h2>5. Newsletter</h2>
        <p>
          If you subscribe to our newsletter, we use your email address to
          send it. Registration takes place using the double opt-in
          procedure: you will only receive the newsletter after you have
          confirmed your registration via a link sent by email. Processing
          is based on your consent (Art. 6(1)(a) GDPR). You can revoke
          your consent at any time via the unsubscribe link in every
          newsletter. After unsubscribing, your email address will no
          longer be used for the newsletter.
        </p>

        <h2>6. Analytics</h2>
        <h3>Google Analytics 4</h3>
        <p>
          With your consent, this platform uses Google Analytics 4, a web
          analytics service of Google Ireland Limited, Gordon House, Barrow
          Street, Dublin 4, Ireland. The analytics script is only loaded
          after you have given your consent in the cookie banner — before
          that, no Google Analytics cookies are set and no requests are
          sent to Google. IP anonymization is active; advertising signals
          (ad storage, ad personalization) are permanently denied via
          Google Consent Mode.
        </p>
        <p>
          The legal basis is your consent (Art. 6(1)(a) GDPR and § 25(1)
          TDDDG). You can revoke your consent at any time in the cookie
          settings. Data may be transferred to servers of Google LLC in the
          USA; Google is certified under the EU-US Data Privacy Framework.
        </p>

        <h2>7. Payment processing</h2>
        <h3>Stripe</h3>
        <p>
          For paid courses and creator payouts we use the payment service
          provider Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal
          Street Lower, Grand Canal Dock, Dublin, Ireland). When you
          purchase a course, your payment data (e.g. name, email address,
          payment method, amount) is processed by Stripe. We ourselves do
          not store complete credit card data. Processing is carried out
          for the performance of the contract (Art. 6(1)(b) GDPR). Details
          can be found in Stripe&apos;s privacy policy:{" "}
          <a href="https://stripe.com/privacy">stripe.com/privacy</a>.
        </p>
        <h3>Purchases via the mobile app</h3>
        <p>
          If you make purchases via our mobile app, payment is processed by
          the respective app store (e.g. Google Play Billing). In this
          case, the store operator&apos;s privacy policy applies to payment
          processing; we only receive a confirmation of the purchase, not
          your payment data.
        </p>

        <h2>8. Email dispatch</h2>
        <p>
          For sending transactional emails (e.g. registration
          confirmation, password reset, certificates, newsletter) we use
          the dispatch service Resend (Resend, Inc., USA) or an SMTP
          service provider. For this purpose, your email address and the
          content of the respective message are processed. Processing is
          carried out for the performance of the contract (Art. 6(1)(b)
          GDPR). Data processing agreements with standard contractual
          clauses safeguard any transfer to third countries.
        </p>

        <p>
          Source (template): <a href="https://www.e-recht24.de">eRecht24</a>
        </p>
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Datenschutzerklärung</h1>

      <h2>1. Datenschutz auf einen Blick</h2>
      <h3>Allgemeine Hinweise</h3>
      <p>
        Die folgenden Hinweise geben einen einfachen Überblick darüber, was
        mit deinen personenbezogenen Daten passiert, wenn du LearnSphere
        besuchst. Personenbezogene Daten sind alle Daten, mit denen du
        persönlich identifiziert werden kannst. Ausführliche Informationen
        zum Thema Datenschutz entnimmst du der unter diesem Text
        aufgeführten Datenschutzerklärung.
      </p>
      <h3>Datenerfassung auf dieser Plattform</h3>
      <p>
        <strong>
          Wer ist verantwortlich für die Datenerfassung auf dieser
          Plattform?
        </strong>
      </p>
      <p>
        Die Datenverarbeitung auf dieser Plattform erfolgt durch den
        Plattformbetreiber. Dessen Kontaktdaten kannst du dem Impressum
        dieser Website entnehmen.
      </p>
      <p>
        <strong>Wie erfassen wir deine Daten?</strong>
      </p>
      <p>
        Deine Daten werden zum einen dadurch erhoben, dass du sie uns
        mitteilst — etwa bei der Registrierung deines Kontos, beim
        Einschreiben in einen Kurs, beim Ablegen einer Prüfung oder wenn du
        uns per E-Mail kontaktierst. Andere Daten werden automatisch beim
        Besuch der Plattform durch unsere IT-Systeme erfasst. Das sind vor
        allem technische Daten (z. B. Internetbrowser, Betriebssystem oder
        Uhrzeit des Seitenaufrufs).
      </p>
      <p>
        <strong>Wofür nutzen wir deine Daten?</strong>
      </p>
      <p>
        Wir nutzen deine Daten für den Betrieb der Plattform: Bereitstellung
        der Kurse, Verfolgung deines Lernfortschritts, Bewertung von
        Prüfungen und Ausstellung von Zertifikaten. Ein Teil der technischen
        Daten wird erhoben, um eine fehlerfreie Bereitstellung der Plattform
        zu gewährleisten. Mit deiner Einwilligung können Nutzungsdaten
        zusätzlich statistisch ausgewertet werden (siehe „Analyse-Tools“).
      </p>
      <p>
        <strong>Welche Rechte hast du bezüglich deiner Daten?</strong>
      </p>
      <p>
        Du hast jederzeit das Recht, unentgeltlich Auskunft über Herkunft,
        Empfänger und Zweck deiner gespeicherten personenbezogenen Daten zu
        erhalten. Du hast außerdem ein Recht, die Berichtigung oder Löschung
        dieser Daten zu verlangen. Hierzu sowie zu weiteren Fragen zum Thema
        Datenschutz kannst du dich jederzeit unter der im Impressum
        angegebenen Adresse an uns wenden. Des Weiteren steht dir ein
        Beschwerderecht bei der zuständigen Aufsichtsbehörde zu. Außerdem
        hast du das Recht, unter bestimmten Umständen die Einschränkung der
        Verarbeitung deiner personenbezogenen Daten zu verlangen.
      </p>

      <h2>2. Hosting</h2>
      <p>
        Diese Plattform wird bei einem externen Dienstleister gehostet
        (Hoster). Die personenbezogenen Daten, die auf dieser Plattform
        erfasst werden, werden auf den Servern des Hosters gespeichert.
        Hierbei kann es sich v. a. um IP-Adressen, Kontodaten, Lerndaten,
        Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen,
        Webseitenzugriffe und sonstige Daten, die über eine Website
        generiert werden, handeln.
      </p>
      <p>
        Unser Hoster ist Hostinger International Ltd.; der Server steht in
        Frankfurt am Main (EU). Der Einsatz des Hosters erfolgt zum Zwecke
        der Vertragserfüllung gegenüber unseren potenziellen und bestehenden
        Nutzer:innen (Art. 6 Abs. 1 lit. b DSGVO) und im Interesse einer
        sicheren, schnellen und effizienten Bereitstellung unseres
        Online-Angebots durch einen professionellen Anbieter (Art. 6 Abs. 1
        lit. f DSGVO). Unser Hoster wird deine Daten nur insoweit
        verarbeiten, wie dies zur Erfüllung seiner Leistungspflichten
        erforderlich ist, und unsere Weisungen in Bezug auf diese Daten
        befolgen. Um die datenschutzkonforme Verarbeitung zu gewährleisten,
        haben wir einen Vertrag über Auftragsverarbeitung mit unserem Hoster
        geschlossen.
      </p>

      <h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>
      <h3>Datenschutz</h3>
      <p>
        Der Betreiber dieser Plattform nimmt den Schutz deiner persönlichen
        Daten sehr ernst. Wir behandeln deine personenbezogenen Daten
        vertraulich und entsprechend den gesetzlichen
        Datenschutzvorschriften sowie dieser Datenschutzerklärung. Wir
        weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei
        der Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein
        lückenloser Schutz der Daten vor dem Zugriff durch Dritte ist nicht
        möglich.
      </p>
      <h3>Hinweis zur verantwortlichen Stelle</h3>
      <p>
        Die verantwortliche Stelle für die Datenverarbeitung auf dieser
        Plattform ist:
      </p>
      <address>
        Peter R. Stuhlmann
        <br />
        Martha-Arendsee-Str. 10
        <br />
        12681 Berlin, Deutschland
      </address>
      <p>
        Telefon: +49 (0) 1578 5630944
        <br />
        E-Mail:{" "}
        <a href="mailto:info@peter-stuhlmann.de">info@peter-stuhlmann.de</a>
      </p>
      <p>
        Verantwortliche Stelle ist die natürliche oder juristische Person,
        die allein oder gemeinsam mit anderen über die Zwecke und Mittel der
        Verarbeitung von personenbezogenen Daten (z. B. Namen,
        E-Mail-Adressen o. Ä.) entscheidet.
      </p>
      <h3>Speicherdauer</h3>
      <p>
        Soweit innerhalb dieser Datenschutzerklärung keine speziellere
        Speicherdauer genannt wurde, verbleiben deine personenbezogenen
        Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt.
        Kontodaten speichern wir, bis du dein Konto löschst. Ausgestellte
        Zertifikate bewahren wir auf, damit ihre Echtheit über die
        Seriennummer geprüft werden kann. Zwingende gesetzliche
        Aufbewahrungspflichten (z. B. steuer- oder handelsrechtliche
        Fristen) bleiben unberührt.
      </p>
      <h3>Widerruf deiner Einwilligung zur Datenverarbeitung</h3>
      <p>
        Viele Datenverarbeitungsvorgänge sind nur mit deiner ausdrücklichen
        Einwilligung möglich. Du kannst eine bereits erteilte Einwilligung
        jederzeit widerrufen. Dazu reicht eine formlose Mitteilung per
        E-Mail an uns; Cookie-Einwilligungen kannst du jederzeit in den
        Cookie-Einstellungen ändern. Die Rechtmäßigkeit der bis zum Widerruf
        erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.
      </p>
      <h3>
        Widerspruchsrecht gegen die Datenerhebung in besonderen Fällen sowie
        gegen Direktwerbung (Art. 21 DSGVO)
      </h3>
      <p>
        <strong>
          Wenn die Datenverarbeitung auf Grundlage von Art. 6 Abs. 1 lit. e
          oder f DSGVO erfolgt, hast du jederzeit das Recht, aus Gründen,
          die sich aus deiner besonderen Situation ergeben, gegen die
          Verarbeitung deiner personenbezogenen Daten Widerspruch
          einzulegen; dies gilt auch für ein auf diese Bestimmungen
          gestütztes Profiling. Die jeweilige Rechtsgrundlage, auf der eine
          Verarbeitung beruht, entnimmst du dieser Datenschutzerklärung.
          Wenn du Widerspruch einlegst, werden wir deine betroffenen
          personenbezogenen Daten nicht mehr verarbeiten, es sei denn, wir
          können zwingende schutzwürdige Gründe für die Verarbeitung
          nachweisen, die deine Interessen, Rechte und Freiheiten
          überwiegen, oder die Verarbeitung dient der Geltendmachung,
          Ausübung oder Verteidigung von Rechtsansprüchen (Widerspruch nach
          Art. 21 Abs. 1 DSGVO).
        </strong>
      </p>
      <p>
        <strong>
          Werden deine personenbezogenen Daten verarbeitet, um
          Direktwerbung zu betreiben, so hast du das Recht, jederzeit
          Widerspruch gegen die Verarbeitung dich betreffender
          personenbezogener Daten zum Zwecke derartiger Werbung einzulegen;
          dies gilt auch für das Profiling, soweit es mit solcher
          Direktwerbung in Verbindung steht. Wenn du widersprichst, werden
          deine personenbezogenen Daten anschließend nicht mehr zum Zwecke
          der Direktwerbung verwendet (Widerspruch nach Art. 21 Abs. 2
          DSGVO).
        </strong>
      </p>
      <h3>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h3>
      <p>
        Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein
        Beschwerderecht bei einer Aufsichtsbehörde, insbesondere in dem
        Mitgliedstaat ihres gewöhnlichen Aufenthalts, ihres Arbeitsplatzes
        oder des Orts des mutmaßlichen Verstoßes zu. Das Beschwerderecht
        besteht unbeschadet anderweitiger verwaltungsrechtlicher oder
        gerichtlicher Rechtsbehelfe.
      </p>
      <h3>Recht auf Datenübertragbarkeit</h3>
      <p>
        Du hast das Recht, Daten, die wir auf Grundlage deiner Einwilligung
        oder in Erfüllung eines Vertrags automatisiert verarbeiten, an dich
        oder an einen Dritten in einem gängigen, maschinenlesbaren Format
        aushändigen zu lassen. Sofern du die direkte Übertragung der Daten
        an einen anderen Verantwortlichen verlangst, erfolgt dies nur,
        soweit es technisch machbar ist.
      </p>
      <h3>SSL- bzw. TLS-Verschlüsselung</h3>
      <p>
        Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der
        Übertragung vertraulicher Inhalte, wie zum Beispiel Anmeldedaten
        oder Anfragen, die du an uns als Seitenbetreiber sendest, eine SSL-
        bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennst du
        daran, dass die Adresszeile des Browsers von „http://“ auf
        „https://“ wechselt, und an dem Schloss-Symbol in deiner
        Browserzeile. Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist,
        können die Daten, die du an uns übermittelst, nicht von Dritten
        mitgelesen werden.
      </p>
      <h3>Auskunft, Löschung und Berichtigung</h3>
      <p>
        Du hast im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit
        das Recht auf unentgeltliche Auskunft über deine gespeicherten
        personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck
        der Datenverarbeitung und ggf. ein Recht auf Berichtigung oder
        Löschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema
        personenbezogene Daten kannst du dich jederzeit unter der im
        Impressum angegebenen Adresse an uns wenden.
      </p>
      <h3>Recht auf Einschränkung der Verarbeitung</h3>
      <p>
        Du hast das Recht, die Einschränkung der Verarbeitung deiner
        personenbezogenen Daten zu verlangen. Hierzu kannst du dich
        jederzeit unter der im Impressum angegebenen Adresse an uns wenden.
        Das Recht auf Einschränkung der Verarbeitung besteht in folgenden
        Fällen:
      </p>
      <ul>
        <li>
          Wenn du die Richtigkeit deiner bei uns gespeicherten
          personenbezogenen Daten bestreitest, benötigen wir in der Regel
          Zeit, um dies zu überprüfen. Für die Dauer der Prüfung hast du
          das Recht, die Einschränkung der Verarbeitung deiner
          personenbezogenen Daten zu verlangen.
        </li>
        <li>
          Wenn die Verarbeitung deiner personenbezogenen Daten unrechtmäßig
          geschah/geschieht, kannst du statt der Löschung die Einschränkung
          der Datenverarbeitung verlangen.
        </li>
        <li>
          Wenn wir deine personenbezogenen Daten nicht mehr benötigen, du
          sie jedoch zur Ausübung, Verteidigung oder Geltendmachung von
          Rechtsansprüchen benötigst, hast du das Recht, statt der Löschung
          die Einschränkung der Verarbeitung deiner personenbezogenen Daten
          zu verlangen.
        </li>
        <li>
          Wenn du einen Widerspruch nach Art. 21 Abs. 1 DSGVO eingelegt
          hast, muss eine Abwägung zwischen deinen und unseren Interessen
          vorgenommen werden. Solange noch nicht feststeht, wessen
          Interessen überwiegen, hast du das Recht, die Einschränkung der
          Verarbeitung deiner personenbezogenen Daten zu verlangen.
        </li>
      </ul>
      <p>
        Wenn du die Verarbeitung deiner personenbezogenen Daten
        eingeschränkt hast, dürfen diese Daten — von ihrer Speicherung
        abgesehen — nur mit deiner Einwilligung oder zur Geltendmachung,
        Ausübung oder Verteidigung von Rechtsansprüchen oder zum Schutz der
        Rechte einer anderen natürlichen oder juristischen Person oder aus
        Gründen eines wichtigen öffentlichen Interesses der Europäischen
        Union oder eines Mitgliedstaats verarbeitet werden.
      </p>

      <h2>4. Datenerfassung auf dieser Plattform</h2>
      <h3>Cookies</h3>
      <p>
        Diese Plattform verwendet Cookies. Cookies sind kleine Textdateien
        und richten auf deinem Endgerät keinen Schaden an. Sie werden
        entweder vorübergehend für die Dauer einer Sitzung
        (Session-Cookies) oder dauerhaft (permanente Cookies) auf deinem
        Endgerät gespeichert.
      </p>
      <p>
        Technisch notwendige Cookies (Session-Cookie für die Anmeldung,
        deine Cookie-Auswahl, Spracheinstellung) werden auf Grundlage von
        § 25 Abs. 2 TDDDG und Art. 6 Abs. 1 lit. f DSGVO gespeichert — wir
        haben ein berechtigtes Interesse an der technisch fehlerfreien
        Bereitstellung unserer Dienste. Analyse-Cookies (siehe
        „Analyse-Tools“) werden nur mit deiner Einwilligung auf Grundlage
        von Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG gesetzt. Deine
        Einwilligung kannst du jederzeit in den Cookie-Einstellungen
        widerrufen. Werbe-Cookies setzen wir nicht ein.
      </p>
      <h3>Server-Log-Dateien</h3>
      <p>
        Der Provider der Seiten erhebt und speichert automatisch
        Informationen in so genannten Server-Log-Dateien, die dein Browser
        automatisch an uns übermittelt. Dies sind:
      </p>
      <ul>
        <li>Browsertyp und Browserversion</li>
        <li>verwendetes Betriebssystem</li>
        <li>Referrer URL</li>
        <li>Hostname des zugreifenden Rechners</li>
        <li>Uhrzeit der Serveranfrage</li>
        <li>IP-Adresse</li>
      </ul>
      <p>
        Eine Zusammenführung dieser Daten mit anderen Datenquellen wird
        nicht vorgenommen. Die Erfassung dieser Daten erfolgt auf Grundlage
        von Art. 6 Abs. 1 lit. f DSGVO. Der Plattformbetreiber hat ein
        berechtigtes Interesse an der technisch fehlerfreien Darstellung
        und der Optimierung seiner Plattform — hierzu müssen die
        Server-Log-Files erfasst werden.
      </p>
      <h3>Registrierung und Nutzerkonto</h3>
      <p>
        Für die Nutzung von LearnSphere benötigst du ein Nutzerkonto. Bei
        der Registrierung verarbeiten wir deinen Namen, deine
        E-Mail-Adresse und dein Passwort (ausschließlich als
        kryptografischer Hash gespeichert). Aktivierst du optional die
        Zwei-Faktor-Authentifizierung, speichern wir zusätzlich das
        Geheimnis für deine Authenticator-App (TOTP). Die Verarbeitung
        erfolgt zur Durchführung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b
        DSGVO). Kontodaten speichern wir, bis du dein Konto löschst.
      </p>
      <h3>Lerndaten und Zertifikate</h3>
      <p>
        Wenn du Kurse nutzt, verarbeiten wir deine Einschreibungen, deinen
        Sehfortschritt, Prüfungsversuche und -ergebnisse sowie ausgestellte
        Zertifikate. Diese Daten sind erforderlich, um die Kurse
        bereitzustellen, Zulassungsvoraussetzungen für Prüfungen zu prüfen
        und Zertifikate auszustellen (Art. 6 Abs. 1 lit. b DSGVO).
        Kurs-Creator sehen den Lernfortschritt und die Prüfungsergebnisse
        ihrer Teilnehmer:innen, niemals aber dein Passwort oder deine
        Sicherheitseinstellungen. Zertifikate enthalten eine Seriennummer,
        über die ihre Echtheit geprüft werden kann.
      </p>
      <h3>Anfrage per E-Mail oder Telefon</h3>
      <p>
        Wenn du uns per E-Mail oder Telefon kontaktierst, wird deine
        Anfrage inklusive aller daraus hervorgehenden personenbezogenen
        Daten (Name, Anfrage) zum Zwecke der Bearbeitung deines Anliegens
        bei uns gespeichert und verarbeitet. Diese Daten geben wir nicht
        ohne deine Einwilligung weiter. Die Verarbeitung erfolgt auf
        Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern deine Anfrage mit
        der Erfüllung eines Vertrags zusammenhängt oder zur Durchführung
        vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen
        Fällen beruht die Verarbeitung auf deiner Einwilligung (Art. 6
        Abs. 1 lit. a DSGVO) und/oder auf unseren berechtigten Interessen
        (Art. 6 Abs. 1 lit. f DSGVO), da wir ein berechtigtes Interesse an
        der effektiven Bearbeitung der an uns gerichteten Anfragen haben.
        Die von dir an uns per Kontaktanfrage übersandten Daten verbleiben
        bei uns, bis du uns zur Löschung aufforderst, deine Einwilligung
        zur Speicherung widerrufst oder der Zweck für die Datenspeicherung
        entfällt (z. B. nach abgeschlossener Bearbeitung deines Anliegens).
        Zwingende gesetzliche Bestimmungen — insbesondere gesetzliche
        Aufbewahrungsfristen — bleiben unberührt.
      </p>

      <h2>5. Newsletter</h2>
      <p>
        Wenn du unseren Newsletter abonnierst, verwenden wir deine
        E-Mail-Adresse für den Versand. Die Anmeldung erfolgt im
        Double-Opt-in-Verfahren: Du erhältst den Newsletter erst, nachdem
        du deine Anmeldung über einen per E-Mail zugesandten Link bestätigt
        hast. Die Verarbeitung erfolgt auf Grundlage deiner Einwilligung
        (Art. 6 Abs. 1 lit. a DSGVO). Du kannst deine Einwilligung
        jederzeit über den Abmeldelink in jedem Newsletter widerrufen. Nach
        der Abmeldung wird deine E-Mail-Adresse nicht mehr für den
        Newsletter verwendet.
      </p>

      <h2>6. Analyse-Tools</h2>
      <h3>Google Analytics 4</h3>
      <p>
        Diese Plattform nutzt mit deiner Einwilligung Google Analytics 4,
        einen Webanalysedienst der Google Ireland Limited, Gordon House,
        Barrow Street, Dublin 4, Irland. Das Analyse-Script wird erst
        geladen, nachdem du im Cookie-Banner eingewilligt hast — vorher
        werden keine Google-Analytics-Cookies gesetzt und keine Anfragen an
        Google gesendet. Die IP-Anonymisierung ist aktiv; Werbe-Signale
        (Ad Storage, Ad-Personalisierung) sind über den Google Consent Mode
        dauerhaft verweigert.
      </p>
      <p>
        Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO
        und § 25 Abs. 1 TDDDG). Du kannst deine Einwilligung jederzeit in
        den Cookie-Einstellungen widerrufen. Daten können dabei an Server
        der Google LLC in die USA übertragen werden; Google ist unter dem
        EU-US Data Privacy Framework zertifiziert.
      </p>

      <h2>7. Zahlungsabwicklung</h2>
      <h3>Stripe</h3>
      <p>
        Für kostenpflichtige Kurse und Creator-Auszahlungen nutzen wir den
        Zahlungsdienstleister Stripe (Stripe Payments Europe, Ltd., 1 Grand
        Canal Street Lower, Grand Canal Dock, Dublin, Irland). Beim Kauf
        eines Kurses werden deine Zahlungsdaten (z. B. Name,
        E-Mail-Adresse, Zahlungsmittel, Betrag) durch Stripe verarbeitet.
        Vollständige Kreditkartendaten speichern wir selbst nicht. Die
        Verarbeitung erfolgt zur Vertragserfüllung (Art. 6 Abs. 1 lit. b
        DSGVO). Details findest du in der Datenschutzerklärung von Stripe:{" "}
        <a href="https://stripe.com/privacy">stripe.com/privacy</a>.
      </p>
      <h3>Käufe über die Mobile App</h3>
      <p>
        Kaufst du über unsere mobile App, wird die Zahlung über den
        jeweiligen App-Store abgewickelt (z. B. Google Play Billing). In
        diesem Fall gilt für die Zahlungsabwicklung die
        Datenschutzerklärung des Store-Betreibers; wir erhalten lediglich
        eine Bestätigung des Kaufs, nicht deine Zahlungsdaten.
      </p>

      <h2>8. E-Mail-Versand</h2>
      <p>
        Für den Versand von Transaktionsmails (z. B.
        Registrierungsbestätigung, Passwort-Zurücksetzen, Zertifikate,
        Newsletter) nutzen wir den Versanddienst Resend (Resend, Inc., USA)
        bzw. einen SMTP-Dienstleister. Dabei werden deine E-Mail-Adresse
        und der Inhalt der jeweiligen Nachricht verarbeitet. Die
        Verarbeitung erfolgt zur Vertragserfüllung (Art. 6 Abs. 1 lit. b
        DSGVO). Eine etwaige Übermittlung in Drittländer ist durch
        Auftragsverarbeitungsverträge mit Standardvertragsklauseln
        abgesichert.
      </p>

      <p>
        Quelle (Vorlage): <a href="https://www.e-recht24.de">eRecht24</a>
      </p>
    </LegalArticle>
  );
}
