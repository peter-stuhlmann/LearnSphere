import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const execFileAsync = promisify(execFile);

/**
 * Automatische Inhaltsprüfung von Uploads über die OpenAI Moderation API
 * (kostenlos, für genau diesen Zweck gedacht). Geprüft wird auf FSK-18-
 * und Hass-/Extremismus-Inhalte; Treffer blockieren die Veröffentlichung
 * (Publish-Gate) und landen in der Admin-Review-Liste.
 *
 * Fail-open bei technischen Fehlern: Ein API-Ausfall darf Uploads nicht
 * lahmlegen – ungeprüfte Inhalte kann der Admin jederzeit manuell flaggen.
 */

export function isModerationEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Kategorien, die wir blocken – mit menschenlesbaren Begründungen. */
const BLOCKED_CATEGORIES: Record<string, string> = {
  sexual: "Sexuelle/FSK-18-Inhalte",
  "sexual/minors": "Sexuelle Inhalte mit Minderjährigen",
  hate: "Hass/rassistische Inhalte",
  "hate/threatening": "Hass mit Gewaltandrohung",
  "harassment/threatening": "Bedrohung/Einschüchterung",
  violence: "Gewaltdarstellung",
  "violence/graphic": "Drastische Gewaltdarstellung",
};

export interface ModerationVerdict {
  flagged: boolean;
  /** kurze Begründung (deutsche Kategorie-Labels, kommagetrennt) */
  reason: string;
  /** getroffene Roh-Kategorien fürs Audit */
  categories: string[];
}

const CLEAN: ModerationVerdict = { flagged: false, reason: "", categories: [] };

type ModerationInput =
  | string
  | { type: "image_url"; image_url: { url: string } };

/** Ein Batch an die Moderation API; null bei technischem Fehler. */
async function callModerationApi(
  inputs: ModerationInput[]
): Promise<ModerationVerdict | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || inputs.length === 0) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: inputs }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      console.error(
        "[moderation] API-Fehler:",
        response.status,
        (await response.text()).slice(0, 300)
      );
      return null;
    }
    const body = (await response.json()) as {
      results?: { categories?: Record<string, boolean> }[];
    };

    const hit = new Set<string>();
    for (const result of body.results ?? []) {
      for (const [category, flagged] of Object.entries(
        result.categories ?? {}
      )) {
        if (flagged && category in BLOCKED_CATEGORIES) hit.add(category);
      }
    }
    if (hit.size === 0) return CLEAN;
    const categories = [...hit];
    return {
      flagged: true,
      reason: [...new Set(categories.map((c) => BLOCKED_CATEGORIES[c]))].join(
        ", "
      ),
      categories,
    };
  } catch (err) {
    console.error("[moderation] fehlgeschlagen:", err);
    return null;
  }
}

/**
 * Redaktionelle Texte beim Speichern prüfen (Titel, Beschreibungen,
 * Rich-Text-Blöcke, editierte Transkripte, Quiz-Fragen): HTML wird zu
 * Text vereinfacht, leere Teile fallen raus. Fail-open bei Fehlern.
 */
export async function moderateEditorialText(
  parts: (string | null | undefined)[]
): Promise<ModerationVerdict> {
  const text = parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replace(/<[^>]+>/g, " "))
    .join("\n")
    .trim();
  if (!text) return CLEAN;
  return moderateText(text);
}

/** Text prüfen (Transkripte, Beschreibungen). Fail-open bei Fehlern. */
export async function moderateText(text: string): Promise<ModerationVerdict> {
  const trimmed = text.trim();
  if (!trimmed) return CLEAN;
  // lange Texte in Stücken prüfen (API-Limit), erster Treffer reicht
  const chunks: string[] = [];
  for (let i = 0; i < trimmed.length && chunks.length < 10; i += 6_000) {
    chunks.push(trimmed.slice(i, i + 6_000));
  }
  return (await callModerationApi(chunks)) ?? CLEAN;
}

/** Deutsche Labels für die Kategorien des LLM-Bild-Klassifikators. */
const LLM_CATEGORY_LABELS: Record<string, string> = {
  extremism: "Extremistische/verfassungswidrige Symbolik",
  racism: "Rassistische Inhalte",
  sexual: "Sexuelle/FSK-18-Inhalte",
  violence: "Drastische Gewaltdarstellung",
};

/**
 * Zweite Prüfstufe für Bilder: Die OpenAI Moderation API erkennt in
 * Bildern nur Sexuelles/Gewalt/Selbstverletzung – Hass-SYMBOLIK
 * (Hakenkreuz, SS-Runen, …) nicht. Das übernimmt Claude als
 * Vision-Klassifikator. null bei technischem Fehler (fail-open).
 */
async function classifyImagesWithLlm(
  dataUrls: string[]
): Promise<ModerationVerdict | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || dataUrls.length === 0) return null;

  const content: unknown[] = [];
  for (const dataUrl of dataUrls.slice(0, 12)) {
    const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
    if (!match) continue;
    content.push({
      type: "image",
      source: { type: "base64", media_type: match[1], data: match[2] },
    });
  }
  if (content.length === 0) return null;
  content.push({
    type: "text",
    text: "Prüfe alle Bilder gemäß Systemanweisung. Antworte NUR mit dem JSON.",
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODERATION_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: `Du bist der Bild-Moderations-Klassifikator einer E-Learning-Plattform (Trust & Safety). Prüfe ALLE übergebenen Bilder auf diese Kategorien:
- "extremism": nationalsozialistische, rechtsextreme oder in Deutschland verfassungswidrige Symbole (z. B. Hakenkreuz, SS-Runen, Schwarze Sonne) – auch in historischen Aufnahmen; der Kontext wird anschließend manuell geprüft
- "racism": rassistische Darstellungen, Symbole oder Karikaturen
- "sexual": explizite sexuelle Inhalte (FSK 18)
- "violence": drastische Gewaltdarstellung
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt: {"flagged": boolean, "categories": string[], "reason": string} – reason ist ein kurzer deutscher Satz, categories nur aus den vier Schlüsseln. Kein Vor- oder Nachtext.`,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      console.error(
        "[moderation] LLM-Klassifikator-Fehler:",
        response.status,
        (await response.text()).slice(0, 300)
      );
      return null;
    }
    const body = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const raw = (body.content?.find((b) => b.type === "text")?.text ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const parsed = JSON.parse(raw) as {
      flagged?: boolean;
      categories?: string[];
      reason?: string;
    };
    if (!parsed.flagged) return CLEAN;
    const categories = (parsed.categories ?? []).filter(
      (c) => c in LLM_CATEGORY_LABELS
    );
    const labels = categories.map((c) => LLM_CATEGORY_LABELS[c]);
    return {
      flagged: true,
      reason:
        [...new Set(labels)].join(", ") ||
        parsed.reason?.slice(0, 200) ||
        "Auffälliger Bildinhalt",
      categories: categories.map((c) => `llm:${c}`),
    };
  } catch (err) {
    console.error("[moderation] LLM-Klassifikator fehlgeschlagen:", err);
    return null;
  }
}

/** Zwei Urteile zusammenführen (Union der Treffer). */
function mergeVerdicts(
  a: ModerationVerdict,
  b: ModerationVerdict
): ModerationVerdict {
  if (!a.flagged && !b.flagged) return CLEAN;
  return {
    flagged: true,
    reason: [
      ...new Set([a.reason, b.reason].filter(Boolean).join(", ").split(", ")),
    ].join(", "),
    categories: [...new Set([...a.categories, ...b.categories])],
  };
}

/**
 * Ein oder mehrere Bilder (Data-URLs) prüfen: OpenAI Moderation API
 * (sexuell/Gewalt) UND Claude-Vision (Hass-Symbolik) parallel; geflaggt
 * wird, wenn eine der Stufen anschlägt. Fail-open bei Fehlern.
 */
export async function moderateImages(
  dataUrls: string[]
): Promise<ModerationVerdict> {
  const inputs = dataUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));
  const [api, llm] = await Promise.all([
    callModerationApi(inputs),
    classifyImagesWithLlm(dataUrls),
  ]);
  return mergeVerdicts(api ?? CLEAN, llm ?? CLEAN);
}

export function imageBufferToDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/**
 * Keyframes eines Videos ziehen (1 Frame alle 30 s, max. 12) und prüfen.
 * Braucht ffmpeg (ffmpeg-static); ohne ffmpeg wird nichts geprüft.
 */
export async function moderateVideoFrames(
  ffmpegPath: string,
  videoPath: string
): Promise<ModerationVerdict> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ls-moderate-"));
  try {
    await execFileAsync(
      ffmpegPath,
      [
        "-i",
        videoPath,
        "-vf",
        "fps=1/30,scale=512:-1",
        "-frames:v",
        "12",
        "-q:v",
        "5",
        path.join(dir, "frame%03d.jpg"),
      ],
      { timeout: 300_000 }
    );
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg"));
    if (files.length === 0) return CLEAN;
    const dataUrls: string[] = [];
    for (const file of files) {
      dataUrls.push(
        imageBufferToDataUrl(await readFile(path.join(dir, file)), "image/jpeg")
      );
    }
    return await moderateImages(dataUrls);
  } catch (err) {
    console.error("[moderation] Keyframes fehlgeschlagen:", err);
    return CLEAN;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Prüf-Ergebnis für eine Upload-URL speichern/aktualisieren. */
export async function saveModerationResult(
  url: string,
  userId: string,
  kind: string,
  verdict: ModerationVerdict
): Promise<void> {
  const status = verdict.flagged ? "FLAGGED" : "APPROVED";
  await db.mediaModeration.upsert({
    where: { url },
    create: {
      url,
      userId,
      kind,
      status,
      reason: verdict.reason || null,
      categories: verdict.categories,
    },
    update: {
      // Freigegebenes nicht wieder freigeben müssen – aber neue Treffer
      // (z. B. Transkript nach Frames) verschärfen den Status
      ...(verdict.flagged
        ? {
            status,
            reason: verdict.reason,
            categories: verdict.categories,
            reviewedBy: null,
            reviewedAt: null,
          }
        : {}),
    },
  });
}
