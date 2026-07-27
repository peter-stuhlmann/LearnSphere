import { getTranslations } from "next-intl/server";

/**
 * Hinweis bei deaktiviertem JavaScript. Der Inhalt eines <noscript> greift nur,
 * wenn JS aus ist: dann wird der ohne JS nicht nutzbare Hauptinhalt (#main)
 * ausgeblendet und stattdessen diese Meldung gezeigt – Header und Footer
 * bleiben stehen. Die Meldung nutzt Inline-Styles (kein styled-components),
 * damit sie auch ohne Client-JS zuverlässig aussieht – die Farben kommen aber
 * (serverseitig aufgelöst) aus dem aktiven Theme, damit die Box auch auf
 * Whitelabel-Portalen zum Farbschema passt.
 */
export async function NoScriptNotice({
  locale,
  brand,
  colors,
}: {
  locale: string;
  /** Marke des Portals (Whitelabel) bzw. „LearnSphere" auf der Hauptdomain. */
  brand: string;
  colors: {
    bgElevated: string;
    border: string;
    accentSoft: string;
    text: string;
    textMuted: string;
  };
}) {
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <noscript>
      <style
        // #main gehört zum interaktiven Hauptinhalt → ohne JS ausblenden
        dangerouslySetInnerHTML={{ __html: "#main{display:none!important}" }}
      />
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1rem",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: "34rem",
            width: "100%",
            textAlign: "center",
            padding: "2.5rem 1.75rem",
            borderRadius: "22px",
            border: `1px solid ${colors.border}`,
            background: colors.bgElevated,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              fontSize: "1.6rem",
              background: colors.accentSoft,
            }}
          >
            ⚡
          </div>
          <h1
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1.5rem",
              lineHeight: 1.25,
              color: colors.text,
              fontFamily: "var(--font-display), Georgia, serif",
            }}
          >
            {t("noscriptTitle")}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "1rem",
              lineHeight: 1.6,
              color: colors.textMuted,
            }}
          >
            {t("noscriptText", { brand })}
          </p>
        </div>
      </div>
    </noscript>
  );
}
