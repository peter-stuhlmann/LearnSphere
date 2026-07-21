"use client";

import { Container } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/Skeleton";

/** Skeleton der Lernansicht: Kopfzeile, 3D-Band, Sidebar + Bühne. */
export default function LearnLoading() {
  return (
    <main style={{ padding: "2.5rem 0 2rem" }}>
      <Container>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
            <Skeleton $w="120px" $h="0.8rem" />
            <Skeleton
              $w="min(380px, 80%)"
              $h="1.9rem"
              style={{ marginTop: "0.6rem" }}
            />
          </div>
          <Skeleton $w="min(320px, 100%)" $h="2.2rem" />
        </div>
        <Skeleton $h="230px" style={{ marginBottom: "1.5rem" }} />
        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            gridTemplateColumns:
              "minmax(0, 320px) minmax(0, 1fr)",
          }}
        >
          <Skeleton $h="420px" />
          <Skeleton $h="520px" />
        </div>
      </Container>
    </main>
  );
}
