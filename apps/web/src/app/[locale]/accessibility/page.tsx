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
  return { title: t("accessibilityTitle") };
}

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale === "en") {
    return (
      <LegalArticle>
        <h1>Accessibility Statement</h1>
        <p>
          LearnSphere aims to be usable by everyone. This platform is designed
          to conform to WCAG 2.2 level AA.
        </p>
        <h2>Measures we take</h2>
        <ul>
          <li>Full keyboard operability, including a skip link and visible focus indicators</li>
          <li>Semantic HTML, labelled form fields and ARIA live regions for feedback</li>
          <li>Color contrast of at least 4.5:1 for text on our dark theme</li>
          <li>Support for <em>prefers-reduced-motion</em>: animations and 3D effects are reduced or disabled</li>
          <li>Responsive layout from 320px viewport width, zoomable up to 200%</li>
          <li>Video lessons support captions where provided by course creators</li>
        </ul>
        <h2>Known limitations</h2>
        <ul>
          <li>The decorative 3D animation on the start page is hidden from assistive technology but may affect performance on very old devices.</li>
          <li>Accessibility of course materials (videos, files) depends on the respective creator.</li>
        </ul>
        <h2>Feedback</h2>
        <p>
          If you encounter barriers, please contact us at{" "}
          <a href="mailto:accessibility@learnsphere.one">
            accessibility@learnsphere.one
          </a>
          . We take every report seriously.
        </p>
      </LegalArticle>
    );
  }

  return (
    <LegalArticle>
      <h1>Erklärung zur Barrierefreiheit</h1>
      <p>
        LearnSphere soll für alle nutzbar sein. Diese Plattform ist auf
        Konformität mit WCAG 2.2, Stufe AA, ausgelegt.
      </p>
      <h2>Unsere Maßnahmen</h2>
      <ul>
        <li>Vollständige Tastaturbedienbarkeit inkl. Sprunglink und sichtbarer Fokus-Markierung</li>
        <li>Semantisches HTML, beschriftete Formularfelder und ARIA-Live-Regionen für Rückmeldungen</li>
        <li>Farbkontraste von mindestens 4,5:1 für Text auf unserem dunklen Design</li>
        <li>Unterstützung von <em>prefers-reduced-motion</em>: Animationen und 3D-Effekte werden reduziert oder abgeschaltet</li>
        <li>Responsives Layout ab 320px Viewport-Breite, zoombar bis 200 %</li>
        <li>Video-Lektionen unterstützen Untertitel, sofern vom Creator bereitgestellt</li>
      </ul>
      <h2>Bekannte Einschränkungen</h2>
      <ul>
        <li>Die dekorative 3D-Animation auf der Startseite ist für assistive Technologien verborgen, kann aber auf sehr alten Geräten die Performance beeinträchtigen.</li>
        <li>Die Barrierefreiheit der Kursmaterialien (Videos, Dateien) liegt in der Verantwortung der jeweiligen Creator.</li>
      </ul>
      <h2>Feedback</h2>
      <p>
        Wenn du auf Barrieren stößt, melde dich bitte unter{" "}
        <a href="mailto:accessibility@learnsphere.one">
          accessibility@learnsphere.one
        </a>
        . Wir nehmen jede Meldung ernst.
      </p>
    </LegalArticle>
  );
}
