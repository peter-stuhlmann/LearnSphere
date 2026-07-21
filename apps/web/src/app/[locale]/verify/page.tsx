import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VerifySearch } from "@/components/verify/VerifySearch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verify" });
  return { title: t("title"), description: t("intro") };
}

/** Öffentliche Zertifikatsprüfung – bewusst ohne Login erreichbar. */
export default function VerifyPage() {
  return <VerifySearch />;
}
