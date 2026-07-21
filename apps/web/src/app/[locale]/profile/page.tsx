import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ProfileView } from "@/components/profile/ProfileView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("title") };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    include: { billingAddress: true },
  });
  if (!user) {
    redirect({ href: "/login", locale });
  }

  return (
    <ProfileView
      profile={{
        name: user!.name ?? "",
        email: user!.email,
        image: user!.image,
        creatorBio: user!.creatorBio ?? "",
      }}
      billing={
        user!.billingAddress
          ? {
              firstName: user!.billingAddress.firstName,
              lastName: user!.billingAddress.lastName,
              street: user!.billingAddress.street,
              addressExtra: user!.billingAddress.addressExtra ?? "",
              zip: user!.billingAddress.zip,
              city: user!.billingAddress.city,
              country: user!.billingAddress.country,
              email: user!.billingAddress.email,
            }
          : null
      }
    />
  );
}
