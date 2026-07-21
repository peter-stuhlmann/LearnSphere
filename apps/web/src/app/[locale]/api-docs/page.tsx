import type { Metadata } from "next";
import { ApiDocsView } from "@/components/marketing/ApiDocsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "en" ? "API documentation" : "API-Dokumentation",
    description:
      locale === "en"
        ? "Public catalog API, affiliate API and creator API for LearnSphere."
        : "Öffentliche Katalog-API, Affiliate-API und Creator-API von LearnSphere.",
  };
}

export default function ApiDocsPage() {
  return <ApiDocsView />;
}
