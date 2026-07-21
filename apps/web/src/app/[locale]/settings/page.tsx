import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasForeignEnrollments } from "@/app/actions/account-actions";
import { parseStoredHashes } from "@/lib/recovery-codes";
import { SettingsView } from "@/components/settings/SettingsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("title") };
}

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ termine?: string }>;
}) {
  const { locale } = await params;
  const { termine } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const [user, anonymize] = await Promise.all([
    db.user.findUnique({
      where: { id: session!.user.id },
      select: {
        totpEnabled: true,
        email: true,
        totpRecoveryCodes: true,
        bookingCalendarId: true,
        bookingApiKey: true,
      },
    }),
    // Creator mit Verkäufen wird anonymisiert statt gelöscht – der Dialog
    // zeigt die jeweils zutreffenden Folgen
    hasForeignEnrollments(session!.user.id),
  ]);

  return (
    <SettingsView
      totpEnabled={user?.totpEnabled ?? false}
      email={user?.email ?? ""}
      deletionMode={anonymize ? "anonymize" : "delete"}
      recoveryCodesLeft={parseStoredHashes(user?.totpRecoveryCodes).length}
      termineConnected={Boolean(
        user?.bookingCalendarId?.trim() && user?.bookingApiKey?.trim()
      )}
      termineResult={
        termine === "connected" || termine === "denied" || termine === "error"
          ? termine
          : null
      }
    />
  );
}
