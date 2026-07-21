"use client";

import { Container } from "@/components/ui/primitives";
import {
  Skeleton,
  SkeletonCard,
  SkeletonCover,
  SkeletonGrid,
} from "@/components/ui/Skeleton";

/** Skeleton des Kurskatalogs: Suchleiste + Karten-Grid im echten Layout. */
export default function CatalogLoading() {
  return (
    <main style={{ padding: "4rem 0 2rem" }}>
      <Container>
        <Skeleton $w="90px" $h="0.8rem" />
        <Skeleton $w="min(420px, 70%)" $h="2.4rem" style={{ marginTop: "0.7rem" }} />
        <Skeleton $h="3.2rem" $r="999px" style={{ marginTop: "2rem" }} />
        <SkeletonGrid>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i}>
              <SkeletonCover
                style={{ margin: "-1.5rem -1.5rem 0", width: "auto" }}
                $r="0"
              />
              <Skeleton $w="75%" $h="1.3rem" />
              <Skeleton $w="55%" $h="0.9rem" />
              <Skeleton $w="40%" $h="0.9rem" />
            </SkeletonCard>
          ))}
        </SkeletonGrid>
      </Container>
    </main>
  );
}
