import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminWorkspacesView } from "@/components/admin/AdminWorkspacesView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminWorkspaces" });
  return { title: t("title") };
}

export default async function AdminWorkspacesPage() {
  const workspaces = await db.businessWorkspace.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      brandName: true,
      customDomain: true,
      domainVerifiedAt: true,
      status: true,
      createdAt: true,
      owner: { select: { email: true } },
    },
  });

  return (
    <AdminWorkspacesView
      workspaces={workspaces.map((w) => ({
        id: w.id,
        slug: w.slug,
        brandName: w.brandName,
        customDomain: w.customDomain,
        domainVerified: w.domainVerifiedAt !== null,
        status: w.status,
        ownerEmail: w.owner.email,
        createdAt: w.createdAt.toISOString(),
      }))}
    />
  );
}
