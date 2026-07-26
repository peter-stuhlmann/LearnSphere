"use client";

import { Container } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Generischer Seiten-Skeleton für alle Routen ohne eigenes loading.tsx.
 * Erscheint per Streaming SOFORT beim Navigieren (statt 3–5 s leerer
 * Ladebalken), während die Server-Component im Hintergrund lädt. Routen mit
 * eigenem, passgenauem loading.tsx (Katalog, Lernen, „Mein Lernen" …)
 * überschreiben diesen Fallback.
 */
export default function LocaleLoading() {
  return (
    <main style={{ padding: "4rem 0 2rem" }} aria-busy="true">
      <Container>
        <Skeleton $w="120px" $h="0.8rem" />
        <Skeleton
          $w="min(420px, 70%)"
          $h="2.4rem"
          style={{ marginTop: "0.8rem" }}
        />
        <Skeleton
          $w="min(560px, 90%)"
          $h="1rem"
          style={{ marginTop: "0.9rem" }}
        />
        <div style={{ display: "grid", gap: "1rem", marginTop: "2.5rem" }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} $h="72px" />
          ))}
        </div>
      </Container>
    </main>
  );
}
