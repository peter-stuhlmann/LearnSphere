"use client";

import Image from "next/image";
import styled from "styled-components";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { TransitionLink } from "@/components/navigation/TransitionLink";
import { courseTransitionName } from "@/components/navigation/view-transition";
import { formatPrice } from "@elearning/core/format";
import { categoryLabel } from "@elearning/core/categories";
import { Badge } from "@/components/ui/primitives";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";

/**
 * Gemeinsame Kurs-Karte für Katalog und Creator-Storefront: Cover (16:9),
 * Titel, Untertitel, Badges, Preis. Optionale Felder (Creator, Tags,
 * Kategorie, Bewertung) erscheinen nur, wenn Daten übergeben werden;
 * `brandColor` färbt Hover-Rahmen und Preis (Storefront-Branding).
 */

export const CourseGrid = styled.div`
  display: grid;
  gap: 1.25rem;
  margin-top: 1.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Card = styled(motion.article)<{ $brand?: string }>`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  overflow: hidden;
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;

  &:hover {
    border-color: ${({ theme, $brand }) => $brand ?? theme.colors.accent};
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadows.card};
  }

  h2 {
    font-size: 1.3rem;
  }
`;

const CardCover = styled.div`
  /* volle Kartenbreite trotz Karten-Padding */
  margin: -1.6rem -1.6rem 0;
  /* fester 16:9-Rahmen – Bezugsrahmen für next/image mit fill */
  position: relative;
  aspect-ratio: 16 / 9;
  background: ${({ theme }) => theme.colors.bgElevated};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;

  img {
    object-fit: cover;
  }
`;

const CardLink = styled(TransitionLink)`
  text-decoration: none;
  color: inherit;

  /* Karte komplett klickbar machen */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
  }
`;

const Sub = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.92rem;
`;

const Creator = styled.p`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;

  span {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.72rem;
    color: ${({ theme }) => theme.colors.textFaint};

    &::before {
      content: "#";
    }
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: auto;
`;

const Price = styled.span<{ $brand?: string }>`
  margin-left: auto;
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme, $brand }) => $brand ?? theme.colors.accent};
  font-size: 0.9rem;
`;

export interface CourseCardCourse {
  slug: string;
  title: string;
  subtitle: string;
  /** Alle Kurssprachen, Basissprache zuerst */
  languages: string[];
  priceCents: number;
  currency: string;
  coverImage: string | null;
  sectionCount: number;
  category?: string | null;
  tags?: string[];
  creatorName?: string | null;
  avgRating?: number | null;
}

export function CourseCard({
  course,
  brandColor,
  index = 0,
}: {
  course: CourseCardCourse;
  /** Akzentfarbe der Storefront; ohne Angabe gilt das Theme-Accent */
  brandColor?: string;
  /** Position im Grid – staffelt die Einblende-Animation */
  index?: number;
}) {
  const t = useTranslations("catalog");
  const tCourse = useTranslations("course");
  const locale = useLocale();
  const tags = course.tags ?? [];

  return (
    <Card
      $brand={brandColor}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45 }}
    >
      {/* view-transition-name: das Cover morpht beim Klick in den
          Kursdetail-Hero (gleicher Name dort) */}
      <CardCover style={{ viewTransitionName: courseTransitionName(course.slug) }}>
        {course.coverImage ? (
          <Image
            src={course.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 480px) 50vw, 100vw"
          />
        ) : (
          <CoverPlaceholder />
        )}
      </CardCover>
      <h2>
        <CardLink
          href={{
            pathname: "/courses/[slug]",
            params: { slug: course.slug },
          }}
        >
          {course.title}
        </CardLink>
      </h2>
      {course.subtitle ? <Sub>{course.subtitle}</Sub> : null}
      {course.creatorName ? (
        <Creator>{t("by", { name: course.creatorName })}</Creator>
      ) : null}
      {tags.length > 0 ? (
        <TagRow aria-hidden="true">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </TagRow>
      ) : null}
      <MetaRow>
        <Badge>{course.languages.map((l) => l.toUpperCase()).join(" · ")}</Badge>
        {course.category ? (
          <Badge $tone="violet">{categoryLabel(course.category, locale)}</Badge>
        ) : null}
        <Badge $tone="violet">
          {tCourse("sections", { count: course.sectionCount })}
        </Badge>
        {course.avgRating != null ? (
          <Badge $tone="accent">★ {course.avgRating}</Badge>
        ) : null}
        <Price $brand={brandColor}>
          {formatPrice(course.priceCents, course.currency, locale)}
        </Price>
      </MetaRow>
    </Card>
  );
}
