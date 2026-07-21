"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Letzte Auffanglinie für Render-Fehler (ersetzt das Root-Layout, daher
 * bewusst ohne Theme/styled-components). Meldet den Fehler an Sentry,
 * sofern konfiguriert.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    } else {
      console.error(error);
    }
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0C15",
          color: "#EDEDF2",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <p style={{ fontSize: "2.5rem", margin: 0 }} aria-hidden>
            ✦
          </p>
          <h1 style={{ fontSize: "1.4rem", margin: "12px 0 8px" }}>
            Etwas ist schiefgelaufen
          </h1>
          <p style={{ color: "#A7A9BC", margin: "0 0 20px" }}>
            Der Fehler wurde gemeldet. Bitte versuch es erneut.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#C8FF4D",
              color: "#0B0C15",
              border: 0,
              borderRadius: 999,
              padding: "10px 24px",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
