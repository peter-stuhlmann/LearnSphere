"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import {
  Container,
  Kicker,
  Muted,
  SectionTitle,
} from "@/components/ui/primitives";
import {
  CourseCard,
  type CourseCardCourse,
} from "@/components/catalog/CourseCard";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Grid = styled.div`
  display: grid;
  gap: 1.25rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export function TenantPortalHome({
  brandName,
  brandColor,
  courses,
}: {
  brandName: string;
  brandColor: string | null;
  courses: CourseCardCourse[];
}) {
  const t = useTranslations("tenant");

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{brandName}</Kicker>
        <SectionTitle as="h1">{t("portalTitle")}</SectionTitle>
        <Muted style={{ marginTop: "0.75rem", maxWidth: "60ch" }}>
          {t("portalIntro")}
        </Muted>

        {courses.length > 0 ? (
          <Grid>
            {courses.map((course, index) => (
              <CourseCard
                key={course.slug}
                course={course}
                brandColor={brandColor ?? undefined}
                index={index}
              />
            ))}
          </Grid>
        ) : (
          <Muted style={{ marginTop: "2rem" }}>{t("portalEmpty")}</Muted>
        )}
      </Container>
    </Wrap>
  );
}
