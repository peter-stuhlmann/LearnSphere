import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ProgramGate } from "@/components/onboarding/ProgramGate";

/**
 * Creator-Studio ist initial gesperrt: Ohne akzeptierte Creator-AGB
 * (creatorJoinedAt) zeigt jede /creator-Route die Fullscreen-Freischaltung
 * statt des Inhalts. LearnSphere ist zuerst für Lernende da.
 */
export default async function CreatorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { creatorJoinedAt: true },
  });
  if (!user?.creatorJoinedAt) {
    return <ProgramGate program="creator" />;
  }

  return children;
}
