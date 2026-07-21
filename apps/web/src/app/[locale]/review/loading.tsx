"use client";

import { Container } from "@/components/ui/primitives";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/** Skeleton der Wiederholen-Seite: Kopf + eine Karteikarte. */
export default function ReviewLoading() {
  return (
    <main style={{ padding: "4rem 0 3rem" }}>
      <Container>
        <Skeleton $w="140px" $h="0.8rem" />
        <Skeleton $w="min(280px, 55%)" $h="2.3rem" style={{ marginTop: "0.7rem" }} />
        <SkeletonCard style={{ marginTop: "2rem", maxWidth: 720 }}>
          <Skeleton $w="45%" $h="0.9rem" />
          <Skeleton $w="85%" $h="1.5rem" />
          <Skeleton $h="3rem" />
          <Skeleton $h="3rem" />
          <Skeleton $h="3rem" />
        </SkeletonCard>
      </Container>
    </main>
  );
}
