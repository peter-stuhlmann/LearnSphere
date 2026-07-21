"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { NewsletterSignup } from "@/components/newsletter/NewsletterSignup";
import { OPEN_CONSENT_SETTINGS_EVENT } from "@/lib/consent";

const Wrap = styled.footer`
  margin-top: 6rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgDeep};
`;

const Inner = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  padding: 3rem 20px 2rem;
  display: grid;
  gap: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 2fr 1fr 1fr;
    padding-inline: 32px;
  }
`;

const Brand = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.4rem;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Tagline = styled.p`
  color: ${({ theme }) => theme.colors.textFaint};
  margin-top: 0.5rem;
  max-width: 32ch;
`;

const ColTitle = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-bottom: 0.9rem;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const FooterLink = styled(Link)`
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;
  font-size: 0.92rem;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

/* Öffnet den Cookie-Dialog erneut (Widerruf der Einwilligung) */
const FooterButton = styled.button`
  text-align: left;
  padding: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.92rem;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Copyright = styled.p`
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  padding: 1.5rem 20px 2rem;
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 0.82rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding-inline: 32px;
  }
`;

export function Footer() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");

  return (
    <Wrap>
      <NewsletterSignup />
      <Inner>
        <div>
          <Brand>
            Learn<em>Sphere</em>
          </Brand>
          <Tagline>{t("tagline")}</Tagline>
        </div>
        <nav aria-label={t("product")}>
          <ColTitle>{t("product")}</ColTitle>
          <List>
            <li>
              <FooterLink href="/courses">{tn("courses")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/pricing">{tn("pricing")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/api-docs">{t("apiDocs")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/verify">{t("verifyCertificate")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/affiliate">{t("affiliate")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/roadmap">{t("roadmap")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/register">{tn("register")}</FooterLink>
            </li>
          </List>
        </nav>
        <nav aria-label={t("legal")}>
          <ColTitle>{t("legal")}</ColTitle>
          <List>
            <li>
              <FooterLink href="/imprint">{t("imprint")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/privacy">{t("privacy")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/terms">{t("terms")}</FooterLink>
            </li>
            <li>
              <FooterLink href="/accessibility">
                {t("accessibility")}
              </FooterLink>
            </li>
            <li>
              <FooterButton
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(OPEN_CONSENT_SETTINGS_EVENT)
                  )
                }
              >
                {t("cookieSettings")}
              </FooterButton>
            </li>
          </List>
        </nav>
      </Inner>
      <Copyright>{t("copyright", { year: new Date().getFullYear() })}</Copyright>
    </Wrap>
  );
}
