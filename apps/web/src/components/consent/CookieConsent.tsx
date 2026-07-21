"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styled, { keyframes } from "styled-components";
import { Link } from "@/i18n/navigation";
import { Modal } from "@/components/ui/Modal";
import { GhostButton, PrimaryButton } from "@/components/ui/primitives";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  OPEN_CONSENT_SETTINGS_EVENT,
  parseConsent,
  serializeConsent,
} from "@/lib/consent";

/* ---------- Banner ---------- */

const rise = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Banner = styled.section`
  position: fixed;
  z-index: 70;
  /* mobile first: volle Breite am unteren Rand */
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  padding: 1.1rem 1.2rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    linear-gradient(${({ theme }) => theme.colors.bgDeep}, ${({ theme }) =>
      theme.colors.bgDeep}) padding-box,
    linear-gradient(120deg, ${({ theme }) => theme.colors.violet}, ${({
      theme,
    }) => theme.colors.accent}) border-box;
  border: 1.5px solid transparent;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
  animation: ${rise} 260ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    left: auto;
    right: 24px;
    bottom: 24px;
    max-width: 400px;
  }
`;

const BannerTitle = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 0.4rem;

  span {
    color: ${({ theme }) => theme.colors.accent};
    margin-right: 0.4rem;
  }
`;

const BannerText = styled.p`
  font-size: 0.85rem;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 0.9rem;

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-underline-offset: 3px;
  }
`;

const BannerActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  /* Akzeptieren zuerst und prominent, Einstellungen dezent daneben */
  > button:first-child {
    flex: 1 1 auto;
  }
`;

/* ---------- Einstellungen ---------- */

const CategoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
`;

const CategoryRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 0.85rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
`;

const CategoryText = styled.div`
  flex: 1;

  strong {
    display: block;
    font-size: 0.92rem;
    margin-bottom: 0.2rem;
  }

  p {
    font-size: 0.8rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

/* Zugänglicher Schalter: echte Checkbox, visuell als Switch */
const SwitchLabel = styled.label<{ $disabled?: boolean }>`
  position: relative;
  flex-shrink: 0;
  width: 46px;
  height: 26px;
  margin-top: 0.1rem;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};

  input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: inherit;
  }

  span {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    /* rein dekorativ – Klicks gehen an die unsichtbare Checkbox darunter */
    pointer-events: none;
    background: ${({ theme }) => theme.colors.surfaceHover};
    border: 1px solid ${({ theme }) => theme.colors.borderStrong};
    transition: background 160ms ease, border-color 160ms ease;

    &::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${({ theme }) => theme.colors.textMuted};
      transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
        background 160ms ease;
    }
  }

  input:checked + span {
    background: ${({ theme }) => theme.colors.accentSoft};
    border-color: ${({ theme }) => theme.colors.accent};

    &::after {
      transform: translateX(20px);
      background: ${({ theme }) => theme.colors.accent};
    }
  }

  input:focus-visible + span {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  ${({ $disabled }) => ($disabled ? "opacity: 0.65;" : "")}
`;

const ModalActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  > button:last-child {
    flex: 1 1 auto;
  }
`;

function ConsentSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <SwitchLabel $disabled={disabled}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span aria-hidden />
    </SwitchLabel>
  );
}

/** Speichert die Entscheidung und benachrichtigt GA-Loader & Co. */
function persistConsent(analytics: boolean) {
  const previous = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    serializeConsent(analytics, new Date())
  );
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));

  // Widerruf: bereits geladenes Analytics lässt sich nur per Neuladen
  // entfernen; GA-Cookies dabei bestmöglich aufräumen
  if (previous?.analytics && !analytics) {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim() ?? "";
      if (name === "_ga" || name.startsWith("_ga_")) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${window.location.hostname}`;
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    }
    window.location.reload();
  }
}

/**
 * Cookie-Banner + Einstellungs-Dialog. Erscheint, solange keine (aktuelle)
 * Entscheidung vorliegt; über das Footer-Event lassen sich die Einstellungen
 * jederzeit wieder öffnen (Widerruf, DSGVO Art. 7 Abs. 3).
 */
export function CookieConsent() {
  const t = useTranslations("consent");
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  // Entscheidung erst nach der Hydration lesen (localStorage gibt es
  // serverseitig nicht)
  useEffect(() => {
    const consent = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!consent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach Hydration, bewusst
      setVisible(true);
    } else {
       
      setAnalytics(consent.analytics);
    }
  }, []);

  // Footer-Link "Cookie-Einstellungen" öffnet den Dialog jederzeit
  useEffect(() => {
    const open = () => {
      const consent = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
      setAnalytics(consent?.analytics ?? false);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_SETTINGS_EVENT, open);
  }, []);

  const acceptAll = useCallback(() => {
    persistConsent(true);
    setAnalytics(true);
    setVisible(false);
    setSettingsOpen(false);
  }, []);

  const saveSelection = useCallback(() => {
    persistConsent(analytics);
    setVisible(false);
    setSettingsOpen(false);
  }, [analytics]);

  return (
    <>
      {visible && !settingsOpen ? (
        <Banner aria-label={t("title")}>
          <BannerTitle>
            <span aria-hidden>✦</span>
            {t("title")}
          </BannerTitle>
          <BannerText>
            {t("description")}{" "}
            <Link href="/privacy">{t("privacyLink")}</Link>
          </BannerText>
          <BannerActions>
            <PrimaryButton type="button" onClick={acceptAll}>
              {t("acceptAll")}
            </PrimaryButton>
            <GhostButton type="button" onClick={() => setSettingsOpen(true)}>
              {t("settings")}
            </GhostButton>
          </BannerActions>
        </Banner>
      ) : null}

      <Modal
        open={settingsOpen}
        title={t("settingsTitle")}
        closeLabel={t("close")}
        onClose={() => setSettingsOpen(false)}
      >
        <BannerText>{t("settingsIntro")}</BannerText>
        <CategoryList>
          <CategoryRow>
            <CategoryText>
              <strong>{t("necessary")}</strong>
              <p>{t("necessaryDesc")}</p>
            </CategoryText>
            <ConsentSwitch checked disabled label={t("necessary")} />
          </CategoryRow>
          <CategoryRow>
            <CategoryText>
              <strong>{t("analytics")}</strong>
              <p>{t("analyticsDesc")}</p>
            </CategoryText>
            <ConsentSwitch
              checked={analytics}
              label={t("analytics")}
              onChange={setAnalytics}
            />
          </CategoryRow>
        </CategoryList>
        <ModalActions>
          <GhostButton type="button" onClick={saveSelection}>
            {t("saveSelection")}
          </GhostButton>
          <PrimaryButton type="button" onClick={acceptAll}>
            {t("acceptAll")}
          </PrimaryButton>
        </ModalActions>
      </Modal>
    </>
  );
}
