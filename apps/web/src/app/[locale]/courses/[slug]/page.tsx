import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import { fulfillCourseCheckout } from "@/lib/fulfillment";
import { parseTranscriptCues } from "@elearning/core/blocks";
import {
  loadCreatorRating,
  loadRatingStats,
  NO_RATING,
} from "@/lib/rating-server";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveBlock,
  resolveCourseText,
  translatedText,
} from "@elearning/core/course-i18n";
import { CourseDetailView } from "@/components/catalog/CourseDetailView";
import { ComingSoonView } from "@/components/catalog/ComingSoonView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: {
      title: true,
      subtitle: true,
      language: true,
      extraLanguages: true,
      translations: true,
    },
  });
  if (!course) return { title: "Kurs" };
  const texts = resolveCourseText(
    course,
    pickCourseLanguage(courseLanguages(course), locale)
  );
  return {
    title: texts.title,
    description: texts.subtitle ?? undefined,
  };
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ session_id?: string; acct?: string; via?: string }>;
}) {
  const { locale, slug } = await params;
  const { session_id: checkoutSessionId, acct, via } = await searchParams;

  // Rückkehr vom Stripe-Checkout: Session verifizieren und idempotent
  // freischalten (der Webhook macht dasselbe – wer zuerst kommt, gewinnt).
  // `acct` ist gesetzt, wenn die Zahlung als Direct Charge auf dem
  // Connect-Konto des Creators lief. Läuft parallel zu Auth + Kurs-Query.
  const fulfillPromise =
    checkoutSessionId && isStripeEnabled()
      ? (async () => {
          try {
            const checkout = await stripe().checkout.sessions.retrieve(
              checkoutSessionId,
              undefined,
              acct && /^acct_[A-Za-z0-9]+$/.test(acct)
                ? { stripeAccount: acct }
                : undefined
            );
            if (checkout.metadata?.kind === "course") {
              await fulfillCourseCheckout(checkout);
            }
          } catch {
            // ungültige Session-ID → einfach die normale Kursseite zeigen
          }
        })()
      : Promise.resolve();

  // Auth, Kurs und Fulfillment sind unabhängig → parallel; Lektionen ohne
  // Block-Inhalte (content/css sind MediumText und nur für Vorschau nötig)
  const [session, course] = await Promise.all([
    auth(),
    db.course.findUnique({
      where: { slug },
      include: {
        creator: {
          select: {
            name: true,
            storefrontName: true,
            image: true,
            handle: true,
            creatorBio: true,
          },
        },
        sections: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                translations: true,
                durationSeconds: true,
                isPreview: true,
              },
            },
            quiz: { select: { id: true } },
          },
        },
      },
    }),
    fulfillPromise,
  ]);

  if (!course) {
    notFound();
  }

  // Einschreibung, Vorschau-Blöcke und Bewertungen sind unabhängig → parallel
  const [enrollment, previewBlocks, ratings, creatorRating] =
    await Promise.all([
      session?.user?.id
        ? db.enrollment.findUnique({
            where: {
              userId_courseId: {
                userId: session.user.id,
                courseId: course.id,
              },
            },
          })
        : null,
      db.lessonBlock.findMany({
        where: {
          lesson: { isPreview: true, section: { courseId: course.id } },
        },
        orderBy: { order: "asc" },
      }),
      loadRatingStats([course.id]),
      loadCreatorRating(course.creatorId),
    ]);

  const blocksByLesson = new Map<string, typeof previewBlocks>();
  for (const block of previewBlocks) {
    const list = blocksByLesson.get(block.lessonId) ?? [];
    list.push(block);
    blocksByLesson.set(block.lessonId, list);
  }

  // Entwürfe bleiben für Eingeschriebene (gekaufter Kurs!) und den
  // Creator selbst erreichbar – für alle anderen: Warteliste oder 404.
  const isOwner = session?.user?.id === course.creatorId;
  if (!course.published && !enrollment && !isOwner) {
    if (course.waitlistEnabled) {
      const soonTexts = resolveCourseText(
        course,
        pickCourseLanguage(courseLanguages(course), locale)
      );
      return (
        <ComingSoonView
          course={{
            id: course.id,
            title: soonTexts.title,
            subtitle: soonTexts.subtitle ?? null,
            coverImage: course.coverImage,
            creatorName:
              course.creator.storefrontName || course.creator.name || "Creator",
          }}
          presetEmail={session?.user?.email ?? ""}
        />
      );
    }
    notFound();
  }

  // Texte in der Site-Sprache anzeigen, wenn der Kurs sie anbietet
  const languages = courseLanguages(course);
  const contentLang = pickCourseLanguage(languages, locale);
  const texts = resolveCourseText(course, contentLang);

  return (
    <CourseDetailView
      course={{
        id: course.id,
        slug: course.slug,
        title: texts.title,
        subtitle: texts.subtitle ?? "",
        description: texts.description ?? "",
        coverImage: course.coverImage,
        language: course.language,
        languages,
        priceCents: course.priceCents,
        currency: course.currency,
        requiredWatchPercent: course.requiredWatchPercent,
        finalExamRequired: course.finalExamRequired,
        creatorName:
          course.creator.storefrontName ?? course.creator.name ?? "Creator",
        creatorImage: course.creator.image,
        creatorHandle: course.creator.handle,
        creatorBio: course.creator.creatorBio ?? "",
        rating: ratings.get(course.id) ?? NO_RATING,
        creatorRating,
        sections: course.sections.map((s) => ({
          id: s.id,
          title: translatedText(s.translations, contentLang, "title", s.title),
          hasQuiz: Boolean(s.quiz),
          // Drip Content transparent machen: Käufer sehen vorab, dass
          // Abschnitte zeit- bzw. prüfungsgesteuert freigeschaltet werden
          dripAfterDays: s.dripAfterDays,
          dripAfterQuiz: s.dripAfterQuiz,
          lessons: s.lessons.map((l) => ({
            id: l.id,
            title: translatedText(
              l.translations,
              contentLang,
              "title",
              l.title
            ),
            durationSeconds: l.durationSeconds,
            isPreview: l.isPreview,
            // Inhalte nur für freigegebene Vorschau-Lektionen ausliefern
            blocks: (blocksByLesson.get(l.id) ?? []).map((b) => {
              const resolved = resolveBlock(b, contentLang, course.language);
              return {
                id: b.id,
                type: b.type,
                title: resolved.title ?? "",
                url: resolved.url ?? "",
                fileName: resolved.fileName ?? "",
                content: resolved.content ?? "",
                css: b.css ?? "",
                durationSeconds: resolved.durationSeconds,
                transcriptDe: b.transcriptDe ?? "",
                transcriptEn: b.transcriptEn ?? "",
                transcriptCues: parseTranscriptCues(b.transcriptCues),
                poster: resolved.poster ?? "",
                mediaFallback: resolved.mediaFallback,
                textFallback: resolved.textFallback,
                fallbackLanguage: course.language,
              };
            }),
          })),
        })),
      }}
      isLoggedIn={Boolean(session?.user)}
      isEnrolled={Boolean(enrollment)}
      stripeEnabled={isStripeEnabled()}
      via={via === "embed" || via === "api" ? via : undefined}
    />
  );
}
