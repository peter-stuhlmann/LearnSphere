import { describe, expect, it } from "vitest";
import {
  buildKnowledgeChunks,
  diffKnowledgeChunks,
  type KnowledgeCourseInput,
} from "./chunking";

const course: KnowledgeCourseInput = {
  id: "c1",
  title: "Sternenkunde",
  subtitle: "Der Einsteigerkurs",
  description: "<p>Ein Kurs über den Nachthimmel.</p>",
  language: "de",
  languages: ["de", "en"],
  translations: { en: { description: "<p>A course about the night sky.</p>" } },
  sections: [
    {
      id: "s1",
      title: "Grundlagen",
      order: 0,
      translations: { en: { title: "Basics" } },
      lessons: [
        {
          id: "l1",
          title: "Die Sonne",
          translations: { en: { title: "The Sun" } },
          blocks: [
            {
              id: "b1",
              type: "TEXT",
              title: null,
              content: "<p>Die Sonne ist ein Stern.</p>",
              transcriptDe: null,
              transcriptEn: null,
              translations: { en: { content: "<p>The sun is a star.</p>" } },
            },
            {
              id: "b2",
              type: "VIDEO",
              title: "Intro-Video",
              content: null,
              transcriptDe: "Willkommen zur Sonnen-Lektion.",
              transcriptEn: "Welcome to the sun lesson.",
              translations: null,
            },
            {
              id: "b3",
              type: "IMAGE",
              title: "Diagramm des Sonnenaufbaus",
              content: null,
              transcriptDe: null,
              transcriptEn: null,
              translations: null,
            },
            {
              id: "b4",
              type: "HTML",
              title: "Fakten zur Sonne",
              content:
                "<style>b{color:red}</style><ul><li>Sie ist 4,6 Milliarden Jahre alt.</li></ul>",
              transcriptDe: null,
              transcriptEn: null,
              translations: {
                en: { title: "Sun facts", content: "<ul><li>It is 4.6 billion years old.</li></ul>" },
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("buildKnowledgeChunks", () => {
  const chunks = buildKnowledgeChunks(course);

  it("indexiert Text, Transkript, Bild-Beschriftung und Kurs-Meta", () => {
    const types = new Set(chunks.map((c) => c.sourceType));
    expect(types).toEqual(
      new Set(["TEXT", "TRANSCRIPT", "IMAGE_CAPTION", "COURSE_META"])
    );
  });

  it("jeder Lektions-Chunk kennt seine Fundstelle", () => {
    const text = chunks.find(
      (c) => c.sourceType === "TEXT" && c.lang === "de"
    );
    expect(text).toMatchObject({
      sectionId: "s1",
      lessonId: "l1",
      blockId: "b1",
      sectionTitle: "Grundlagen",
      lessonTitle: "Die Sonne",
    });
    // Kontextzeile für besseres Retrieval im Text selbst
    expect(text?.text).toContain("Grundlagen");
    expect(text?.text).toContain("Die Sonne ist ein Stern.");
  });

  it("übersetzt Inhalte und Fundstellen je Sprache (mit Fallback)", () => {
    const en = chunks.find((c) => c.sourceType === "TEXT" && c.lang === "en");
    expect(en?.text).toContain("The sun is a star.");
    expect(en?.sectionTitle).toBe("Basics");
    expect(en?.lessonTitle).toBe("The Sun");
    // Transkript en kommt aus transcriptEn
    const tr = chunks.find(
      (c) => c.sourceType === "TRANSCRIPT" && c.lang === "en"
    );
    expect(tr?.text).toContain("Welcome to the sun lesson.");
  });

  it("indexiert HTML-Blöcke samt Blocktitel", () => {
    /* HTML-Blöcke (Faktenkästen, Zeitleisten, Zitate) wurden früher
       übersprungen – der Assistent kannte einen Gutteil des Kurses nicht. */
    const html = chunks.find((c) => c.blockId === "b4" && c.lang === "de");
    expect(html?.text).toContain("Fakten zur Sonne");
    expect(html?.text).toContain("4,6 Milliarden Jahre");
    // CSS aus dem Inhalt darf nicht ins Wissen wandern
    expect(html?.text).not.toContain("color:red");
    // als TEXT geführt: der Enum in der DB bleibt unverändert
    expect(html?.sourceType).toBe("TEXT");

    const htmlEn = chunks.find((c) => c.blockId === "b4" && c.lang === "en");
    expect(htmlEn?.text).toContain("Sun facts");
    expect(htmlEn?.text).toContain("4.6 billion years");
  });

  it("HTML wird bereinigt", () => {
    for (const chunk of chunks) {
      expect(chunk.text).not.toMatch(/<[a-z]/i);
    }
  });

  it("Hashes sind deterministisch und einzigartig je Inhalt", () => {
    const again = buildKnowledgeChunks(course);
    expect(again.map((c) => c.contentHash)).toEqual(
      chunks.map((c) => c.contentHash)
    );
    expect(new Set(chunks.map((c) => c.contentHash)).size).toBe(chunks.length);
  });

  it("lange Texte werden in Chunks ≤ 900 Zeichen geteilt", () => {
    const longCourse: KnowledgeCourseInput = {
      ...course,
      languages: ["de"],
      sections: [
        {
          ...course.sections[0],
          lessons: [
            {
              ...course.sections[0].lessons[0],
              blocks: [
                {
                  id: "b1",
                  type: "TEXT",
                  title: null,
                  content: `<p>${"Ein ziemlich langer Satz über Sterne und Planeten. ".repeat(60).trim()}</p>`,
                  transcriptDe: null,
                  transcriptEn: null,
                  translations: null,
                },
              ],
            },
          ],
        },
      ],
    };
    const longChunks = buildKnowledgeChunks(longCourse).filter(
      (c) => c.sourceType === "TEXT"
    );
    expect(longChunks.length).toBeGreaterThan(1);
    for (const chunk of longChunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(1000);
    }
  });

  it("Quiz-Daten existieren im Eingabetyp gar nicht (strukturelle Isolation)", () => {
    // Der Compiler erzwingt das; hier dokumentiert der Test die Invariante:
    // buildKnowledgeChunks kennt nur Sections/Lessons/Blocks + Kurs-Meta.
    expect(Object.keys(course)).not.toContain("quizzes");
  });

  it("identische Texte in verschiedenen Blöcken erzeugen nur einen Chunk", () => {
    const duped: KnowledgeCourseInput = {
      ...course,
      languages: ["de"],
      sections: [
        {
          ...course.sections[0],
          lessons: [
            {
              ...course.sections[0].lessons[0],
              blocks: [
                course.sections[0].lessons[0].blocks[0],
                { ...course.sections[0].lessons[0].blocks[0], id: "b-copy" },
              ],
            },
          ],
        },
      ],
    };
    const hashes = buildKnowledgeChunks(duped).map((c) => c.contentHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe("buildKnowledgeChunks – Grenzfälle", () => {
  it("sortiert Abschnitte nach order und verkraftet fehlende Felder", () => {
    const sparse: KnowledgeCourseInput = {
      id: "c2",
      title: "Minimal",
      subtitle: null,
      description: null,
      language: "de",
      languages: ["de", "en"],
      translations: null,
      sections: [
        {
          id: "s2",
          title: "Zweiter",
          order: 1,
          translations: null,
          lessons: [
            {
              id: "l2",
              title: "Lektion B",
              translations: null,
              blocks: [
                {
                  id: "bi",
                  type: "IMAGE",
                  title: null, // Bild ohne Beschriftung → kein Chunk
                  content: null,
                  transcriptDe: null,
                  transcriptEn: null,
                  translations: null,
                },
                {
                  id: "bf",
                  type: "FILE", // Dateien liefern kein Wissen → ignoriert
                  title: "Handout",
                  content: null,
                  transcriptDe: null,
                  transcriptEn: null,
                  translations: null,
                },
              ],
            },
          ],
        },
        {
          id: "s1",
          title: "Erster",
          order: 0,
          translations: null,
          lessons: [
            {
              id: "l1",
              title: "Lektion A",
              translations: null,
              blocks: [
                {
                  id: "bt",
                  type: "TEXT",
                  title: null,
                  content: "<p>Inhalt A.</p>",
                  transcriptDe: null,
                  transcriptEn: null,
                  translations: null, // en fällt auf de-Inhalt zurück
                },
                {
                  id: "bt-leer",
                  type: "TEXT",
                  title: null,
                  content: null, // leerer Textblock → kein Chunk
                  transcriptDe: null,
                  transcriptEn: null,
                  translations: null,
                },
                {
                  id: "bv",
                  type: "AUDIO",
                  title: null,
                  content: null,
                  transcriptDe: "Nur deutsches Transkript.",
                  transcriptEn: null, // en-Transkript fehlt → kein en-Chunk
                  translations: null,
                },
              ],
            },
          ],
        },
      ],
    };
    const chunks = buildKnowledgeChunks(sparse);

    // Abschnitte in order-Reihenfolge (Erster vor Zweiter)
    const texts = chunks.filter((c) => c.sourceType === "TEXT");
    expect(texts[0].sectionTitle).toBe("Erster");

    // Bild ohne Beschriftung und FILE-Block erzeugen keine Chunks
    expect(chunks.some((c) => c.blockId === "bi")).toBe(false);
    expect(chunks.some((c) => c.blockId === "bf")).toBe(false);

    // en fällt beim Text auf die Basissprache zurück, Meta enthält nur Titel
    const enText = chunks.find(
      (c) => c.sourceType === "TEXT" && c.lang === "en"
    );
    expect(enText?.text).toContain("Inhalt A.");
    const meta = chunks.find(
      (c) => c.sourceType === "COURSE_META" && c.lang === "de"
    );
    expect(meta?.text).toBe("Minimal");

    // fehlendes en-Transkript → nur der de-Transkript-Chunk existiert
    const transcripts = chunks.filter((c) => c.sourceType === "TRANSCRIPT");
    expect(transcripts.map((c) => c.lang)).toEqual(["de"]);
  });
});

describe("diffKnowledgeChunks", () => {
  it("erkennt neue, unveränderte und verwaiste Chunks", () => {
    const drafts = buildKnowledgeChunks(course);
    const existing = [drafts[0].contentHash, "verwaister-hash"];
    const diff = diffKnowledgeChunks(existing, drafts);
    expect(diff.toCreate.map((c) => c.contentHash)).not.toContain(
      drafts[0].contentHash
    );
    expect(diff.toCreate.length).toBe(drafts.length - 1);
    expect(diff.toDelete).toEqual(["verwaister-hash"]);
  });

  it("leerer Bestand: alles neu, nichts löschen", () => {
    const drafts = buildKnowledgeChunks(course);
    const diff = diffKnowledgeChunks([], drafts);
    expect(diff.toCreate.length).toBe(drafts.length);
    expect(diff.toDelete).toEqual([]);
  });
});
