import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ProgramGate } from "@/components/onboarding/ProgramGate";

/**
 * LearnSphere Business ist initial gesperrt: Ohne akzeptierte
 * Business-Bedingungen (businessJoinedAt) zeigt jede /business-Route die
 * Fullscreen-Freischaltung statt des Inhalts.
 */
export default async function BusinessLayout({
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
    select: { businessJoinedAt: true },
  });
  if (!user?.businessJoinedAt) {
    return <ProgramGate program="business" />;
  }

  return children;
}
