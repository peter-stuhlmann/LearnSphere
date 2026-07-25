import { getTranslations } from "next-intl/server";

/**
 * Hinweis bei deaktiviertem JavaScript. Der Inhalt eines <noscript> greift nur,
 * wenn JS aus ist: dann wird der ohne JS nicht nutzbare Hauptinhalt (#main)
 * ausgeblendet und stattdessen diese Meldung gezeigt – Header und Footer
 * bleiben stehen. Die Meldung nutzt Inline-Styles (kein styled-components),
 * damit sie auch ohne Client-JS zuverlässig aussieht.
 */
export async function NoScriptNotice({ locale }: { locale: string }) {
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
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "#12141F",
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
              background: "rgba(200, 255, 77, 0.12)",
            }}
          >
            ⚡
          </div>
          <h1
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1.5rem",
              lineHeight: 1.25,
              color: "#EDEDF2",
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
              color: "#A7A9BC",
            }}
          >
            {t("noscriptText")}
          </p>
        </div>
      </div>
    </noscript>
  );
}
