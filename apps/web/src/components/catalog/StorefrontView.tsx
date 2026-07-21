"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Container, Kicker } from "@/components/ui/primitives";
import { RichText } from "@/components/ui/RichText";
import {
  CourseCard,
  CourseGrid,
  type CourseCardCourse,
} from "./CourseCard";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Hero = styled.header<{ $brand: string }>`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid ${({ $brand }) => $brand};
  margin-bottom: 2rem;

  h1 {
    font-size: clamp(1.9rem, 6vw, 3rem);
  }
`;

const Avatar = styled.div<{ $brand: string }>`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid ${({ $brand }) => $brand};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.8rem;
  background: ${({ theme }) => theme.colors.bgElevated};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const Powered = styled.p`
  margin-top: 3rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

interface StorefrontViewProps {
  creator: {
    name: string;
    brandColor: string | null;
    image: string | null;
    bio: string;
  };
  courses: CourseCardCourse[];
}

export function StorefrontView({ creator, courses }: StorefrontViewProps) {
  const t = useTranslations("storefront");
  const brand = creator.brandColor ?? "#C8FF4D";

  return (
    <Wrap id="main">
      <Container>
        <Hero $brand={brand}>
          <Avatar $brand={brand}>
            {creator.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
              <img src={creator.image} alt="" />
            ) : (
              creator.name.charAt(0).toUpperCase()
            )}
          </Avatar>
          <div>
            <Kicker style={{ color: brand }}>LearnSphere Storefront</Kicker>
            <h1>{t("coursesBy", { name: creator.name })}</h1>
          </div>
        </Hero>

        {creator.bio ? (
          <div style={{ maxWidth: "68ch", margin: "-0.5rem 0 2.5rem" }}>
            <RichText html={creator.bio} />
          </div>
        ) : null}

        {courses.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <CourseGrid>
            {courses.map((course, i) => (
              <CourseCard
                key={course.slug}
                course={course}
                brandColor={brand}
                index={i}
              />
            ))}
          </CourseGrid>
        )}

        <Powered>{t("poweredBy")}</Powered>
      </Container>
    </Wrap>
  );
}
