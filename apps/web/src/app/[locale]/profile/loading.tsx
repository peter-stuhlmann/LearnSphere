"use client";

import { Container } from "@/components/ui/primitives";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/** Skeleton des Profils: Avatar-/Namenskarte, Rechnungsadresse, Bereichs-Tabs. */
export default function ProfileLoading() {
  return (
    <main style={{ padding: "4rem 0 2rem" }} aria-busy="true">
      <Container>
        <Skeleton $w="180px" $h="0.8rem" />
        <Skeleton
          $w="min(260px, 60%)"
          $h="2.6rem"
          style={{ marginTop: "0.7rem" }}
        />

        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            marginTop: "2rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            alignItems: "start",
          }}
        >
          <SkeletonCard>
            <Skeleton $w="120px" $h="1.2rem" />
            <div
              style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0" }}
            >
              <Skeleton $w="148px" $h="148px" $r="50%" />
            </div>
            <Skeleton $w="60%" $h="0.9rem" style={{ margin: "0 auto" }} />
          </SkeletonCard>
          <SkeletonCard>
            <Skeleton $w="90px" $h="1.2rem" />
            <Skeleton $h="3rem" />
            <Skeleton $h="3rem" />
          </SkeletonCard>
        </div>

        {/* Rechnungsadresse (gilt für alle Bereiche) */}
        <SkeletonCard style={{ marginTop: "1.5rem" }}>
          <Skeleton $w="160px" $h="1.2rem" />
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
            <Skeleton $h="3rem" />
            <Skeleton $h="3rem" />
          </div>
          <Skeleton $h="3rem" />
          <Skeleton $h="3rem" />
        </SkeletonCard>

        {/* Bereichs-Tabs */}
        <div style={{ display: "flex", gap: "0.6rem", margin: "2.5rem 0 1.5rem" }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} $w="96px" $h="1.6rem" $r="999px" />
          ))}
        </div>
        <SkeletonCard>
          <Skeleton $w="150px" $h="1.2rem" />
          <Skeleton $h="3rem" />
          <Skeleton $h="3rem" />
        </SkeletonCard>
      </Container>
    </main>
  );
}
