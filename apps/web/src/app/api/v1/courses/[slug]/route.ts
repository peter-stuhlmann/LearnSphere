import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiRequest, retryAfterHeaders } from "@/lib/api-auth";
import { courseLanguages } from "@elearning/core/course-i18n";

/*
 * Bewusst KEIN CORS/OPTIONS: Die Creator-API gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen.
 */

/** GET /api/v1/courses/[slug] – Kursdetail inkl. Curriculum (nur Metadaten). */
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
            select: {
              title: true,
              durationSeconds: true,
              isPreview: true,
            },
          },
        },
      },
    },
  });

  if (!course || !course.published || course.creatorId !== authResult.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return NextResponse.json(
    {
      data: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        language: course.language,
        languages: courseLanguages(course),
        priceCents: course.priceCents,
        currency: course.currency,
        listedInShop: course.listedInShop,
        url: `${appUrl}/de/courses/${course.slug}?via=api`,
        embedUrl: `${appUrl}/embed/${course.slug}`,
        sections: course.sections.map((section) => ({
          title: section.title,
          lessons: section.lessons,
        })),
      },
    },
  );
}
