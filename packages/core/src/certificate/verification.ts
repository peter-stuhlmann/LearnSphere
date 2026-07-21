/**
 * Öffentliche Zertifikatsprüfung: fasst die Zwischenprüfungen einer
 * Einschreibung zusammen – beste Quote und Abschlussdatum (frühester
 * bestandener Versuch) je Prüfung. Pure Funktion, damit die
 * Verifikations-Seite testbar bleibt.
 */

export interface VerificationQuiz {
  id: string;
  title: string;
  kind: "SECTION" | "FINAL";
  passPercent: number;
}

export interface VerificationAttempt {
  quizId: string;
  scorePercent: number;
  passed: boolean;
  createdAt: Date;
}

export interface SectionExamResult {
  quizId: string;
  title: string;
  passPercent: number;
  /** Beste erreichte Quote über alle Versuche; null = nie angetreten */
  bestScorePercent: number | null;
  /** Frühester bestandener Versuch; null = (noch) nicht bestanden */
  passedAt: Date | null;
  passed: boolean;
}

export function sectionExamResults(
  quizzes: VerificationQuiz[],
  attempts: VerificationAttempt[]
): SectionExamResult[] {
  return quizzes
    .filter((quiz) => quiz.kind === "SECTION")
    .map((quiz) => {
      const own = attempts.filter((a) => a.quizId === quiz.id);
      const bestScorePercent = own.length
        ? Math.max(...own.map((a) => a.scorePercent))
        : null;
      const passedAttempts = own
        .filter((a) => a.passed)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return {
        quizId: quiz.id,
        title: quiz.title,
        passPercent: quiz.passPercent,
        bestScorePercent,
        passedAt: passedAttempts[0]?.createdAt ?? null,
        passed: passedAttempts.length > 0,
      };
    });
}
