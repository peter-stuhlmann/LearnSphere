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

const Copy = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;

  img {
    height: 22px;
    width: auto;
    max-width: 130px;
    object-fit: contain;
    opacity: 0.85;
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

export function TenantFooter({
  brandName,
  logo,
}: {
  brandName: string;
  logo: string | null;
}) {
  const t = useTranslations("footer");
  return (
    <Wrap>
      <Inner>
        <Copy>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Logo
            <img src={logo} alt={brandName} />
          ) : null}
          <span>
            © {new Date().getFullYear()} {brandName}
          </span>
        </Copy>
        <Links aria-label={brandName}>
          <Link href="/imprint">{t("imprint")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
          <Link href="/accessibility">{t("accessibility")}</Link>
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
