export interface GradableOption {
  id: string;
  isCorrect: boolean;
}

export interface GradableQuestion {
  id: string;
  kind: "SINGLE" | "MULTIPLE" | "FREE_TEXT";
  options: GradableOption[];
  /** Gewichtung der Frage; fehlend/ungültig zählt als 1 */
  points?: number;
  /** Freitext: Musterlösung bzw. exakt erwartete Antwort */
  expectedAnswer?: string | null;
  /** Freitext: true = KI-Urteil verwenden (Fallback: exakter Vergleich) */
  aiGraded?: boolean;
}

export interface QuizResult {
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  earnedPoints: number;
  totalPoints: number;
  perQuestion: { questionId: string; correct: boolean; points: number }[];
}

/** Gewichtung normalisieren: ganzzahlig, mindestens 1. */
function questionPoints(question: GradableQuestion): number {
  const points = Math.round(question.points ?? 1);
  return points >= 1 ? points : 1;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

/** Vergleichsform für Freitext: getrimmt, Whitespace kollabiert, lowercase. */
export function normalizeFreeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function gradeFreeText(
  question: GradableQuestion,
  answer: string,
  aiVerdicts: Record<string, boolean>
): boolean {
  // KI-Urteil hat Vorrang; ohne Urteil (KI aus/nicht erreichbar) exakt prüfen
  if (question.aiGraded && question.id in aiVerdicts) {
    return aiVerdicts[question.id];
  }
  if (!question.expectedAnswer) return false;
  return (
    normalizeFreeText(answer) === normalizeFreeText(question.expectedAnswer)
  );
}

/**
 * Grades a quiz. A choice question counts as correct only when the selected
 * option set matches the correct option set exactly (no partial credit).
 * Free-text questions match the expected answer exactly or use the AI verdict.
 */
export function gradeQuiz(
  questions: GradableQuestion[],
  answers: Record<string, string[]>,
  aiVerdicts: Record<string, boolean> = {}
): QuizResult {
  const perQuestion = questions.map((question) => {
    const points = questionPoints(question);
    if (question.kind === "FREE_TEXT") {
      const answer = (answers[question.id] ?? [])[0] ?? "";
      return {
        questionId: question.id,
        correct: gradeFreeText(question, answer, aiVerdicts),
        points,
      };
    }
    const correctIds = new Set(
      question.options.filter((o) => o.isCorrect).map((o) => o.id)
    );
    const selectedIds = new Set(answers[question.id] ?? []);
    return {
      questionId: question.id,
      correct: setsEqual(correctIds, selectedIds),
      points,
    };
  });

  const correctCount = perQuestion.filter((q) => q.correct).length;
  const totalCount = questions.length;
  // Quote nach Punkten gewichtet – Fragen ohne Angabe zählen 1 Punkt
  const totalPoints = perQuestion.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = perQuestion.reduce(
    (sum, q) => sum + (q.correct ? q.points : 0),
    0
  );
  const scorePercent =
    totalPoints === 0
      ? 100
      : Math.round((earnedPoints / totalPoints) * 10000) / 100;

  return {
    scorePercent,
    correctCount,
    totalCount,
    earnedPoints,
    totalPoints,
    perQuestion,
  };
}

export function hasPassed(scorePercent: number, passPercent: number): boolean {
  return scorePercent >= passPercent;
}
