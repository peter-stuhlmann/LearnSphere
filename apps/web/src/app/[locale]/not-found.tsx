"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { Container, Kicker } from "@/components/ui/primitives";

const Wrap = styled.main`
  min-height: 60dvh;
  display: flex;
  align-items: center;
  padding: 4rem 0;
`;

const Big = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(5rem, 20vw, 10rem);
  line-height: 1;
  color: ${({ theme }) => theme.colors.violet};
  text-shadow: 0 0 80px rgba(139, 124, 255, 0.35);
`;

const Title = styled.h1`
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  margin-top: 0.5rem;
`;

const HomeLink = styled(Link)`
  display: inline-flex;
  margin-top: 1.75rem;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-weight: 600;
  padding: 0.85rem 1.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
`;

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <Wrap id="main">
      <Container>
        <Kicker>404</Kicker>
        <Big aria-hidden>∅</Big>
        <Title>{t("title")}</Title>
        <p style={{ marginTop: "0.5rem", opacity: 0.7 }}>{t("text")}</p>
        <HomeLink href="/">{t("home")}</HomeLink>
      </Container>
    </Wrap>
  );
}
