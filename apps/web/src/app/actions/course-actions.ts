"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { slugify, uniqueSlug } from "@elearning/core/slug";
import { z } from "zod";
import {
  courseSchema,
  quizSchema,
  SUPPORTED_LANGUAGES,
  type QuizInput,
} from "@elearning/core/validation";
import { serializeExtraLanguages } from "@elearning/core/course-i18n";
import { isLocalUploadUrl } from "@elearning/core/media-url";
import { parseCertificateTheme } from "@elearning/core/certificate/theme";
import { sortChapters } from "@elearning/core/chapters";
import { markKnowledgeStale } from "@/lib/assistant/indexer";
import {
  lessonDurationFromBlocks,
  lessonSchema,
  type LessonInput,
} from "@elearning/core/blocks";
import { sanitizeRichText } from "@/lib/sanitize";
import { serializeTags } from "@elearning/core/tags";
import {
  isModerationEnabled,
  moderateEditorialText,
} from "@/lib/moderation";
import { withYouTubeDurations } from "@/lib/youtube-server";
import { notifyWaitlist } from "@/lib/waitlist-server";
import type { ActionResult } from "./auth-actions";

/** ActionResult mit optionaler Begründung der Inhaltsprüfung. */
type SaveResult = ActionResult & {
  reason?: string;
  /** Zod-Pfad des ersten Validierungsfehlers, z. B. ["blocks", 2, "url"] –
      damit der Editor exakt das betroffene Feld markieren kann */
  errorPath?: (string | number)[];
};

/** Erstes Zod-Issue als SaveResult inkl. Feldpfad. */
function zodErrorResult(error: z.ZodError): SaveResult {
  const issue = error.issues[0];
  return {
    ok: false,
    error: issue?.message ?? "invalid",
    errorPath: issue?.path.filter(
      (p): p is string | number => typeof p !== "symbol"
    ),
  };
}

/**
 * Textinhalte beim Speichern prüfen (auch nachträglich editierte
 * Transkripte!). Gibt bei Treffern das Ablehnungs-Ergebnis zurück.
 */
async function rejectFlaggedText(
  parts: (string | null | undefined)[]
): Promise<SaveResult | null> {
  if (!isModerationEnabled()) return null;
  const verdict = await moderateEditorialText(parts);
  if (!verdict.flagged) return null;
  return { ok: false, error: "content_flagged", reason: verdict.reason };
}

/** Prüf-Texte einer Lektion einsammeln (Titel, Inhalte, Transkripte). */
function lessonTextParts(data: LessonInput): (string | undefined)[] {
  const parsed = lessonSchema.parse(data);
  return [
    parsed.title,
    ...Object.values(parsed.translations).map((t) => t?.title),
    ...parsed.blocks.flatMap((block) => [
      block.title,
      "content" in block ? block.content : undefined,
      block.type === "VIDEO" || block.type === "AUDIO"
        ? block.transcriptDe
        : undefined,
      block.type === "VIDEO" || block.type === "AUDIO"
        ? block.transcriptEn
        : undefined,
      // übersetzte Titel/Inhalte laufen mit durch die Inhaltsprüfung
      ...Object.values(block.translations).flatMap((t) => [
        t?.title,
        t?.content,
      ]),
    ]),
  ];
}

/** Der RTE liefert für "leer" oft "<p></p>" – das gilt nicht als Übersetzung. */
function isBlankHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim() === "";
}

type CourseTranslations = z.infer<typeof courseSchema>["translations"];

/**
 * Kurs-Übersetzungen fürs Speichern normalisieren: leere Felder fliegen raus
 * (= Fallback auf die Basissprache), Beschreibungen werden sanitisiert.
 */
function courseTranslationsData(translations: CourseTranslations) {
  const entries = Object.entries(translations)
    .map(([lang, t]) => {
      const clean: Record<string, string> = {};
      if (t?.title) clean.title = t.title;
      if (t?.subtitle) clean.subtitle = t.subtitle;
      if (t?.description && !isBlankHtml(t.description)) {
        clean.description = sanitizeRichText(t.description);
      }
      return [lang, clean] as const;
    })
    .filter(([, clean]) => Object.keys(clean).length > 0);
  return entries.length ? Object.fromEntries(entries) : Prisma.DbNull;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

async function requireOwnedCourse(courseId: string, userId: string) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.creatorId !== userId) {
    return null;
  }
  return course;
}

export async function createCourse(input: {
  title: string;
}): Promise<ActionResult & { courseId?: string }> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const title = input.title.trim();
  if (title.length < 3) return { ok: false, error: "title_too_short" };

  const taken = new Set(
    (await db.course.findMany({ select: { slug: true } })).map((c) => c.slug)
  );
  const slug = uniqueSlug(slugify(title), taken);

  const course = await db.course.create({
    data: { creatorId: user.id, title, slug },
  });

  // Erste Nutzer werden automatisch Creator
  await db.user.update({
    where: { id: user.id, role: "CLIENT" },
    data: { role: "CREATOR" },
  }).catch(() => undefined);

  revalidatePath("/[locale]/creator", "page");
  return { ok: true, courseId: course.id };
}

export async function updateCourse(
  courseId: string,
  input: unknown
): Promise<SaveResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const course = await requireOwnedCourse(courseId, user.id);
  if (!course) return { ok: false, error: "not_found" };

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorResult(parsed.error);
  }

  const flagged = await rejectFlaggedText([
    parsed.data.title,
    parsed.data.subtitle,
    parsed.data.description,
    parsed.data.tags.join(", "),
    ...Object.values(parsed.data.translations).flatMap((t) => [
      t?.title,
      t?.subtitle,
      t?.description,
    ]),
  ]);
  if (flagged) return flagged;

  await db.course.update({
    where: { id: courseId },
    data: {
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      description: parsed.data.description
        ? sanitizeRichText(parsed.data.description)
        : null,
      language: parsed.data.language,
      extraLanguages: serializeExtraLanguages(
        parsed.data.extraLanguages,
        parsed.data.language
      ),
      translations: courseTranslationsData(parsed.data.translations),
      priceCents: parsed.data.priceCents,
      requiredWatchPercent: parsed.data.requiredWatchPercent,
      finalExamRequired: parsed.data.finalExamRequired,
      selfTestsEnabled: parsed.data.selfTestsEnabled,
      listedInShop: parsed.data.listedInShop,
      waitlistEnabled: parsed.data.waitlistEnabled,
      category: parsed.data.category,
      tags: serializeTags(parsed.data.tags),
      coverImage: parsed.data.coverImage,
      bookingEnabled: parsed.data.bookingEnabled,
    },
  });

  await markKnowledgeStale(courseId);
  revalidatePath(`/[locale]/creator/courses/${courseId}`, "page");
  return { ok: true };
}

/**
 * Zertifikat-Design speichern. parseCertificateTheme begrenzt den Input auf
 * die kuratierten Presets ("gewisser Rahmen"); nur die freien Signaturtexte
 * laufen zusätzlich durch die Inhaltsprüfung.
 */
export async function updateCertificateTheme(
  courseId: string,
  input: unknown
): Promise<SaveResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const course = await requireOwnedCourse(courseId, user.id);
  if (!course) return { ok: false, error: "not_found" };

  const theme = parseCertificateTheme(input);

  const flagged = await rejectFlaggedText([
    theme.signatureName,
    theme.signatureRole,
  ]);
  if (flagged) return flagged;

  await db.course.update({
    where: { id: courseId },
    data: { certificateTheme: { ...theme } },
  });

  revalidatePath(`/[locale]/creator/courses/${courseId}/certificate`, "page");
  return { ok: true };
}

export async function setCoursePublished(
  courseId: string,
  published: boolean
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const course = await requireOwnedCourse(courseId, user.id);
  if (!course) return { ok: false, error: "not_found" };

  if (published) {
    // Vom Admin gesperrte Kurse dürfen nicht veröffentlicht werden
    if (course.flaggedAt) {
      return { ok: false, error: "course_flagged" };
    }

    // Publish-Gate der Inhaltsprüfung: geflaggte/gesperrte Medien blocken,
    // laufende Prüfungen ebenfalls (kurz warten statt ungeprüft live gehen)
    const blocks = await db.lessonBlock.findMany({
      where: { lesson: { section: { courseId } } },
      select: { url: true, poster: true },
    });
    const urls = new Set<string>();
    for (const block of blocks) {
      if (block.url && isLocalUploadUrl(block.url)) urls.add(block.url);
      if (block.poster?.startsWith("/uploads/")) urls.add(block.poster);
    }
    if (course.coverImage?.startsWith("/uploads/")) {
      urls.add(course.coverImage);
    }
    if (urls.size > 0) {
      const results = await db.mediaModeration.findMany({
        where: { url: { in: [...urls] } },
        select: { status: true },
      });
      if (
        results.some(
          (r) => r.status === "FLAGGED" || r.status === "REJECTED"
        )
      ) {
        return { ok: false, error: "moderation_flagged" };
      }
      if (results.some((r) => r.status === "PENDING")) {
        return { ok: false, error: "moderation_pending" };
      }
    }
  }

  await db.course.update({ where: { id: courseId }, data: { published } });
  await markKnowledgeStale(courseId);

  // Warteliste benachrichtigen (einmalig je Adresse); Mail-Fehler dürfen
  // die Veröffentlichung nie blockieren
  if (published) {
    try {
      await notifyWaitlist(courseId);
    } catch {
      // bewusst geschluckt – Einträge bleiben für den nächsten Versuch
    }
  }

  revalidatePath(`/[locale]/creator/courses/${courseId}`, "page");
  return { ok: true };
}

export async function deleteCourse(courseId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const course = await requireOwnedCourse(courseId, user.id);
  if (!course) return { ok: false, error: "not_found" };

  // Kurse mit Teilnahmen dürfen nicht gelöscht werden: Käufer würden Zugang,
  // Fortschritt und Zertifikate verlieren, und die Abrechnung (Guthaben,
  // Statistiken) würde rückwirkend verfälscht. Stattdessen: auf Entwurf setzen.
  const enrollmentCount = await db.enrollment.count({ where: { courseId } });
  if (enrollmentCount > 0) {
    return { ok: false, error: "course_has_enrollments" };
  }

  await db.course.delete({ where: { id: courseId } });
  revalidatePath("/[locale]/creator", "page");
  return { ok: true };
}

export async function addSection(
  courseId: string,
  title: string
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const course = await requireOwnedCourse(courseId, user.id);
  if (!course) return { ok: false, error: "not_found" };

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "title_too_short" };

  const max = await db.section.aggregate({
    where: { courseId },
    _max: { order: true },
  });

  await db.section.create({
    data: { courseId, title: trimmed, order: (max._max.order ?? 0) + 1 },
  });

  await markKnowledgeStale(courseId);
  revalidatePath(`/[locale]/creator/courses/${courseId}`, "page");
  return { ok: true };
}

export async function renameSection(
  sectionId: string,
  title: string
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { course: { select: { id: true, creatorId: true } } },
  });
  if (!section || section.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "title_too_short" };

  await db.section.update({
    where: { id: sectionId },
    data: { title: trimmed },
  });
  await markKnowledgeStale(section.course.id);
  revalidatePath(`/[locale]/creator/courses/${section.course.id}`, "page");
  return { ok: true };
}

/** Drip Content je Abschnitt – beide Regeln optional und kombinierbar. */
const sectionDripSchema = z.object({
  /** frühestens X Tage nach Einschreibung (null/0 = sofort) */
  dripAfterDays: z.number().int().min(0).max(365).nullable(),
  /** erst nach bestandener Zwischenprüfung des vorherigen Abschnitts */
  dripAfterQuiz: z.boolean(),
});

export async function updateSectionDrip(
  sectionId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const section = await requireOwnedSection(sectionId, user.id);
  if (!section) return { ok: false, error: "not_found" };

  const parsed = sectionDripSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  await db.section.update({
    where: { id: sectionId },
    data: {
      dripAfterDays: parsed.data.dripAfterDays || null,
      dripAfterQuiz: parsed.data.dripAfterQuiz,
    },
  });
  revalidatePath(`/[locale]/creator/courses/${section.course.id}`, "page");
  return { ok: true };
}

/** Übersetzte Abschnittstitel; leer = Basistitel */
const sectionTranslationsSchema = z
  .partialRecord(
    z.enum(SUPPORTED_LANGUAGES),
    z.object({ title: z.string().trim().max(200).default("") })
  )
  .default({});

export async function updateSectionTranslations(
  sectionId: string,
  input: unknown
): Promise<SaveResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const section = await requireOwnedSection(sectionId, user.id);
  if (!section) return { ok: false, error: "not_found" };

  const parsed = sectionTranslationsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  const flagged = await rejectFlaggedText(
    Object.values(parsed.data).map((t) => t?.title)
  );
  if (flagged) return flagged;

  const entries = Object.entries(parsed.data)
    .filter(([, t]) => Boolean(t?.title))
    .map(([lang, t]) => [lang, { title: t!.title }] as const);

  await db.section.update({
    where: { id: sectionId },
    data: {
      translations: entries.length
        ? Object.fromEntries(entries)
        : Prisma.DbNull,
    },
  });

  await markKnowledgeStale(section.course.id);
  revalidatePath(`/[locale]/creator/courses/${section.course.id}`, "page");
  return { ok: true };
}

export async function deleteSection(sectionId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { course: { select: { id: true, creatorId: true } } },
  });
  if (!section || section.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }

  await db.section.delete({ where: { id: sectionId } });
  await markKnowledgeStale(section.course.id);
  revalidatePath(`/[locale]/creator/courses/${section.course.id}`, "page");
  return { ok: true };
}

export async function moveSection(
  sectionId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { course: { select: { id: true, creatorId: true } } },
  });
  if (!section || section.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }

  const neighbor = await db.section.findFirst({
    where: {
      courseId: section.courseId,
      order: direction === "up" ? { lt: section.order } : { gt: section.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return { ok: true };

  await db.$transaction([
    db.section.update({
      where: { id: section.id },
      data: { order: neighbor.order },
    }),
    db.section.update({
      where: { id: neighbor.id },
      data: { order: section.order },
    }),
  ]);

  await markKnowledgeStale(section.course.id);
  revalidatePath(`/[locale]/creator/courses/${section.course.id}`, "page");
  return { ok: true };
}

/**
 * Drag-and-drop: komplette Abschnitts-Reihenfolge in einem Schritt setzen.
 * orderedIds muss exakt die Abschnitte des Kurses enthalten (Set-Gleichheit),
 * damit ein veralteter Client nie Abschnitte verlieren kann.
 */
export async function reorderSections(
  courseId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const course = await requireOwnedCourse(courseId, user.id);
  if (!course) return { ok: false, error: "not_found" };

  const sections = await db.section.findMany({
    where: { courseId },
    select: { id: true },
  });
  const existing = new Set(sections.map((s) => s.id));
  if (
    orderedIds.length !== existing.size ||
    orderedIds.some((id) => !existing.has(id)) ||
    new Set(orderedIds).size !== orderedIds.length
  ) {
    return { ok: false, error: "stale_order" };
  }

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.section.update({ where: { id }, data: { order: index + 1 } })
    )
  );

  revalidatePath(`/[locale]/creator/courses/${courseId}`, "page");
  return { ok: true };
}

/**
 * Drag-and-drop: Lektion an eine Zielposition verschieben – auch in einen
 * anderen Abschnitt. targetIndex ist die Einfüge-Position in der Ziel-Liste
 * (ohne die verschobene Lektion gerechnet).
 */
export async function moveLessonTo(
  lessonId: string,
  targetSectionId: string,
  targetIndex: number
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: {
        include: { course: { select: { id: true, creatorId: true } } },
      },
    },
  });
  if (!lesson || lesson.section.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }
  const target = await db.section.findUnique({
    where: { id: targetSectionId },
    select: { id: true, courseId: true },
  });
  // Ziel muss ein Abschnitt desselben Kurses sein
  if (!target || target.courseId !== lesson.section.course.id) {
    return { ok: false, error: "not_found" };
  }

  await db.$transaction(async (tx) => {
    const targetLessons = await tx.lesson.findMany({
      where: { sectionId: target.id, id: { not: lesson.id } },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const index = Math.max(0, Math.min(targetIndex, targetLessons.length));
    const ordered = [
      ...targetLessons.slice(0, index).map((l) => l.id),
      lesson.id,
      ...targetLessons.slice(index).map((l) => l.id),
    ];
    await tx.lesson.update({
      where: { id: lesson.id },
      data: { sectionId: target.id },
    });
    for (const [i, id] of ordered.entries()) {
      await tx.lesson.update({ where: { id }, data: { order: i + 1 } });
    }
    // Quell-Abschnitt lückenlos neu nummerieren (bei Abschnittswechsel)
    if (target.id !== lesson.sectionId) {
      const sourceLessons = await tx.lesson.findMany({
        where: { sectionId: lesson.sectionId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      for (const [i, source] of sourceLessons.entries()) {
        await tx.lesson.update({
          where: { id: source.id },
          data: { order: i + 1 },
        });
      }
    }
  });

  await markKnowledgeStale(lesson.section.course.id);
  revalidatePath(
    `/[locale]/creator/courses/${lesson.section.course.id}`,
    "page"
  );
  return { ok: true };
}

async function requireOwnedSection(sectionId: string, userId: string) {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { course: { select: { id: true, creatorId: true } } },
  });
  if (!section || section.course.creatorId !== userId) {
    return null;
  }
  return section;
}

type ParsedBlock = z.infer<typeof lessonSchema>["blocks"][number];

/**
 * Block-Übersetzungen fürs Speichern normalisieren: nur zum Blocktyp passende,
 * nicht-leere Overrides bleiben; TEXT-Inhalte werden sanitisiert. Die Dauer
 * zählt nur zusammen mit einer eigenen Medien-URL.
 */
function blockTranslationsData(block: ParsedBlock) {
  const entries = Object.entries(block.translations)
    .map(([lang, t]) => {
      const clean: Record<string, string | number> = {};
      if (!t) return [lang, clean] as const;
      if (t.title) clean.title = t.title;
      if (t.url && block.type !== "TEXT" && block.type !== "HTML") {
        clean.url = t.url;
        if (
          t.durationSeconds > 0 &&
          (block.type === "VIDEO" || block.type === "AUDIO")
        ) {
          clean.durationSeconds = t.durationSeconds;
        }
      }
      if (t.fileName && block.type === "FILE") clean.fileName = t.fileName;
      if (t.poster && block.type === "VIDEO") clean.poster = t.poster;
      if (
        t.content &&
        !isBlankHtml(t.content) &&
        (block.type === "TEXT" || block.type === "HTML")
      ) {
        clean.content =
          block.type === "TEXT" ? sanitizeRichText(t.content) : t.content;
        // Herkunfts-Fußnote der Übersetzung (nur relevant, wenn es
        // überhaupt übersetzten Text gibt)
        clean.provenance = t.provenance;
      }
      return [lang, clean] as const;
    })
    .filter(([, clean]) => Object.keys(clean).length > 0);
  return entries.length ? Object.fromEntries(entries) : Prisma.DbNull;
}

/** Lektions-Übersetzungen (Titel) fürs Speichern normalisieren. */
function lessonTranslationsData(
  translations: z.infer<typeof lessonSchema>["translations"]
) {
  const entries = Object.entries(translations)
    .filter(([, t]) => Boolean(t?.title))
    .map(([lang, t]) => [lang, { title: t!.title }] as const);
  return entries.length ? Object.fromEntries(entries) : Prisma.DbNull;
}

function blockCreateData(blocks: LessonInput["blocks"]) {
  const parsed = lessonSchema.shape.blocks.parse(blocks);
  return parsed.map((block, index) => ({
    type: block.type,
    order: index + 1,
    title: block.title || null,
    url: "url" in block ? block.url : null,
    fileName:
      block.type === "FILE" ? block.fileName || null : null,
    // Rich-Text wird sanitisiert; HTML-Blöcke laufen ohnehin in der Sandbox
    content:
      block.type === "TEXT"
        ? sanitizeRichText(block.content)
        : block.type === "HTML"
          ? block.content
          : null,
    css: block.type === "HTML" ? block.css || null : null,
    // Herkunfts-Kennzeichnung (Fußnote für Lernende) – nur Text-Inhalte
    provenance:
      block.type === "TEXT" || block.type === "HTML"
        ? block.provenance
        : "HUMAN",
    durationSeconds:
      block.type === "VIDEO" || block.type === "AUDIO"
        ? block.durationSeconds
        : 0,
    // Transkripte sind Rich-Text → wie TEXT-Blöcke sanitisieren
    transcriptDe:
      (block.type === "VIDEO" || block.type === "AUDIO") && block.transcriptDe
        ? sanitizeRichText(block.transcriptDe) || null
        : null,
    transcriptEn:
      (block.type === "VIDEO" || block.type === "AUDIO") && block.transcriptEn
        ? sanitizeRichText(block.transcriptEn) || null
        : null,
    poster: block.type === "VIDEO" && block.poster ? block.poster : null,
    // Zeitgestempelte Segmente (Plain-Text, schema-validiert) für Karaoke
    transcriptCues:
      (block.type === "VIDEO" || block.type === "AUDIO") &&
      block.transcriptCues.length > 0
        ? block.transcriptCues
        : Prisma.DbNull,
    // Kapitelmarker (sortiert, schema-validiert); aufs Literal gemappt,
    // weil Interface-Typen nicht in Prismas InputJsonValue passen
    chapters:
      (block.type === "VIDEO" || block.type === "AUDIO") &&
      block.chapters &&
      block.chapters.length > 0
        ? sortChapters(block.chapters).map(({ t, title }) => ({ t, title }))
        : Prisma.DbNull,
    translations: blockTranslationsData(block),
  }));
}

export async function addLesson(
  sectionId: string,
  input: LessonInput
): Promise<SaveResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const section = await requireOwnedSection(sectionId, user.id);
  if (!section) return { ok: false, error: "not_found" };

  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorResult(parsed.error);
  }

  const flagged = await rejectFlaggedText(lessonTextParts(input));
  if (flagged) return flagged;

  // YouTube-Dauern serverseitig nachziehen (Client kommt da nicht ran)
  const blocks = await withYouTubeDurations(parsed.data.blocks);

  const max = await db.lesson.aggregate({
    where: { sectionId },
    _max: { order: true },
  });

  await db.lesson.create({
    data: {
      sectionId,
      title: parsed.data.title,
      isPreview: parsed.data.isPreview,
      durationSeconds: lessonDurationFromBlocks(blocks),
      order: (max._max.order ?? 0) + 1,
      translations: lessonTranslationsData(parsed.data.translations),
      blocks: { create: blockCreateData(blocks) },
    },
  });

  await markKnowledgeStale(section.course.id);
  revalidatePath(`/[locale]/creator/courses/${section.course.id}`, "page");
  return { ok: true };
}

export async function updateLesson(
  lessonId: string,
  input: LessonInput
): Promise<SaveResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: {
        include: { course: { select: { id: true, creatorId: true } } },
      },
    },
  });
  if (!lesson || lesson.section.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }

  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorResult(parsed.error);
  }

  // Textprüfung auch hier – Transkripte & Inhalte sind frei editierbar
  const flagged = await rejectFlaggedText(lessonTextParts(input));
  if (flagged) return flagged;

  // YouTube-Dauern serverseitig nachziehen (Client kommt da nicht ran)
  const blocks = await withYouTubeDurations(parsed.data.blocks);

  // Blöcke vollständig ersetzen – die Reihenfolge kommt aus dem Editor
  await db.$transaction([
    db.lessonBlock.deleteMany({ where: { lessonId } }),
    db.lesson.update({
      where: { id: lessonId },
      data: {
        title: parsed.data.title,
        isPreview: parsed.data.isPreview,
        durationSeconds: lessonDurationFromBlocks(blocks),
        translations: lessonTranslationsData(parsed.data.translations),
        blocks: { create: blockCreateData(blocks) },
      },
    }),
  ]);

  revalidatePath(
    `/[locale]/creator/courses/${lesson.section.course.id}`,
    "page"
  );
  return { ok: true };
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: {
        include: { course: { select: { id: true, creatorId: true } } },
      },
    },
  });
  if (!lesson || lesson.section.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }

  await db.lesson.delete({ where: { id: lessonId } });
  revalidatePath(
    `/[locale]/creator/courses/${lesson.section.course.id}`,
    "page"
  );
  return { ok: true };
}

export async function moveLesson(
  lessonId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: {
        include: { course: { select: { id: true, creatorId: true } } },
      },
    },
  });
  if (!lesson || lesson.section.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }

  const neighbor = await db.lesson.findFirst({
    where: {
      sectionId: lesson.sectionId,
      order: direction === "up" ? { lt: lesson.order } : { gt: lesson.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return { ok: true };

  await db.$transaction([
    db.lesson.update({
      where: { id: lesson.id },
      data: { order: neighbor.order },
    }),
    db.lesson.update({
      where: { id: neighbor.id },
      data: { order: lesson.order },
    }),
  ]);

  revalidatePath(
    `/[locale]/creator/courses/${lesson.section.course.id}`,
    "page"
  );
  return { ok: true };
}

/**
 * Legt eine Prüfung an oder ersetzt sie vollständig (inkl. Fragen).
 * sectionId = null → Abschlussprüfung des Kurses.
 */
export async function saveQuiz(input: {
  courseId: string;
  sectionId: string | null;
  quiz: QuizInput;
}): Promise<SaveResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const course = await requireOwnedCourse(input.courseId, user.id);
  if (!course) return { ok: false, error: "not_found" };

  const parsed = quizSchema.safeParse(input.quiz);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const flagged = await rejectFlaggedText([
    parsed.data.title,
    ...parsed.data.questions.flatMap((question) => [
      question.text,
      question.expectedAnswer,
      ...question.options.map((option) => option.text),
    ]),
  ]);
  if (flagged) return flagged;

  if (input.sectionId) {
    const section = await db.section.findUnique({
      where: { id: input.sectionId },
    });
    if (!section || section.courseId !== input.courseId) {
      return { ok: false, error: "not_found" };
    }
  }

  const existing = await db.quiz.findFirst({
    where: input.sectionId
      ? { sectionId: input.sectionId }
      : { courseId: input.courseId, kind: "FINAL" },
  });

  const questionsCreate = parsed.data.questions.map((q, qi) => ({
    text: q.text,
    kind: q.kind,
    order: qi + 1,
    points: q.points,
    expectedAnswer: q.kind === "FREE_TEXT" ? q.expectedAnswer : null,
    aiGraded: q.kind === "FREE_TEXT" ? q.aiGraded : false,
    options: {
      create: (q.kind === "FREE_TEXT" ? [] : q.options).map((o, oi) => ({
        text: o.text,
        isCorrect: o.isCorrect,
        order: oi + 1,
      })),
    },
  }));

  await db.$transaction(async (tx) => {
    if (existing) {
      // Update statt Löschen+Neuanlegen: Die Prüfung bleibt bestehen, nur
      // die Fragen werden ersetzt. So überleben alle Prüfungsversuche samt
      // „Bestanden“-Status und Versuchszählern – bereits abgelegte Ergebnisse
      // sind historische Fakten und bleiben gültig.
      await tx.question.deleteMany({ where: { quizId: existing.id } });
      await tx.quiz.update({
        where: { id: existing.id },
        data: {
          title: parsed.data.title,
          passPercent: parsed.data.passPercent,
          maxAttempts: parsed.data.maxAttempts,
          attemptWindowHours: parsed.data.attemptWindowHours,
          retakeAfterPass: parsed.data.retakeAfterPass,
          shuffleQuestions: parsed.data.shuffleQuestions,
          shuffleAnswers: parsed.data.shuffleAnswers,
          timeLimitMinutes: parsed.data.timeLimitMinutes,
          questions: { create: questionsCreate },
        },
      });
      return;
    }
    await tx.quiz.create({
      data: {
        courseId: input.courseId,
        sectionId: input.sectionId,
        kind: input.sectionId ? "SECTION" : "FINAL",
        title: parsed.data.title,
        passPercent: parsed.data.passPercent,
        maxAttempts: parsed.data.maxAttempts,
        attemptWindowHours: parsed.data.attemptWindowHours,
        retakeAfterPass: parsed.data.retakeAfterPass,
        shuffleQuestions: parsed.data.shuffleQuestions,
        shuffleAnswers: parsed.data.shuffleAnswers,
        timeLimitMinutes: parsed.data.timeLimitMinutes,
        questions: { create: questionsCreate },
      },
    });
  });

  revalidatePath(`/[locale]/creator/courses/${input.courseId}`, "page");
  return { ok: true };
}

export async function deleteQuiz(quizId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: { course: { select: { id: true, creatorId: true } } },
  });
  if (!quiz || quiz.course.creatorId !== user.id) {
    return { ok: false, error: "not_found" };
  }

  await db.quiz.delete({ where: { id: quizId } });
  revalidatePath(`/[locale]/creator/courses/${quiz.course.id}`, "page");
  return { ok: true };
}
