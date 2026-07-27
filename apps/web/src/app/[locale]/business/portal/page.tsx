import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { loadWorkspacePageData } from "@/lib/services/workspace-service";
import { PortalStudio } from "@/components/business/PortalStudio";
import { Container, Kicker, Muted, SectionTitle } from "@/components/ui/primitives";

/**
 * /business/portal – Portal-Studio: das Whitelabel-Portal einrichten
 * (Subdomain, Marke, Farben mit Live-Vorschau, eigene Domain). Auth- und
 * Freischaltungs-Gate übernimmt das umschließende business/layout.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portalStudio" });
  return { title: t("title") };
}

export default async function BusinessPortalPage() {
  const session = await auth();
  const t = await getTranslations("portalStudio");

  const { workspace, baseDomain, appHost, portalProtocol, portalPort } =
    await loadWorkspacePageData(session!.user.id);

  return (
    <Container style={{ paddingBlock: "2.5rem 4rem" }}>
      <Link
        href="/business"
        style={{
          fontSize: "0.85rem",
          color: "var(--back-link, inherit)",
          textDecoration: "none",
        }}
      >
        ← {t("back")}
      </Link>
      <header style={{ margin: "0.75rem 0 2rem", maxWidth: "42rem" }}>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle>{t("title")}</SectionTitle>
        <Muted style={{ marginTop: "0.75rem" }}>{t("intro")}</Muted>
      </header>

      <PortalStudio
        workspace={workspace}
        baseDomain={baseDomain}
        appHost={appHost}
        portalProtocol={portalProtocol}
        portalPort={portalPort}
      />
    </Container>
  );
}
