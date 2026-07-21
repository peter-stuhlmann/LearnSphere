import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { sectionExamResults } from "@elearning/core/certificate/verification";
import { parseCurriculumSnapshot } from "@elearning/core/certificate/curriculum";
import { VerifyView } from "@/components/verify/VerifyView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verify" });
  // Empfängername gehört nicht in den Titel (Suchmaschinen-Snippets)
  return { title: t("title"), robots: { index: false } };
}

/**
 * Öffentliche Verifikations-Landingpage: bestätigt die Echtheit eines
 * Zertifikats anhand der Seriennummer – bewusst ohne Login erreichbar
 * (z. B. für Arbeitgeber, die einen LinkedIn-Eintrag prüfen).
 */
export default async function VerifySerialPage({
  params,
}: {
  params: Promise<{ locale: string; serial: string }>;
}) {
  const { serial: rawSerial } = await params;
  const serial = decodeURIComponent(rawSerial).trim().toUpperCase();

  const certificate = await db.certificate.findUnique({
    where: { serial },
    include: {
      enrollment: {
        include: {
          user: { select: { name: true } },
          quizAttempts: {
            select: {
              quizId: true,
              scorePercent: true,
              passed: true,
              createdAt: true,
            },
          },
          course: {
            select: {
              title: true,
              creator: { select: { name: true } },
              sections: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  order: true,
                  lessons: {
                    orderBy: { order: "asc" },
                    select: { title: true },
                  },
                },
              },
              quizzes: {
                select: {
                  id: true,
                  title: true,
                  kind: true,
                  passPercent: true,
                  section: { select: { order: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!certificate) {
    return <VerifyView serial={serial} result={null} />;
  }

  const course = certificate.enrollment.course;
  // Zwischenprüfungen in Abschnitts-Reihenfolge
  const orderedQuizzes = [...course.quizzes].sort(
    (a, b) => (a.section?.order ?? 0) - (b.section?.order ?? 0)
  );
  const exams = sectionExamResults(
    orderedQuizzes,
    certificate.enrollment.quizAttempts
  );

  // Eingefrorener Kursinhalt vom Ausstellungszeitpunkt; nur Alt-Zertifikate
  // (ohne Snapshot) fallen auf den aktuellen Kursstand zurück
  const snapshot = parseCurriculumSnapshot(certificate.curriculum);

  return (
    <VerifyView
      serial={certificate.serial}
      result={{
        recipientName: certificate.enrollment.user.name ?? "—",
        courseTitle: course.title,
        creatorName: course.creator.name ?? "LearnSphere",
        scorePercent: certificate.scorePercent,
        issuedAt: certificate.issuedAt.toISOString(),
        curriculumFrozen: snapshot !== null,
        sections:
          snapshot ??
          course.sections.map((section) => ({
            title: section.title,
            lessons: section.lessons.map((lesson) => lesson.title),
          })),
        exams: exams.map((exam) => ({
          title: exam.title,
          passPercent: exam.passPercent,
          bestScorePercent: exam.bestScorePercent,
          passedAt: exam.passedAt ? exam.passedAt.toISOString() : null,
          passed: exam.passed,
        })),
      }}
    />
  );
}
