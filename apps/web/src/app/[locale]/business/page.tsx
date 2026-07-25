import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import { fulfillBusinessLicenseCheckout } from "@/lib/fulfillment";
import {
  getBusinessCourseOption,
  listLicenses,
} from "@/lib/services/business-service";
import { loadWorkspacePageData } from "@/lib/services/workspace-service";
import { BusinessView } from "@/components/business/BusinessView";
import { WorkspacePortalCard } from "@/components/business/WorkspacePortalCard";
import { Container } from "@/components/ui/primitives";

/**
 * /business – LearnSphere Business: Team-Lizenzen verwalten, Mitglieder
 * einladen, Fortschritt und Seats im Blick. Freischaltung: business/layout.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "business" });
  return { title: t("title") };
}

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; course?: string }>;
}) {
  // Auth-Guard übernimmt das Layout (inkl. Freischaltungs-Gate)
  const session = await auth();
  const { session_id, course: courseSlug } = await searchParams;

  // Rückkehr von Stripe: Lizenz sofort anlegen (idempotent – der Webhook
  // kann dasselbe bereits erledigt haben)
  if (session_id && isStripeEnabled()) {
    try {
      const checkout = await stripe().checkout.sessions.retrieve(session_id);
      if (
        checkout.metadata?.kind === "business_license" &&
        checkout.metadata.userId === session!.user.id
      ) {
        await fulfillBusinessLicenseCheckout(checkout);
      }
    } catch {
      // ungültige Session-ID → normale Ansicht
    }
  }

  // Direkteinstieg von der Kurs-Detailseite: Kurs vorauswählen und das
  // „Neue Lizenz“-Formular direkt geöffnet zeigen (kein erneutes Suchen).
  const [licenses, initialCourse, workspaceData] = await Promise.all([
    listLicenses(session!.user.id),
    courseSlug
      ? getBusinessCourseOption(session!.user.id, courseSlug)
      : Promise.resolve(null),
    loadWorkspacePageData(session!.user.id),
  ]);

  return (
    <>
      <BusinessView licenses={licenses} initialCourse={initialCourse} />
      <Container>
        <WorkspacePortalCard
          workspace={workspaceData.workspace}
          baseDomain={workspaceData.baseDomain}
          appHost={workspaceData.appHost}
        />
      </Container>
    </>
  );
}
