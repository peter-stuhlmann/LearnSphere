import { describe, expect, it } from "vitest";
import {
  CONTENT_PROVENANCES,
  isAiGenerated,
  parseProvenance,
  provenanceAfterEdit,
} from "./provenance";

describe("parseProvenance", () => {
  it("akzeptiert alle bekannten Stufen", () => {
    for (const provenance of CONTENT_PROVENANCES) {
      expect(parseProvenance(provenance)).toBe(provenance);
    }
  });

  it("fällt bei Unbekanntem auf HUMAN zurück", () => {
    expect(parseProvenance(undefined)).toBe("HUMAN");
    expect(parseProvenance(null)).toBe("HUMAN");
    expect(parseProvenance("ROBOT")).toBe("HUMAN");
    expect(parseProvenance(42)).toBe("HUMAN");
  });
});

describe("provenanceAfterEdit", () => {
  it("stuft bearbeitete KI-Inhalte auf AI_EDITED um", () => {
    expect(provenanceAfterEdit("AI")).toBe("AI_EDITED");
    expect(provenanceAfterEdit("AI_REVIEWED")).toBe("AI_EDITED");
  });

  it("lässt menschliche Herkunft und AI_EDITED unverändert", () => {
    expect(provenanceAfterEdit("HUMAN")).toBe("HUMAN");
    expect(provenanceAfterEdit("HUMAN_AI_ASSISTED")).toBe("HUMAN_AI_ASSISTED");
    expect(provenanceAfterEdit("AI_EDITED")).toBe("AI_EDITED");
  });
});

describe("isAiGenerated", () => {
  it("markiert die KI-Familie maschinenlesbar", () => {
    expect(isAiGenerated("AI")).toBe(true);
    expect(isAiGenerated("AI_EDITED")).toBe(true);
    expect(isAiGenerated("AI_REVIEWED")).toBe(true);
    expect(isAiGenerated("HUMAN")).toBe(false);
    expect(isAiGenerated("HUMAN_AI_ASSISTED")).toBe(false);
  });
});
