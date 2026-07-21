import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseCertificateTheme } from "@elearning/core/certificate/theme";
import { CertificateDesigner } from "@/components/dashboard/CertificateDesigner";

export default async function CertificateDesignerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      creatorId: true,
      title: true,
      certificateTheme: true,
      creator: { select: { name: true } },
    },
  });
  if (!course || course.creatorId !== session!.user.id) {
    notFound();
  }

  return (
    <CertificateDesigner
      courseId={course.id}
      courseTitle={course.title}
      creatorName={course.creator.name ?? "LearnSphere"}
      initialTheme={parseCertificateTheme(course.certificateTheme)}
    />
  );
}
