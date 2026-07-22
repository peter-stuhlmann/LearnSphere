/**
 * Wissensstand des Lernassistenten: Welcher Anteil des Kurses ist für ihn
 * überhaupt lesbar?
 *
 * Bei einem Videokurs IST das Transkript der gesamte Wissensstand. Ein Video
 * ohne Transkript ist für den Assistenten stumm – er sieht nur den Titel der
 * Lektion. Das fällt niemandem auf, weil der Assistent trotzdem antwortet,
 * nur eben ohne dieses Wissen. Deshalb wird die Lücke im Editor benannt,
 * statt sie still zu lassen.
 *
 * Reine Funktion – rechnet auf den Daten, die der Editor ohnehin hat.
 */

export interface CoverageBlock {
  type: string;
  title?: string;
  content?: string;
  transcriptDe?: string;
  transcriptEn?: string;
  /** Länge des Mediums; unbekannt (0) zählt als unbekannt, nicht als null */
  durationSeconds?: number;
}

export interface CoverageLesson {
  id: string;
  title: string;
  blocks: CoverageBlock[];
}

export interface CoverageSection {
  title: string;
  lessons: CoverageLesson[];
}

export interface CoverageGap {
  lessonId: string;
  sectionTitle: string;
  lessonTitle: string;
  /** Zahl der Medienblöcke ohne Transkript in dieser Lektion */
  blocks: number;
  /** Summe ihrer Spielzeit in Sekunden (0, wenn unbekannt) */
  seconds: number;
}

export interface CoverageReport {
  /** Medienblöcke insgesamt (Video/Audio) */
  mediaBlocks: number;
  /** davon mit Transkript in mindestens einer Sprache */
  withTranscript: number;
  /** Anteil 0..100; ohne Medien gilt der Kurs als vollständig erfasst */
  percent: number;
  /** Spielzeit ohne Transkript in Sekunden */
  missingSeconds: number;
  gaps: CoverageGap[];
}

const MEDIA_TYPES = new Set(["VIDEO", "AUDIO"]);

function hasTranscript(block: CoverageBlock): boolean {
  return Boolean(block.transcriptDe?.trim() || block.transcriptEn?.trim());
}

export function assistantCoverage(sections: CoverageSection[]): CoverageReport {
  let mediaBlocks = 0;
  let withTranscript = 0;
  let missingSeconds = 0;
  const gaps: CoverageGap[] = [];

  for (const section of sections) {
    for (const lesson of section.lessons) {
      const media = lesson.blocks.filter((block) =>
        MEDIA_TYPES.has(block.type)
      );
      if (media.length === 0) continue;

      const missing = media.filter((block) => !hasTranscript(block));
      mediaBlocks += media.length;
      withTranscript += media.length - missing.length;

      if (missing.length === 0) continue;
      const seconds = missing.reduce(
        (sum, block) => sum + Math.max(0, block.durationSeconds ?? 0),
        0
      );
      missingSeconds += seconds;
      gaps.push({
        lessonId: lesson.id,
        sectionTitle: section.title,
        lessonTitle: lesson.title,
        blocks: missing.length,
        seconds,
      });
    }
  }

  return {
    mediaBlocks,
    withTranscript,
    /* Ein Kurs ganz ohne Video ist nicht "0 % erfasst", sondern vollständig –
       sein Wissen steht in Textblöcken, die der Assistent ohnehin liest. */
    percent:
      mediaBlocks === 0
        ? 100
        : Math.round((withTranscript / mediaBlocks) * 100),
    missingSeconds,
    gaps,
  };
}
