import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseTags } from "@elearning/core/tags";
import { parseTranscriptCues } from "@elearning/core/blocks";
import { parseChapters } from "@elearning/core/chapters";
import { parseProvenance } from "@elearning/core/provenance";
import {
  parseBlockTranslations,
  parseCourseTranslations,
  parseExtraLanguages,
  parseTitleTranslations,
} from "@elearning/core/course-i18n";
import { CourseEditor } from "@/components/dashboard/CourseEditor";

export default async function CourseEditorPage({
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
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } },
          },
          quiz: { select: { id: true, title: true } },
        },
      },
      quizzes: {
        where: { kind: "FINAL" },
        select: { id: true, title: true },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course || course.creatorId !== session!.user.id) {
    notFound();
  }

  // termine.lol hängt am Creator-Konto – der Editor zeigt nur den Status
  const creatorBooking = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { bookingCalendarId: true, bookingApiKey: true },
  });

  // "Zuletzt geöffnet" für die Meine-Kurse-Sortierung stempeln – per Raw-SQL,
  // damit updatedAt (Sitemap-lastmod, "zuletzt bearbeitet") unberührt bleibt
  await db.$executeRaw`UPDATE \`Course\` SET \`lastOpenedAt\` = NOW(3) WHERE \`id\` = ${course.id}`;

  return (
    <CourseEditor
      creatorName={session!.user.name ?? "Creator"}
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle ?? "",
        description: course.description ?? "",
        language: course.language as "de" | "en",
        extraLanguages: parseExtraLanguages(
          course.extraLanguages,
          course.language
        ),
        translations: parseCourseTranslations(course.translations),
        priceCents: course.priceCents,
        published: course.published,
        listedInShop: course.listedInShop,
        waitlistEnabled: course.waitlistEnabled,
        enrollmentCount: course._count.enrollments,
        requiredWatchPercent: course.requiredWatchPercent,
        finalExamRequired: course.finalExamRequired,
        selfTestsEnabled: course.selfTestsEnabled,
        bookingEnabled: course.bookingEnabled,
        bookingConnected: Boolean(
          creatorBooking?.bookingCalendarId?.trim() &&
            creatorBooking?.bookingApiKey?.trim()
        ),
        category: course.category,
        tags: parseTags(course.tags),
        coverImage: course.coverImage,
        finalQuiz: course.quizzes[0] ?? null,
        sections: course.sections.map((s) => ({
          id: s.id,
          title: s.title,
          quiz: s.quiz,
          dripAfterDays: s.dripAfterDays,
          dripAfterQuiz: s.dripAfterQuiz,
          translations: parseTitleTranslations(s.translations),
          lessons: s.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            durationSeconds: l.durationSeconds,
            isPreview: l.isPreview,
            translations: parseTitleTranslations(l.translations),
            blocks: l.blocks.map((b) => ({
              type: b.type,
              title: b.title ?? "",
              url: b.url ?? "",
              fileName: b.fileName ?? "",
              content: b.content ?? "",
              css: b.css ?? "",
              durationSeconds: b.durationSeconds,
              transcriptDe: b.transcriptDe ?? "",
              transcriptEn: b.transcriptEn ?? "",
              transcriptCues: parseTranscriptCues(b.transcriptCues),
              poster: b.poster ?? "",
              chapters: parseChapters(b.chapters),
              provenance: parseProvenance(b.provenance),
              translations: parseBlockTranslations(b.translations),
            })),
          })),
        })),
      }}
    />
  );
}
