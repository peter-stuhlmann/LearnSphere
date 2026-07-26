"use client";

import { Container } from "@/components/ui/primitives";
import {
  Skeleton,
  SkeletonCard,
  SkeletonCover,
  SkeletonGrid,
} from "@/components/ui/Skeleton";

/** Skeleton des Creator-Studios: Kopf, Kennzahlen-Zeile, Kurskarten. */
export default function CreatorLoading() {
  return (
    <main style={{ padding: "4rem 0 2rem" }} aria-busy="true">
      <Container>
        <Skeleton $w="160px" $h="0.8rem" />
        <Skeleton
          $w="min(300px, 65%)"
          $h="2.6rem"
          style={{ marginTop: "0.7rem" }}
        />

        {/* Kennzahlen-Zeile */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginTop: "2rem",
          }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} $h="88px" />
          ))}
        </div>

        {/* Kurskarten */}
        <SkeletonGrid>
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i}>
              <SkeletonCover
                style={{ margin: "-1.5rem -1.5rem 0", width: "auto" }}
                $r="0"
              />
              <Skeleton $w="70%" $h="1.3rem" />
              <Skeleton $w="45%" $h="0.9rem" />
              <Skeleton $h="10px" $r="999px" />
            </SkeletonCard>
          ))}
        </SkeletonGrid>
      </Container>
    </main>
  );
}
