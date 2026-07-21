/**
 * KI-Verbrauch: reine Logik für das Admin-Dashboard – Preistabelle,
 * Kostenrechnung, System/User-Aufteilung und Chart-Aggregation.
 * Das Schreiben der Datensätze übernimmt lib/ai-usage-server.ts.
 */

/** Stand der Preistabelle (Listenpreise der Anbieter, USD). */
export const AI_PRICES_AS_OF = "2026-07-13";

export interface ModelPrice {
  /** USD je 1 Mio. Input-Tokens */
  inputPerM: number;
  /** USD je 1 Mio. Output-Tokens */
  outputPerM: number;
  /** USD je Audio-Minute (Transkription bzw. TTS-Audioausgabe) */
  perAudioMinute?: number;
}

/**
 * Listenpreise der eingesetzten Modelle (Stand 13.07.2026):
 * - OpenAI gpt-4o-mini: $0.15 / $0.60 je 1 Mio. Tokens
 * - OpenAI gpt-4o-mini-tts: $0.60 je 1 Mio. Text-Tokens + ~$0.015/Audio-Minute
 * - OpenAI whisper-1: $0.006/Minute
 * - OpenAI gpt-4o-transcribe-diarize: ~$0.006/Minute (Audio-Tokens)
 * - OpenAI text-embedding-3-small: $0.02 je 1 Mio. Tokens
 * - Anthropic claude-haiku-4-5: $1.00 / $5.00 je 1 Mio. Tokens
 */
export const AI_MODEL_PRICES: Record<string, ModelPrice> = {
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "gpt-4o-mini-tts": { inputPerM: 0.6, outputPerM: 0, perAudioMinute: 0.015 },
  "whisper-1": { inputPerM: 0, outputPerM: 0, perAudioMinute: 0.006 },
  "gpt-4o-transcribe-diarize": {
    inputPerM: 0,
    outputPerM: 0,
    perAudioMinute: 0.006,
  },
  "text-embedding-3-small": { inputPerM: 0.02, outputPerM: 0 },
  "claude-haiku-4-5-20251001": { inputPerM: 1, outputPerM: 5 },
};

/** Aktivitäten, die KI-Aufrufe auslösen (Anzeige-Labels in messages). */
export const AI_ACTIVITIES = [
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
] as const;

export type AiActivity = (typeof AI_ACTIVITIES)[number];

export function isAiActivity(value: string): value is AiActivity {
  return (AI_ACTIVITIES as readonly string[]).includes(value);
}

export interface AiUsageRow {
  createdAt: Date;
  activity: string;
  model: string;
  inputTokens: number;
  systemTokens: number;
  userTokens: number;
  outputTokens: number;
  audioSeconds: number;
  userId?: string | null;
}

/** Geschätzte Kosten eines Aufrufs in USD; unbekannte Modelle zählen 0. */
export function usageCostUsd(row: AiUsageRow): number {
  const price = AI_MODEL_PRICES[row.model];
  if (!price) return 0;
  return (
    (row.inputTokens / 1_000_000) * price.inputPerM +
    (row.outputTokens / 1_000_000) * price.outputPerM +
    (row.audioSeconds / 60) * (price.perAudioMinute ?? 0)
  );
}

/**
 * System/User-Aufteilung der Input-Tokens schätzen: Die APIs melden nur die
 * Gesamtsumme, wir kennen aber die Zeichenlängen unserer Prompt-Teile –
 * anteilige Aufteilung, Summe bleibt exakt erhalten.
 */
export function splitInputTokens(
  inputTokens: number,
  systemChars: number,
  userChars: number
): { systemTokens: number; userTokens: number } {
  const totalChars = systemChars + userChars;
  if (totalChars <= 0) return { systemTokens: 0, userTokens: inputTokens };
  const systemTokens = Math.round((inputTokens * systemChars) / totalChars);
  return { systemTokens, userTokens: inputTokens - systemTokens };
}

/** "$12.35" bzw. für Kleinstbeträge "$0.0042" (4 Nachkommastellen). */
export function formatUsd(value: number): string {
  const decimals = value !== 0 && value < 0.01 ? 4 : 2;
  return `$${value.toFixed(decimals)}`;
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  systemTokens: number;
  userTokens: number;
  outputTokens: number;
  audioSeconds: number;
  costUsd: number;
}

export function totalsFor(rows: AiUsageRow[]): UsageTotals {
  const totals: UsageTotals = {
    calls: 0,
    inputTokens: 0,
    systemTokens: 0,
    userTokens: 0,
    outputTokens: 0,
    audioSeconds: 0,
    costUsd: 0,
  };
  for (const row of rows) {
    totals.calls += 1;
    totals.inputTokens += row.inputTokens;
    totals.systemTokens += row.systemTokens;
    totals.userTokens += row.userTokens;
    totals.outputTokens += row.outputTokens;
    totals.audioSeconds += row.audioSeconds;
    totals.costUsd += usageCostUsd(row);
  }
  return totals;
}

export interface UsageGroup {
  key: string;
  totals: UsageTotals;
}

/** Nach Schlüssel gruppieren, absteigend nach Kosten (dann Tokens). */
export function groupUsage(
  rows: AiUsageRow[],
  keyOf: (row: AiUsageRow) => string
): UsageGroup[] {
  const byKey = new Map<string, AiUsageRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  return [...byKey.entries()]
    .map(([key, groupRows]) => ({ key, totals: totalsFor(groupRows) }))
    .sort(
      (a, b) =>
        b.totals.costUsd - a.totals.costUsd ||
        b.totals.inputTokens +
          b.totals.outputTokens -
          (a.totals.inputTokens + a.totals.outputTokens)
    );
}

/** Top n behalten, den Rest zu einem Sammel-Eintrag zusammenfassen. */
export function topGroupsWithRest(
  groups: UsageGroup[],
  n: number,
  restLabel: string
): UsageGroup[] {
  if (groups.length <= n) return groups;
  const top = groups.slice(0, n);
  const rest = groups.slice(n);
  const totals: UsageTotals = {
    calls: 0,
    inputTokens: 0,
    systemTokens: 0,
    userTokens: 0,
    outputTokens: 0,
    audioSeconds: 0,
    costUsd: 0,
  };
  for (const group of rest) {
    totals.calls += group.totals.calls;
    totals.inputTokens += group.totals.inputTokens;
    totals.systemTokens += group.totals.systemTokens;
    totals.userTokens += group.totals.userTokens;
    totals.outputTokens += group.totals.outputTokens;
    totals.audioSeconds += group.totals.audioSeconds;
    totals.costUsd += group.totals.costUsd;
  }
  return [...top, { key: restLabel, totals }];
}

export interface StackedSeries {
  /** ISO-Datumslabels (UTC), lückenlos */
  labels: string[];
  /** Schlüssel absteigend nach Gesamtvolumen */
  keys: string[];
  series: Record<string, number[]>;
}

const DAY_MS = 86_400_000;

function dayLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Tagesreihe je Schlüssel (gestapelte Charts); fehlende Tage = 0. */
export function stackedDailySeries(
  rows: AiUsageRow[],
  from: Date,
  days: number,
  options: {
    keyOf: (row: AiUsageRow) => string;
    valueOf: (row: AiUsageRow) => number;
  }
): StackedSeries {
  const start = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate()
    )
  );
  const labels = Array.from({ length: days }, (_, i) =>
    dayLabel(new Date(start.getTime() + i * DAY_MS))
  );
  const indexByLabel = new Map(labels.map((label, i) => [label, i]));

  const series: Record<string, number[]> = {};
  const totalsByKey = new Map<string, number>();
  for (const row of rows) {
    const index = indexByLabel.get(dayLabel(row.createdAt));
    if (index === undefined) continue;
    const key = options.keyOf(row);
    const value = options.valueOf(row);
    if (!series[key]) series[key] = new Array<number>(days).fill(0);
    series[key][index] += value;
    totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + value);
  }

  const keys = [...totalsByKey.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  return { labels, keys, series };
}
