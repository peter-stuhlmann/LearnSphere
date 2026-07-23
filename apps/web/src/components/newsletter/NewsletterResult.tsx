"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { Container, PrimaryButton } from "@/components/ui/primitives";

const Wrap = styled.main`
  min-height: 55vh;
  display: grid;
  place-items: center;
  padding: 4rem 0;
`;

const Card = styled.div`
  /* Der umgebende Container ist volle Breite (max. 1200px); place-items auf
     dem Wrap zentriert nur ihn, nicht die Karte darin. Ohne dieses auto
     klebte die Karte am linken Containerrand. */
  max-width: 460px;
  margin-inline: auto;
  text-align: center;
  padding: 2.4rem 2rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1.5px solid transparent;
  background:
    linear-gradient(${({ theme }) => theme.colors.bgDeep}, ${({ theme }) =>
      theme.colors.bgDeep}) padding-box,
    linear-gradient(120deg, ${({ theme }) => theme.colors.violet}, ${({
      theme,
    }) => theme.colors.accent}) border-box;

  h1 {
    font-size: 1.6rem;
    margin: 0.6rem 0;
  }

  p {
    color: ${({ theme }) => theme.colors.textMuted};
    margin-bottom: 1.4rem;
  }

  span[aria-hidden] {
    font-size: 2.2rem;
  }
`;

/** Ergebnis-Karte für Bestätigungs-Flows (Newsletter, E-Mail-Verifizierung). */
export function NewsletterResult({
  ok,
  title,
  text,
  action,
}: {
  ok: boolean;
  title: string;
  text: string;
  /** Ziel des Buttons; Standard: Startseite */
  action?: { href: "/" | "/login"; label: string };
}) {
  const t = useTranslations("newsletter");
  return (
    <Wrap id="main">
      <Container>
        <Card role="status">
          <span aria-hidden>{ok ? "🎉" : "🤔"}</span>
          <h1>{title}</h1>
          <p>{text}</p>
          <PrimaryButton as={Link} href={action?.href ?? "/"}>
            {action?.label ?? t("backHome")}
          </PrimaryButton>
        </Card>
      </Container>
    </Wrap>
  );
}
