/**
 * Prüfungen fürs Veröffentlichen eines Kurses. Speichern hat keine Pflichtfelder
 * (ein Entwurf darf unvollständig sein) – erst beim Veröffentlichen wird geprüft.
 *
 * Blocker verhindern das Veröffentlichen; Warnungen nicht, sollten dem Creator
 * aber angezeigt werden (er darf trotzdem veröffentlichen). Reine Logik (TDD).
 */

export const PUBLISH_MIN_DESCRIPTION_WORDS = 50;

export type PublishBlocker = "title" | "description" | "category" | "finalExam";
export type PublishWarning = "coverImage" | "subtitle" | "tags";

/** Wörter zählen; HTML (Rich-Text-Beschreibung) wird vorher entfernt. */
export function countWords(text: string): number {
  const plain = (text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim();
  return plain ? plain.split(/\s+/).length : 0;
}

export interface ExamQuestionLike {
  /** "SINGLE" | "MULTIPLE" | "FREE_TEXT" */
  kind: string;
  /** Anzahl als richtig markierter Antwortoptionen */
  correctOptionCount: number;
  /** Freitext: erwartete Musterlösung */
  expectedAnswer?: string | null;
  /** Freitext: von KI sinngemäß bewertet */
  aiGraded?: boolean;
}

/**
 * Frage ist gültig = hat mindestens eine richtige Antwort. Single/Multiple:
 * ≥1 als korrekt markierte Option. Freitext: KI-bewertet oder mit Musterlösung.
 */
export function isValidExamQuestion(question: ExamQuestionLike): boolean {
  if (question.kind === "FREE_TEXT") {
    return (
      Boolean(question.aiGraded) ||
      Boolean(question.expectedAnswer && question.expectedAnswer.trim())
    );
  }
  return question.correctOptionCount >= 1;
}

/** Gibt es unter den Fragen mindestens eine gültige? */
export function examHasValidQuestion(questions: ExamQuestionLike[]): boolean {
  return questions.some(isValidExamQuestion);
}

export interface PublishCheckInput {
  title: string;
  /** Beschreibung (Rich-Text/HTML) – Wortzahl wird geprüft */
  description: string;
  category: string | null;
  finalExamRequired: boolean;
  /** true = es existiert eine FINAL-Prüfung mit ≥1 gültigen Frage */
  hasValidFinalExam: boolean;
  coverImage: string | null;
  subtitle: string | null;
  tagCount: number;
}

export interface PublishCheck {
  blockers: PublishBlocker[];
  warnings: PublishWarning[];
}

/** Kurs auf Veröffentlichungs-Reife prüfen (Blocker + Warnungen). */
export function checkCoursePublish(input: PublishCheckInput): PublishCheck {
  const blockers: PublishBlocker[] = [];
  if (!input.title.trim()) blockers.push("title");
  if (countWords(input.description) < PUBLISH_MIN_DESCRIPTION_WORDS) {
    blockers.push("description");
  }
  if (!input.category || !input.category.trim()) blockers.push("category");
  if (input.finalExamRequired && !input.hasValidFinalExam) {
    blockers.push("finalExam");
  }

  const warnings: PublishWarning[] = [];
  if (!input.coverImage) warnings.push("coverImage");
  if (!input.subtitle || !input.subtitle.trim()) warnings.push("subtitle");
  if (input.tagCount === 0) warnings.push("tags");

  return { blockers, warnings };
}
