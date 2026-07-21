import { db } from "@/lib/db";
import { splitInputTokens, type AiActivity } from "@elearning/core/ai-usage";

/**
 * IO-Hülle des KI-Verbrauchsprotokolls: schreibt einen AiUsage-Datensatz
 * je Aufruf. Fire-and-forget – Tracking darf nie ein Feature blockieren.
 */
export interface RecordAiUsageInput {
  activity: AiActivity;
  model: string;
  /** vom Anbieter gemeldete Tokens (bzw. Schätzung, z. B. TTS) */
  inputTokens?: number;
  outputTokens?: number;
  /** Audio-Sekunden für minutenbasierte Preise */
  audioSeconds?: number;
  /** Zeichenlängen zur System/User-Aufteilung der Input-Tokens */
  systemChars?: number;
  userChars?: number;
  userId?: string | null;
  courseId?: string | null;
}

export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  try {
    const inputTokens = Math.max(0, Math.round(input.inputTokens ?? 0));
    const split = splitInputTokens(
      inputTokens,
      input.systemChars ?? 0,
      input.userChars ?? 0
    );
    await db.aiUsage.create({
      data: {
        activity: input.activity,
        model: input.model,
        inputTokens,
        systemTokens: split.systemTokens,
        userTokens: split.userTokens,
        outputTokens: Math.max(0, Math.round(input.outputTokens ?? 0)),
        audioSeconds: Math.max(0, input.audioSeconds ?? 0),
        userId: input.userId ?? null,
        courseId: input.courseId ?? null,
      },
    });
  } catch (error) {
    console.error("[ai-usage] Tracking fehlgeschlagen:", error);
  }
}
