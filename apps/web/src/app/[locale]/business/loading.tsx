"use client";

import { Container } from "@/components/ui/primitives";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/** Skeleton von LearnSphere Business: Kopf, Lizenzkarten, Whitelabel-Portal. */
export default function BusinessLoading() {
  return (
    <main style={{ padding: "4rem 0 2rem" }} aria-busy="true">
      <Container>
        <Skeleton $w="200px" $h="0.8rem" />
        <Skeleton
          $w="min(320px, 70%)"
          $h="2.6rem"
          style={{ marginTop: "0.7rem" }}
        />
        <Skeleton
          $w="min(520px, 90%)"
          $h="1rem"
          style={{ marginTop: "0.8rem" }}
        />

        {/* Lizenzkarten */}
        {Array.from({ length: 2 }, (_, i) => (
          <SkeletonCard key={i} style={{ marginTop: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <Skeleton $w="240px" $h="1.3rem" />
              <Skeleton $w="90px" $h="1.3rem" $r="999px" />
            </div>
            <Skeleton $h="10px" $r="999px" />
            <Skeleton $h="3rem" />
          </SkeletonCard>
        ))}

        {/* Whitelabel-Portal-Karte */}
        <SkeletonCard style={{ marginTop: "1.5rem" }}>
          <Skeleton $w="200px" $h="1.4rem" />
          <Skeleton $w="90%" $h="0.9rem" />
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 200px" }}>
            <Skeleton $h="3rem" />
            <Skeleton $h="3rem" />
          </div>
          <Skeleton $h="3rem" />
        </SkeletonCard>
      </Container>
    </main>
  );
}
