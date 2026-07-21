import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadRatingStats } from "@/lib/rating-server";
import { formatPrice } from "@elearning/core/format";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";

const TEXTS = {
  de: { cta: "Zum Kurs", by: "von", sections: "Abschnitte", poweredBy: "Bereitgestellt von" },
  en: { cta: "View course", by: "by", sections: "sections", poweredBy: "Powered by" },
} as const;

/**
 * Einbettbare Kurskarte für fremde Websites (iframe). Bewusst ohne
 * App-Chrome und ohne styled-components – eine kleine, in sich
 * geschlossene Server-Komponente mit Inline-CSS.
 */
export default async function EmbedCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const locale = lang === "en" ? "en" : "de";
  const t = TEXTS[locale];

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      creator: {
        select: { name: true, storefrontName: true, brandColor: true },
      },
      _count: { select: { sections: true } },
    },
  });
  if (!course || !course.published) notFound();

  const brand = course.creator.brandColor ?? "#C8FF4D";
  // Kartentexte in der Widget-Sprache, sofern der Kurs sie anbietet
  const languages = courseLanguages(course);
  const texts = resolveCourseText(
    course,
    pickCourseLanguage(languages, locale)
  );
  const ratings = await loadRatingStats([course.id]);
  const avgRating = ratings.get(course.id)?.average ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // via=embed: Kauf zählt als Drittseiten-Verkauf (75 % Creator-Anteil)
  const courseUrl = `${appUrl}/${locale}/courses/${course.slug}?via=embed`;

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        background: "#0B0C15",
        color: "#EDEDF2",
        border: `1px solid rgba(255,255,255,0.14)`,
        borderRadius: 16,
        padding: "22px 22px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 280,
        boxSizing: "border-box",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: brand,
        }}
      >
        {course.creator.storefrontName ?? course.creator.name ?? "LearnSphere"}
      </p>
      <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.25 }}>
        {texts.title}
      </h1>
      {texts.subtitle ? (
        <p style={{ margin: 0, fontSize: 14, color: "#A7A9BC" }}>
          {texts.subtitle}
        </p>
      ) : null}

      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8A8CA3" }}>
        {course._count.sections} {t.sections}
        {avgRating !== null ? ` · ★ ${avgRating}` : ""} ·{" "}
        {languages.map((l) => l.toUpperCase()).join(" · ")}
      </p>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 700, color: brand }}>
          {formatPrice(course.priceCents, course.currency, locale)}
        </span>
        <a
          href={courseUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: brand,
            color: "#0B0C15",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
            padding: "10px 20px",
            borderRadius: 999,
          }}
        >
          {t.cta} →
        </a>
      </div>

      <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "#8A8CA3" }}>
        {t.poweredBy}{" "}
        <a
          href={appUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#A7A9BC" }}
        >
          LearnSphere
        </a>
      </p>
    </div>
  );
}
