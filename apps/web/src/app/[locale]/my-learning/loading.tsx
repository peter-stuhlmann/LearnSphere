"use client";

import { Container } from "@/components/ui/primitives";
import {
  Skeleton,
  SkeletonCard,
  SkeletonCover,
  SkeletonGrid,
} from "@/components/ui/Skeleton";

/** Skeleton von "Mein Lernen": Begrüßungsband, KPI-Zeile, Kurskarten. */
export default function MyLearningLoading() {
  return (
    <main style={{ padding: "4rem 0 2rem" }}>
      <Container>
        <Skeleton $w="90px" $h="0.8rem" />
        <Skeleton $w="min(320px, 60%)" $h="2.4rem" style={{ marginTop: "0.7rem" }} />
        <Skeleton $h="150px" style={{ marginTop: "1.5rem" }} />
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
