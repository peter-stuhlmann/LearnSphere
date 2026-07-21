import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoadmapView } from "@/components/marketing/RoadmapView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roadmap" });
  return { title: t("kicker"), description: t("lead") };
}

export default function RoadmapPage() {
  return <RoadmapView />;
}
