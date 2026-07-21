"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { PrimaryButton } from "@/components/ui/primitives";

const Frame = styled.div`
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
  background: #000;

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
`;

/* ---------- DSGVO: Twoclick-Consent, bevor YouTube geladen wird ---------- */

const CONSENT_KEY = "ls-youtube-consent";
const consentListeners = new Set<() => void>();

function readStoredConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function storeConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    // Speichern optional – Consent gilt dann nur für diese Sitzung
  }
  for (const listener of consentListeners) listener();
}

function subscribeConsent(listener: () => void): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

const getConsentServerSnapshot = () => false;

const ConsentShell = styled.div`
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  text-align: center;
  padding: 1.25rem;
  background:
    radial-gradient(ellipse 120% 160% at 50% 0%, rgba(139, 124, 255, 0.12), transparent 60%),
    ${({ theme }) => theme.colors.bgElevated};

  @media (max-width: 519px) {
    /* auf sehr schmalen Screens braucht der Text mehr Platz als 16:9 hergibt */
    aspect-ratio: auto;
    min-height: 220px;
  }
`;

const ConsentBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};

  svg {
    width: 26px;
    height: 26px;
  }
`;

const ConsentTitle = styled.p`
  font-weight: 600;
  font-size: 1.02rem;
`;

const ConsentText = styled.p`
  max-width: 46ch;
  font-size: 0.85rem;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ConsentRemember = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;

  input {
    accent-color: ${({ theme }) => theme.colors.accent};
    width: 16px;
    height: 16px;
  }
`;

const ConsentPrivacyLink = styled(Link)`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textFaint};
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const YouTubeGlyph = (
  <svg viewBox="0 0 28 20" fill="none" aria-hidden>
    <rect width="28" height="20" rx="5" fill="#FF0033" />
    <path d="M11.5 5.5 19 10l-7.5 4.5v-9z" fill="#fff" />
  </svg>
);

/* Minimale Typen für die YouTube IFrame API */
interface YTPlayer {
  getCurrentTime(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number>;
      events?: {
        onStateChange?: (event: { data: number; target: YTPlayer }) => void;
      };
    }
  ) => YTPlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  /** gemerkte Abspielposition: dort fortsetzen (0 = regulär von vorn) */
  startAt?: number;
  /** Wird während der Wiedergabe jede Sekunde mit der aktuellen Position aufgerufen. */
  onTime: (seconds: number) => void;
  onPause: (seconds: number) => void;
  onEnded: () => void;
}

export function YouTubePlayer({
  videoId,
  title,
  startAt = 0,
  onTime,
  onPause,
  onEnded,
}: YouTubePlayerProps) {
  const t = useTranslations("learn");
  const mountRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onTime, onPause, onEnded });
  // Einstiegs-Sekunde nur bei der Player-Erstellung anwenden (kein Remount)
  const startAtRef = useRef(startAt);

  // DSGVO: erst nach Einwilligung eine Verbindung zu YouTube aufbauen.
  // Gespeicherte Einwilligung (localStorage) gilt für alle Videos; sonst
  // nur für diese Sitzung/dieses Video.
  const storedConsent = useSyncExternalStore(
    subscribeConsent,
    readStoredConsent,
    getConsentServerSnapshot
  );
  const [sessionConsent, setSessionConsent] = useState(false);
  const [remember, setRemember] = useState(true);
  const allowed = storedConsent || sessionConsent;

  useEffect(() => {
    callbacksRef.current = { onTime, onPause, onEnded };
  });

  useEffect(() => {
    if (!allowed) return;
    let player: YTPlayer | null = null;
    let interval: number | null = null;
    let cancelled = false;

    const mount = mountRef.current;
    if (!mount) return;

    // Die API ersetzt das übergebene Element – daher ein Wegwerf-Kind mounten
    const target = document.createElement("div");
    mount.appendChild(target);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(target, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          // gemerkte Position: YouTube unterstützt den Einstiegspunkt nativ
          ...(startAtRef.current > 0
            ? { start: Math.floor(startAtRef.current) }
            : {}),
        },
        events: {
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING && interval === null) {
              interval = window.setInterval(() => {
                callbacksRef.current.onTime(event.target.getCurrentTime());
              }, 1000);
            }
            if (event.data !== YT.PlayerState.PLAYING && interval !== null) {
              window.clearInterval(interval);
              interval = null;
            }
            if (event.data === YT.PlayerState.PAUSED) {
              callbacksRef.current.onPause(event.target.getCurrentTime());
            }
            if (event.data === YT.PlayerState.ENDED) {
              callbacksRef.current.onEnded();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
      player?.destroy();
      mount.replaceChildren();
    };
  }, [videoId, allowed]);

  if (!allowed) {
    return (
      <ConsentShell role="region" aria-label={title}>
        <ConsentBadge>
          {YouTubeGlyph}
          YouTube
        </ConsentBadge>
        <ConsentTitle>{t("ytConsentTitle")}</ConsentTitle>
        <ConsentText>{t("ytConsentText")}</ConsentText>
        <ConsentRemember>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          {t("ytConsentRemember")}
        </ConsentRemember>
        <PrimaryButton
          type="button"
          onClick={() => {
            if (remember) storeConsent();
            setSessionConsent(true);
          }}
        >
          ▶ {t("ytConsentLoad")}
        </PrimaryButton>
        <ConsentPrivacyLink href="/privacy">
          {t("ytConsentPrivacy")}
        </ConsentPrivacyLink>
      </ConsentShell>
    );
  }

  return <Frame ref={mountRef} role="region" aria-label={title} />;
}
