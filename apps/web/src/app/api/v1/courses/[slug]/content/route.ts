import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiRequest, retryAfterHeaders } from "@/lib/api-auth";
import { resolveEnrolledBuyer } from "../../../_lib/headless";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveBlock,
  translatedText,
} from "@elearning/core/course-i18n";
import { isProtectedVideoUrl } from "@elearning/core/media-url";
import { mediaSignSecret, signedMediaUrl } from "@/lib/media-sign";

/*
 * Bewusst KEIN CORS/OPTIONS: Dieser Endpoint gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen.
 */

/**
 * GET /api/v1/courses/[slug]/content?email=… – Kursinhalt des EIGENEN
 * Kurses inkl. aufgelöster Blöcke und signierter Medien-URLs.
 *
 * Inhalte gibt es AUSSCHLIESSLICH im Kontext eines gültigen Kaufs: Die
 * angegebene E-Mail muss in diesem Kurs eingeschrieben sein – das gilt
 * auch für den Betreiber der Integrator-Seite selbst. So gibt es keinen
 * Sammel-Export ohne Einschreibung; die AGB untersagen zudem jede
 * Veröffentlichung von Kursinhalten, auch auszugsweise.
 *
 * Die Antwort gehört NIE ungeprüft in den Browser – und die signierten
 * Medien-URLs laufen ab, also pro Aufruf frisch holen statt cachen.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status, headers: retryAfterHeaders(authResult.status) }
    );
  }

  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } },
          },
          quiz: { select: { id: true, title: true, passPercent: true } },
        },
      },
      quizzes: {
        where: { kind: "FINAL" },
        select: { id: true, title: true, passPercent: true },
        take: 1,
      },
    },
  });
  if (!course || !course.published || course.creatorId !== authResult.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Kein Zugriff ohne verifizierten Kauf – auch nicht für den Betreiber
  const buyer = await resolveEnrolledBuyer(
    request.nextUrl.searchParams.get("email"),
    course.id,
    authResult.userId
  );
  if (!buyer.ok) {
    return NextResponse.json(
      { error: buyer.error },
      { status: buyer.error === "email_invalid" ? 400 : 403 }
    );
  }

  const locale = pickCourseLanguage(
    courseLanguages(course),
    request.nextUrl.searchParams.get("lang")
  );

  let signSecret: string | null = null;
  try {
    signSecret = mediaSignSecret();
  } catch {
    // ohne Secret bleiben lokale Medien-URLs unsigniert (und damit 403)
  }
  /** Lokale geschützte Medien signieren; alles andere unverändert. */
  const withSignature = (url: string | null): string | null => {
    if (!url || !signSecret) return url;
    return isProtectedVideoUrl(url) ? signedMediaUrl(url, signSecret) : url;
  };

  return NextResponse.json(
    {
      data: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        language: course.language,
        languages: courseLanguages(course),
        requestedLanguage: locale,
        // Prüfungs-Rahmen: Zulassung ab X % Sehanteil, Abschlussprüfung
        // über /api/v1/quizzes/{id}, Fortschritt über /api/v1/lessons/…
        requiredWatchPercent: course.requiredWatchPercent,
        finalExamRequired: course.finalExamRequired,
        finalQuiz: course.quizzes[0] ?? null,
        sections: course.sections.map((section) => ({
          id: section.id,
          title: translatedText(
            section.translations,
            locale,
            "title",
            section.title
          ),
          quiz: section.quiz,
          lessons: section.lessons.map((lesson) => ({
            id: lesson.id,
            title: translatedText(
              lesson.translations,
              locale,
              "title",
              lesson.title
            ),
            durationSeconds: lesson.durationSeconds,
            isPreview: lesson.isPreview,
            blocks: lesson.blocks.map((block) => {
              const resolved = resolveBlock(block, locale, course.language);
              return {
                id: block.id,
                type: block.type,
                title: resolved.title,
                url: withSignature(resolved.url),
                fileName: resolved.fileName,
                poster: resolved.poster,
                content: resolved.content,
                durationSeconds: resolved.durationSeconds,
                chapters: Array.isArray(block.chapters)
                  ? (block.chapters as { t: number; title: string }[])
                  : null,
                // Herkunfts-Fußnote (Art. 50 KI-VO) – auch headless anzeigen
                provenance: resolved.provenance,
              };
            }),
          })),
        })),
      },
    },
    // Signierte URLs sind kurzlebig und die Daten personalisiert die
    // Auslieferung des Integrators – nichts davon cachebar machen
    { headers: { "Cache-Control": "no-store" } }
  );
}
