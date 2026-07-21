"use client";

import { Container } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/Skeleton";

/** Skeleton der Kurs-Statistiken: KPI-Kacheln + Diagrammflächen. */
export default function CourseStatsLoading() {
  return (
    <main style={{ padding: "4rem 0 3rem" }}>
      <Container>
        <Skeleton $w="130px" $h="0.85rem" />
        <Skeleton $w="min(420px, 70%)" $h="2.3rem" style={{ marginTop: "0.7rem" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginTop: "2rem",
          }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} $h="88px" />
          ))}
        </div>
        <Skeleton $h="280px" style={{ marginTop: "2.5rem" }} />
        <Skeleton $h="220px" style={{ marginTop: "1.5rem" }} />
      </Container>
    </main>
  );
}
