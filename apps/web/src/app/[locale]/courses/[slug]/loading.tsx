"use client";

import styled from "styled-components";
import { Container } from "@/components/ui/primitives";
import { Skeleton, SkeletonCover } from "@/components/ui/Skeleton";

/**
 * Skeleton der Kurs-Detailseite (Landingpage). Spiegelt das echte Layout aus
 * CourseDetailView – zweispaltig ab lg, Inhalt links, Kaufkarte rechts – damit
 * beim Streaming vom Server nichts springt. Wichtig: eigener loading.tsx, sonst
 * würde die Route den Katalog-Grid-Skeleton der Elternroute erben.
 */

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Layout = styled.div`
  display: grid;
  gap: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr 340px;
    align-items: start;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 1rem;
`;

const BuyCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export default function CourseDetailLoading() {
  return (
    <Wrap>
      <Container>
        <Layout>
          <div>
            {/* Kicker → Titel → Untertitel → Meta → Bewertung → Sprachen */}
            <Skeleton $w="140px" $h="0.8rem" />
            <Skeleton
              $w="min(560px, 85%)"
              $h="3rem"
              style={{ marginTop: "0.7rem" }}
            />
            <Skeleton
              $w="min(420px, 70%)"
              $h="1.4rem"
              style={{ marginTop: "1rem" }}
            />
            <Skeleton
              $w="200px"
              $h="0.9rem"
              style={{ marginTop: "1.2rem" }}
            />
            <Chips>
              <Skeleton $w="110px" $h="1.9rem" $r="999px" />
              <Skeleton $w="120px" $h="1.9rem" $r="999px" />
            </Chips>

            {/* Cover 16:9 */}
            <SkeletonCover style={{ marginTop: "1.5rem" }} />

            {/* Beschreibung */}
            <Skeleton $w="180px" $h="1.4rem" style={{ marginTop: "2.5rem" }} />
            <Skeleton $h="0.9rem" style={{ marginTop: "1rem" }} />
            <Skeleton $h="0.9rem" style={{ marginTop: "0.6rem" }} />
            <Skeleton $w="80%" $h="0.9rem" style={{ marginTop: "0.6rem" }} />

            {/* Kursinhalt: ein paar Abschnitts-Zeilen */}
            <Skeleton $w="160px" $h="1.4rem" style={{ marginTop: "2.5rem" }} />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton
                key={i}
                $h="3.2rem"
                style={{ marginTop: i === 0 ? "1rem" : "0.6rem" }}
              />
            ))}
          </div>

          {/* Kaufkarte rechts */}
          <BuyCard>
            <Skeleton $w="120px" $h="2.2rem" />
            <Skeleton $h="0.9rem" />
            <Skeleton $w="70%" $h="0.9rem" />
            <Skeleton $h="3rem" $r="999px" style={{ marginTop: "0.5rem" }} />
          </BuyCard>
        </Layout>
      </Container>
    </Wrap>
  );
}
