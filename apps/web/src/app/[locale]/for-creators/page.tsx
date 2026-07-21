import { redirect } from "@/i18n/navigation";

/** /fuer-creator ist mit der Preisseite zusammengelegt. */
export default async function ForCreatorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/pricing", locale });
}
