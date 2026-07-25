import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listCampaigns } from "@/lib/services/creator-email-service";
import { CreatorEmailsView } from "@/components/dashboard/CreatorEmailsView";

/**
 * /creator/emails – Mails an die eigenen Lernenden: Kursauswahl,
 * Template-Galerie, Rich-Text, Vorschau, Versand-Historie.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "creatorEmails" });
  return { title: t("title") };
}

export default async function CreatorEmailsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const [courses, campaigns, creator] = await Promise.all([
    db.course.findMany({
      where: { creatorId: session!.user.id, published: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        _count: { select: { enrollments: true } },
      },
    }),
    listCampaigns(session!.user.id),
    db.user.findUnique({
      where: { id: session!.user.id },
      select: { name: true, storefrontName: true },
    }),
  ]);

  return (
    <CreatorEmailsView
      creatorName={
        creator?.storefrontName ?? creator?.name ?? "LearnSphere Creator"
      }
      courses={courses.map((course) => ({
        id: course.id,
        title: course.title,
        enrolledCount: course._count.enrollments,
      }))}
      campaigns={campaigns}
    />
  );
}
