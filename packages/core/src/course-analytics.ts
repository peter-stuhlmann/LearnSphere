/**
 * Per-course analytics: pure aggregations for the creator's course
 * statistics page (lesson funnel, quiz pass rates, video retention).
 */

export interface FunnelLessonInput {
  lessonId: string;
  title: string;
}

export interface FunnelProgressRow {
  lessonId: string;
  watchedSeconds: number;
  completed: boolean;
}

export interface FunnelStep {
  lessonId: string;
  title: string;
  /** learners who opened the lesson (any watched seconds or completed) */
  started: number;
  /** learners who finished the lesson */
  completed: number;
  /** completed / enrolled (0..100) */
  completionPercent: number;
}

/**
 * Lesson funnel in course order: how many enrolled learners started and
 * completed each lesson. The drop between neighbouring steps shows where
 * learners quit the course.
 */
export function lessonFunnel(
  lessons: FunnelLessonInput[],
  progress: FunnelProgressRow[],
  enrolledCount: number
): FunnelStep[] {
  return lessons.map((lesson) => {
    const rows = progress.filter((row) => row.lessonId === lesson.lessonId);
    const started = rows.filter(
      (row) => row.completed || row.watchedSeconds > 0
    ).length;
    const completed = rows.filter((row) => row.completed).length;
    return {
      lessonId: lesson.lessonId,
      title: lesson.title,
      started,
      completed,
      completionPercent:
        enrolledCount > 0
          ? Math.round((completed / enrolledCount) * 100)
          : 0,
    };
  });
}

export interface QuizAttemptRow {
  quizId: string;
  enrollmentId: string;
  scorePercent: number;
  passed: boolean;
}

export interface QuizStats {
  quizId: string;
  attempts: number;
  /** distinct learners who tried the quiz */
  participants: number;
  /** distinct learners who passed at least once */
  passedParticipants: number;
  /** passedParticipants / participants (0..100) */
  passRatePercent: number;
  /** mean of each participant's best score (0..100) */
  averageBestScore: number;
}

/** Pass rates and average best scores per quiz. */
export function quizPassStats(
  quizIds: string[],
  attempts: QuizAttemptRow[]
): QuizStats[] {
  return quizIds.map((quizId) => {
    const rows = attempts.filter((attempt) => attempt.quizId === quizId);
    const byParticipant = new Map<string, { best: number; passed: boolean }>();
    for (const row of rows) {
      const entry = byParticipant.get(row.enrollmentId) ?? {
        best: 0,
        passed: false,
      };
      entry.best = Math.max(entry.best, row.scorePercent);
      entry.passed = entry.passed || row.passed;
      byParticipant.set(row.enrollmentId, entry);
    }
    const participants = byParticipant.size;
    const passedParticipants = [...byParticipant.values()].filter(
      (entry) => entry.passed
    ).length;
    const bestScores = [...byParticipant.values()].map((entry) => entry.best);
    return {
      quizId,
      attempts: rows.length,
      participants,
      passedParticipants,
      passRatePercent:
        participants > 0
          ? Math.round((passedParticipants / participants) * 100)
          : 0,
      averageBestScore:
        participants > 0
          ? Math.round(
              (bestScores.reduce((sum, score) => sum + score, 0) /
                participants) *
                10
            ) / 10
          : 0,
    };
  });
}

/**
 * Retention curve of a media block from its watch buckets: views per bucket
 * relative to the maximum (0..1). Empty when nothing was watched yet.
 */
export function retentionCurve(
  buckets: { bucket: number; views: number }[],
  bucketCount: number
): number[] | null {
  const max = Math.max(0, ...buckets.map((row) => row.views));
  if (max === 0) return null;
  const curve = new Array<number>(bucketCount).fill(0);
  for (const row of buckets) {
    if (row.bucket >= 0 && row.bucket < bucketCount) {
      curve[row.bucket] = row.views / max;
    }
  }
  return curve;
}

export interface DropPoint {
  /** bucket index where most viewers quit (start of the drop) */
  bucket: number;
  /** share of viewers lost at this point (0..1) */
  drop: number;
}

/**
 * Biggest audience drop within a retention curve – the moment where most
 * viewers quit. Returns null for flat curves (no meaningful drop).
 */
export function biggestDrop(curve: number[]): DropPoint | null {
  let best: DropPoint | null = null;
  for (let i = 1; i < curve.length; i += 1) {
    const drop = curve[i - 1] - curve[i];
    if (drop > 0 && (best === null || drop > best.drop)) {
      best = { bucket: i - 1, drop };
    }
  }
  return best && best.drop >= 0.1 ? best : null;
}
