"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { withAlpha } from "@/lib/tenant-theme";
import { Badge, PrimaryButton } from "@/components/ui/primitives";

/**
 * Kompakte Karte auf /business, die zum Portal-Studio (/business/portal)
 * führt. Zeigt den aktuellen Portal-Status (Adresse/Domain) statt des
 * kompletten Editors – der lebt jetzt auf einer eigenen Unterseite.
 */
const Promo = styled.section`
  position: relative;
  margin-top: 1.5rem;
  padding: 1.75rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  background:
    radial-gradient(
      ellipse 70% 120% at 100% 0%,
      ${({ theme }) => withAlpha(theme.colors.violet, 0.16)},
      transparent
    ),
    ${({ theme }) => theme.colors.bgElevated};
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;

  h2 {
    font-size: 1.5rem;
    margin: 0;
  }
`;

const Lead = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.92rem;
  margin: 0.6rem 0 1.25rem;
  max-width: 46rem;
`;

const UrlLine = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.accent};
  word-break: break-all;
  margin: 0 0 1.25rem;
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

export function PortalPromoCard({
  hasWorkspace,
  slug,
  baseDomain,
  customDomain,
  domainVerified,
  portalProtocol,
  portalPort,
}: {
  hasWorkspace: boolean;
  slug: string | null;
  baseDomain: string;
  customDomain: string | null;
  domainVerified: boolean;
  portalProtocol: string;
  portalPort: string;
}) {
  const t = useTranslations("workspace");
  const ts = useTranslations("portalStudio");

  const portPart = portalPort ? `:${portalPort}` : "";
  // Verifizierte Kundendomain hat immer TLS; die Subdomain nutzt lokal
  // http + Dev-Port, damit der Link auch lokal funktioniert.
  const liveHost =
    customDomain && domainVerified
      ? customDomain
      : slug
        ? `${slug}.${baseDomain}${portPart}`
        : null;
  const liveHref =
    customDomain && domainVerified
      ? `https://${customDomain}`
      : slug
        ? `${portalProtocol}//${slug}.${baseDomain}${portPart}`
        : null;

  return (
    <Promo>
      <Head>
        <h2>{t("title")}</h2>
        {hasWorkspace ? (
          domainVerified ? (
            <Badge $tone="success">{t("verified")}</Badge>
          ) : (
            <Badge $tone="violet">{ts("statusLive")}</Badge>
          )
        ) : (
          <Badge $tone="muted">{ts("statusSetup")}</Badge>
        )}
      </Head>

      <Lead>{t("intro")}</Lead>

      {liveHost && liveHref ? (
        <UrlLine>
          {t("portalUrl")}:{" "}
          <a href={liveHref} target="_blank" rel="noreferrer">
            {liveHost}
          </a>
        </UrlLine>
      ) : null}

      <Buttons>
        <PrimaryButton as={Link} href="/business/portal">
          {hasWorkspace ? ts("edit") : ts("setup")}
        </PrimaryButton>
      </Buttons>
    </Promo>
  );
}
