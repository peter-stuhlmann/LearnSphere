import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Superadmin-Bereich: ohne Login geht es zur Anmeldung; eingeloggte Nutzer
 * ohne ADMIN-Rolle bekommen ein 404 (der Bereich soll für sie gar nicht
 * erkennbar existieren).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale: await getLocale() });
  }
  const user = await db.user.findUnique({
    where: { id: session!.user!.id! },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") notFound();

  return <AdminShell>{children}</AdminShell>;
}
