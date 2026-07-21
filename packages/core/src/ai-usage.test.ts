import { describe, expect, it } from "vitest";
import {
  AI_ACTIVITIES,
  AI_MODEL_PRICES,
  AI_PRICES_AS_OF,
  formatUsd,
  groupUsage,
  isAiActivity,
  splitInputTokens,
  stackedDailySeries,
  topGroupsWithRest,
  totalsFor,
  usageCostUsd,
  type AiUsageRow,
} from "./ai-usage";

function row(partial: Partial<AiUsageRow>): AiUsageRow {
  return {
    createdAt: new Date("2026-07-10T12:00:00Z"),
    activity: "ASSISTANT",
    model: "gpt-4o-mini",
    inputTokens: 0,
    systemTokens: 0,
    userTokens: 0,
    outputTokens: 0,
    audioSeconds: 0,
    userId: null,
    ...partial,
  };
}

describe("Preistabelle", () => {
  it("hat ein Stand-Datum und Preise für alle genutzten Modelle", () => {
    expect(AI_PRICES_AS_OF).toBe("2026-07-13");
    for (const model of [
      "gpt-4o-mini",
      "gpt-4o-mini-tts",
      "whisper-1",
      "gpt-4o-transcribe-diarize",
      "text-embedding-3-small",
      "claude-haiku-4-5-20251001",
    ]) {
      expect(AI_MODEL_PRICES[model]).toBeDefined();
    }
  });
});

describe("usageCostUsd", () => {
  it("rechnet Token-Preise je 1 Mio. ab", () => {
    // gpt-4o-mini: $0.15/1M Input + $0.60/1M Output
    const cost = usageCostUsd(
      row({ inputTokens: 1_000_000, outputTokens: 1_000_000 })
    );
    expect(cost).toBeCloseTo(0.75, 6);
  });

  it("rechnet Audio-Minuten ab (Whisper)", () => {
    const cost = usageCostUsd(
      row({ model: "whisper-1", activity: "TRANSCRIBE_AUDIO", audioSeconds: 600 })
    );
    expect(cost).toBeCloseTo(0.06, 6); // 10 min × $0.006
  });

  it("kombiniert Tokens und Audio (TTS)", () => {
    const cost = usageCostUsd(
      row({
        model: "gpt-4o-mini-tts",
        activity: "TTS",
        inputTokens: 1_000_000,
        audioSeconds: 60,
      })
    );
    expect(cost).toBeCloseTo(0.6 + 0.015, 6);
  });

  it("unbekanntes Modell → 0 (statt falscher Zahlen)", () => {
    expect(usageCostUsd(row({ model: "mystery-9000", inputTokens: 5000 }))).toBe(0);
  });
});

describe("splitInputTokens", () => {
  it("teilt anteilig nach Prompt-Zeichen, Summe bleibt exakt", () => {
    const split = splitInputTokens(1000, 300, 700);
    expect(split.systemTokens + split.userTokens).toBe(1000);
    expect(split.systemTokens).toBe(300);
  });

  it("ohne Zeichenangaben zählt alles als User-Anteil", () => {
    expect(splitInputTokens(500, 0, 0)).toEqual({
      systemTokens: 0,
      userTokens: 500,
    });
  });

  it("rundet ohne Verlust", () => {
    const split = splitInputTokens(10, 1, 2);
    expect(split.systemTokens + split.userTokens).toBe(10);
  });
});

describe("totalsFor / groupUsage", () => {
  const rows = [
    row({ inputTokens: 100, systemTokens: 40, userTokens: 60, outputTokens: 50 }),
    row({
      activity: "TRANSLATE",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 200,
      systemTokens: 50,
      userTokens: 150,
      outputTokens: 100,
    }),
  ];

  it("summiert Tokens, Aufrufe und Kosten", () => {
    const totals = totalsFor(rows);
    expect(totals.calls).toBe(2);
    expect(totals.inputTokens).toBe(300);
    expect(totals.systemTokens).toBe(90);
    expect(totals.userTokens).toBe(210);
    expect(totals.outputTokens).toBe(150);
    expect(totals.costUsd).toBeCloseTo(
      usageCostUsd(rows[0]) + usageCostUsd(rows[1]),
      9
    );
  });

  it("gruppiert nach Schlüssel, sortiert nach Kosten", () => {
    const groups = groupUsage(rows, (r) => r.activity);
    expect(groups.map((g) => g.key)).toEqual(["TRANSLATE", "ASSISTANT"]);
    expect(groups[0].totals.calls).toBe(1);
  });

  it("bei Kostengleichstand entscheidet das Tokenvolumen", () => {
    // unbekanntes Modell → beide Gruppen kosten 0 USD
    const free = [
      row({ activity: "TTS", model: "unbekannt", inputTokens: 10 }),
      row({ activity: "GRADING", model: "unbekannt", inputTokens: 500 }),
    ];
    const groups = groupUsage(free, (r) => r.activity);
    expect(groups.map((g) => g.key)).toEqual(["GRADING", "TTS"]);
  });
});

describe("topGroupsWithRest", () => {
  it("fasst alles ab Platz n als Rest zusammen", () => {
    const rows = ["a", "a", "b", "c", "d"].map((k, i) =>
      row({ activity: k, inputTokens: (5 - i) * 100 })
    );
    const groups = groupUsage(rows, (r) => r.activity);
    const top = topGroupsWithRest(groups, 2, "Rest");
    expect(top).toHaveLength(3);
    expect(top[2].key).toBe("Rest");
    expect(top[2].totals.calls).toBe(2);
  });

  it("lässt kurze Listen unverändert", () => {
    const groups = groupUsage([row({})], (r) => r.activity);
    expect(topGroupsWithRest(groups, 5, "Rest")).toHaveLength(1);
  });
});

describe("stackedDailySeries", () => {
  const from = new Date("2026-07-01T00:00:00Z");
  const rows = [
    row({ createdAt: new Date("2026-07-01T08:00:00Z"), inputTokens: 10, outputTokens: 5 }),
    row({ createdAt: new Date("2026-07-01T22:00:00Z"), inputTokens: 20 }),
    row({
      createdAt: new Date("2026-07-03T02:00:00Z"),
      activity: "TTS",
      model: "gpt-4o-mini-tts",
      inputTokens: 40,
    }),
  ];

  it("füllt alle Tage und stapelt je Schlüssel", () => {
    const chart = stackedDailySeries(rows, from, 3, {
      keyOf: (r) => r.activity,
      valueOf: (r) => r.inputTokens + r.outputTokens,
    });
    expect(chart.labels).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
    expect(chart.series.ASSISTANT).toEqual([35, 0, 0]);
    expect(chart.series.TTS).toEqual([0, 0, 40]);
    // Schlüssel nach Gesamtvolumen sortiert
    expect(chart.keys).toEqual(["TTS", "ASSISTANT"]);
  });

  it("ignoriert Zeilen außerhalb des Fensters", () => {
    const chart = stackedDailySeries(rows, from, 2, {
      keyOf: (r) => r.activity,
      valueOf: (r) => r.inputTokens,
    });
    expect(chart.labels).toHaveLength(2);
    expect(chart.series.TTS).toBeUndefined();
  });
});

describe("formatUsd", () => {
  it("zeigt kleine Beträge mit mehr Nachkommastellen", () => {
    expect(formatUsd(12.3456)).toBe("$12.35");
    expect(formatUsd(0.0042)).toBe("$0.0042");
    expect(formatUsd(0)).toBe("$0.00");
  });
});

describe("AI_ACTIVITIES", () => {
  it("deckt alle instrumentierten Aktivitäten ab", () => {
    for (const activity of [
      "ASSISTANT",
      "SELF_TEST",
      "TRANSCRIBE_AUDIO",
      "TRANSCRIBE_VIDEO",
      "TRANSLATE",
      "TTS",
      "GRADING",
      "COPILOT",
      "CHAPTERS",
      "EMBEDDING",
    ]) {
      expect(AI_ACTIVITIES).toContain(activity);
    }
  });

  it("isAiActivity erkennt bekannte und lehnt fremde Werte ab", () => {
    expect(isAiActivity("ASSISTANT")).toBe(true);
    expect(isAiActivity("EMBEDDING")).toBe(true);
    expect(isAiActivity("BITCOIN_MINING")).toBe(false);
    expect(isAiActivity("")).toBe(false);
  });
});
