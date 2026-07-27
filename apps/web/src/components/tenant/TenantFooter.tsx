"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { OPEN_CONSENT_SETTINGS_EVENT } from "@/lib/consent";

/**
 * Minimaler Portal-Footer: bewusst ohne LearnSphere-Verweise, aber mit den
 * Rechtstexten des Betreibers (Impressum/Datenschutz – mandantenspezifisch
 * gerendert). Cookie-Einstellungen bleiben erreichbar.
 */
const Wrap = styled.footer`
  margin-top: 6rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgDeep};
`;

const Inner = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  padding: 2rem 20px;
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 0.82rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding-inline: 32px;
  }
`;

const Links = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;

  a,
  button {
    color: ${({ theme }) => theme.colors.textMuted};
    text-decoration: none;
    font-size: 0.82rem;
  }

  a:hover,
  button:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

export function TenantFooter({ brandName }: { brandName: string }) {
  const t = useTranslations("footer");
  return (
    <Wrap>
      <Inner>
        <span>
          © {new Date().getFullYear()} {brandName}
        </span>
        <Links aria-label={brandName}>
          <Link href="/imprint">{t("imprint")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent(OPEN_CONSENT_SETTINGS_EVENT))
            }
          >
            {t("cookieSettings")}
          </button>
        </Links>
      </Inner>
    </Wrap>
  );
}
