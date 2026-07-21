import { describe, expect, it } from "vitest";
import { CERTIFICATE_PAGE_SIZES, certificateDecor } from "./decor";
import { CERTIFICATE_ORIENTATIONS } from "./theme";

describe("CERTIFICATE_PAGE_SIZES", () => {
  it("entspricht A4 in Punkten, quer und hoch", () => {
    expect(CERTIFICATE_PAGE_SIZES.landscape).toEqual({
      width: 842,
      height: 595,
    });
    expect(CERTIFICATE_PAGE_SIZES.portrait).toEqual({
      width: 595,
      height: 842,
    });
  });
});

describe("certificateDecor", () => {
  for (const orientation of CERTIFICATE_ORIENTATIONS) {
    describe(orientation, () => {
      const decor = certificateDecor(orientation);
      const { width, height } = CERTIFICATE_PAGE_SIZES[orientation];

      it("übernimmt die Seitenmaße", () => {
        expect(decor.width).toBe(width);
        expect(decor.height).toBe(height);
      });

      it("liefert Verläufe und ein dichtes Geflecht", () => {
        expect(decor.glows.length).toBeGreaterThan(0);
        expect(decor.mesh.nodes.length).toBeGreaterThan(50);
        expect(decor.mesh.edges.length).toBeGreaterThan(20);
      });

      it("Kanten verbinden ausschließlich vorhandene Knoten", () => {
        const positions = new Set(
          decor.mesh.nodes.map((n) => `${n.cx},${n.cy}`)
        );
        for (const edge of decor.mesh.edges) {
          expect(positions.has(`${edge.x1},${edge.y1}`)).toBe(true);
          expect(positions.has(`${edge.x2},${edge.y2}`)).toBe(true);
        }
      });

      it("verankert das Geflecht unten rechts", () => {
        const meanX =
          decor.mesh.nodes.reduce((s, n) => s + n.cx, 0) /
          decor.mesh.nodes.length;
        const meanY =
          decor.mesh.nodes.reduce((s, n) => s + n.cy, 0) /
          decor.mesh.nodes.length;
        expect(meanX).toBeGreaterThan(width * 0.6);
        expect(meanY).toBeGreaterThan(height * 0.55);
      });

      it("nutzt Hero-Farben (Knoten accent, Kanten accent2) dezent", () => {
        expect(decor.mesh.nodeColor).toBe("accent");
        expect(decor.mesh.edgeColor).toBe("accent2");
        expect(decor.mesh.edgeOpacity).toBeGreaterThan(0);
        expect(decor.mesh.edgeOpacity).toBeLessThanOrEqual(0.3);
        expect(decor.mesh.nodeOpacity).toBeGreaterThan(0);
        expect(decor.mesh.nodeOpacity).toBeLessThanOrEqual(0.6);
        for (const glow of decor.glows) {
          expect(["accent", "accent2"]).toContain(glow.color);
          expect(glow.opacity).toBeGreaterThan(0);
          expect(glow.opacity).toBeLessThanOrEqual(0.2);
        }
      });

      it("ist deterministisch (Seed 42 wie im Hero)", () => {
        expect(certificateDecor(orientation)).toEqual(decor);
      });
    });
  }

  it("quer und hoch unterscheiden sich in der Geometrie", () => {
    const landscape = certificateDecor("landscape");
    const portrait = certificateDecor("portrait");
    expect(landscape.width).not.toBe(portrait.width);
    expect(landscape.mesh.nodes[0]).not.toEqual(portrait.mesh.nodes[0]);
  });
});
