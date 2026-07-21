"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  parseConsent,
} from "@/lib/consent";

/**
 * Google Analytics 4 – DSGVO-konform: Das gtag-Script wird ERST geladen,
 * wenn die Analyse-Einwilligung vorliegt (vorher keinerlei GA-Cookies oder
 * Requests). Consent Mode meldet die Zustimmung explizit; Werbe-Signale
 * bleiben dauerhaft verweigert, IP-Anonymisierung ist aktiv.
 */
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const read = () => {
      const consent = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
       
      setAllowed(Boolean(consent?.analytics));
    };
    read();
    window.addEventListener(CONSENT_CHANGED_EVENT, read);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, read);
  }, []);

  if (!gaId || !allowed) return null;

  return (
    <>
      <Script
        id="ga-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'granted'
            });
            gtag('js', new Date());
            gtag('config', ${JSON.stringify(gaId)}, { anonymize_ip: true });
          `,
        }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
        strategy="afterInteractive"
      />
    </>
  );
}
