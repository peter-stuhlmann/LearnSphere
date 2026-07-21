import type { CertificateOrientationId } from "./theme";

/**
 * Schmuck-Geometrie des Zertifikats: sanfte Farbverläufe plus das
 * Sternen-Geflecht aus dem Startseiten-Hero (Constellation.tsx) als
 * statische 2D-Projektion – gleicher Algorithmus (Seed 42, Punkte auf
 * einer abgeflachten Kugelschale, Kanten ab Nachbarschaftsdistanz).
 * Eine pure Funktion liefert identische Koordinaten für den
 * PDF-Renderer und die HTML-Live-Vorschau; Farben kommen als
 * Paletten-Schlüssel (accent/accent2) und werden erst beim Rendern
 * aufgelöst.
 */

export const CERTIFICATE_PAGE_SIZES = {
  landscape: { width: 842, height: 595 },
  portrait: { width: 595, height: 842 },
} as const satisfies Record<
  CertificateOrientationId,
  { width: number; height: number }
>;

type DecorColorKey = "accent" | "accent2";

/** Radialer Verlauf, Koordinaten relativ zur Seite (0..1) */
export interface DecorGlow {
  cx: number;
  cy: number;
  r: number;
  color: DecorColorKey;
  opacity: number;
}

export interface DecorMeshNode {
  cx: number;
  cy: number;
  r: number;
}

export interface DecorMeshEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Hero-Geflecht: Knoten in accent, Kanten in accent2 (wie im Hero) */
export interface DecorMesh {
  nodes: DecorMeshNode[];
  edges: DecorMeshEdge[];
  nodeColor: DecorColorKey;
  edgeColor: DecorColorKey;
  nodeOpacity: number;
  edgeOpacity: number;
}

export interface CertificateDecor {
  width: number;
  height: number;
  glows: DecorGlow[];
  mesh: DecorMesh;
}

/** Gleicher LCG wie im Hero (Constellation.tsx) – deterministisch. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const MESH_COUNT = 120;
/** Verhältnis wie im Hero: LINK_DISTANCE 1.1 zu RADIUS 3.2 */
const LINK_RATIO = 1.1 / 3.2;

const round = (n: number) => Math.round(n * 10) / 10;

export function certificateDecor(
  orientation: CertificateOrientationId
): CertificateDecor {
  const { width, height } = CERTIFICATE_PAGE_SIZES[orientation];

  // Kugel-Geflecht unten rechts, läuft über den Seitenrand hinaus
  const rand = seededRandom(42);
  const radius = Math.min(width, height) * 0.46;
  const centerX = width * 0.88;
  const centerY = height * 0.8;

  const points: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < MESH_COUNT; i++) {
    // Punkte auf einer leicht abgeflachten Kugelschale (wie im Hero)
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = radius * (0.75 + rand() * 0.35);
    points.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.cos(phi) * 0.72,
      z: r * Math.sin(phi) * Math.sin(theta),
    });
  }

  // Orthografische Projektion; z steuert die Punktgröße (Tiefenwirkung)
  const nodes: DecorMeshNode[] = points.map((p) => ({
    cx: round(centerX + p.x),
    cy: round(centerY + p.y),
    r: round(0.8 + (p.z / radius + 1) * 0.5),
  }));

  const linkDistance = radius * LINK_RATIO;
  const edges: DecorMeshEdge[] = [];
  for (let i = 0; i < MESH_COUNT; i++) {
    for (let j = i + 1; j < MESH_COUNT; j++) {
      const a = points[i];
      const b = points[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (distance < linkDistance) {
        edges.push({
          x1: nodes[i].cx,
          y1: nodes[i].cy,
          x2: nodes[j].cx,
          y2: nodes[j].cy,
        });
      }
    }
  }

  return {
    width,
    height,
    glows: [
      { cx: 0.85, cy: 0.05, r: 0.75, color: "accent2", opacity: 0.16 },
      { cx: 0.08, cy: 0.98, r: 0.65, color: "accent", opacity: 0.1 },
    ],
    mesh: {
      nodes,
      edges,
      nodeColor: "accent",
      edgeColor: "accent2",
      nodeOpacity: 0.5,
      edgeOpacity: 0.16,
    },
  };
}
