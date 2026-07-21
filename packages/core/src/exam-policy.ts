export interface QuizAttemptRecord {
  createdAt: Date;
  passed: boolean;
}

export interface QuizAttemptPolicy {
  /** null = unbegrenzt viele Versuche */
  maxAttempts: number | null;
  /** null = maxAttempts zählt alle Versuche; sonst rollierendes Fenster in Stunden */
  attemptWindowHours: number | null;
  /** darf eine bereits bestandene Prüfung erneut abgelegt werden? */
  retakeAfterPass: boolean;
}

export type AttemptDecision =
  | { allowed: true }
  | { allowed: false; reason: "already_passed" | "attempts_exhausted" }
  | { allowed: false; reason: "cooldown"; nextAttemptAt: Date };

/**
 * Entscheidet, ob ein weiterer Prüfungsversuch erlaubt ist.
 *
 * - retakeAfterPass=false: nach dem Bestehen ist Schluss.
 * - maxAttempts ohne Fenster: harte Obergrenze über alle Versuche.
 * - maxAttempts mit Fenster: höchstens maxAttempts Versuche innerhalb der
 *   letzten attemptWindowHours Stunden; danach gibt nextAttemptAt an, wann
 *   der älteste gezählte Versuch aus dem Fenster fällt.
 */
export function canAttemptQuiz(input: {
  attempts: QuizAttemptRecord[];
  policy: QuizAttemptPolicy;
  now: Date;
}): AttemptDecision {
  const { attempts, policy, now } = input;

  if (!policy.retakeAfterPass && attempts.some((a) => a.passed)) {
    return { allowed: false, reason: "already_passed" };
  }

  if (policy.maxAttempts === null) {
    return { allowed: true };
  }

  if (policy.attemptWindowHours === null) {
    return attempts.length >= policy.maxAttempts
      ? { allowed: false, reason: "attempts_exhausted" }
      : { allowed: true };
  }

  const windowMs = policy.attemptWindowHours * 3_600_000;
  const windowStart = now.getTime() - windowMs;
  const inWindow = attempts
    .filter((a) => a.createdAt.getTime() > windowStart)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (inWindow.length < policy.maxAttempts) {
    return { allowed: true };
  }

  const oldest = inWindow[0];
  return {
    allowed: false,
    reason: "cooldown",
    nextAttemptAt: new Date(oldest.createdAt.getTime() + windowMs),
  };
}
