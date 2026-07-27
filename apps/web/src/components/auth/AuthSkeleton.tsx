"use client";

import styled from "styled-components";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Ladeskelett für die Auth-Seiten (login/register/…): bildet die zentrierte
 * AuthShell-Karte nach, damit beim Navigieren kein links ausgerichteter
 * Seiten-Skeleton aufblitzt, sondern schon das richtige Layout „steht".
 * Maße bewusst deckungsgleich mit AuthShell (Wrap/Card/Title/Subtitle).
 */
const Wrap = styled.main`
  min-height: calc(100dvh - 140px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 20px;
`;

const Card = styled.div`
  width: 100%;
  max-width: 420px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 2rem 1.5rem;
  backdrop-filter: blur(16px);
  box-shadow: ${({ theme }) => theme.shadows.card};

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: 2.5rem 2.25rem;
  }
`;

const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
`;

export function AuthSkeleton({
  fields = 2,
  oauth = true,
}: {
  fields?: number;
  oauth?: boolean;
}) {
  const pill = "999px";
  return (
    <Wrap aria-busy="true">
      <Card>
        {/* Titel + Untertitel (wie AuthShell Title 1.9rem / Subtitle 0.94rem) */}
        <Skeleton $w="55%" $h="1.9rem" />
        <Skeleton $w="82%" $h="0.94rem" style={{ marginTop: "0.6rem" }} />

        {/* OAuth-Button (bei login/register) */}
        {oauth ? (
          <Skeleton
            $h="46px"
            $r={pill}
            style={{ marginTop: "1.75rem" }}
          />
        ) : null}

        <Fields style={{ marginTop: oauth ? "1.1rem" : "1.75rem" }}>
          {Array.from({ length: fields }, (_, i) => (
            <Skeleton key={i} $h="46px" />
          ))}
          <Skeleton
            $h="48px"
            $r={pill}
            style={{ marginTop: "0.4rem" }}
          />
        </Fields>

        {/* Footer-Link (zentriert wie FormFooter) */}
        <Skeleton
          $w="60%"
          $h="0.88rem"
          style={{ margin: "1.5rem auto 0" }}
        />
      </Card>
    </Wrap>
  );
}
