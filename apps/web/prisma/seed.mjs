// Demo-Daten: ein Creator mit veröffentlichtem Kurs (inkl. Prüfungen)
// und ein Lernenden-Konto. Ausführen mit: node prisma/seed.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const CREATOR_EMAIL = "creator@demo.local";
const LEARNER_EMAIL = "learner@demo.local";
const PASSWORD = "demo-Pass1";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const creator = await db.user.upsert({
    where: { email: CREATOR_EMAIL },
    update: {},
    create: {
      email: CREATOR_EMAIL,
      name: "Demo Creator",
      passwordHash,
      role: "CREATOR",
      subscription: { create: { plan: "PRO" } },
    },
  });

  await db.user.upsert({
    where: { email: LEARNER_EMAIL },
    update: {},
    create: {
      email: LEARNER_EMAIL,
      name: "Demo Learner",
      passwordHash,
      subscription: { create: {} },
    },
  });

  const existing = await db.course.findUnique({
    where: { slug: "react-fuer-einsteiger" },
  });
  if (existing) {
    console.log("Demo-Kurs existiert bereits – Seed übersprungen.");
    return;
  }

  await db.course.create({
    data: {
      creatorId: creator.id,
      slug: "react-fuer-einsteiger",
      title: "React für Einsteiger",
      subtitle: "Von null auf komponentenbasiert – der komplette Grundkurs.",
      description:
        "Du lernst Komponenten, Props, State, Hooks und wie du deine erste eigene App strukturierst. Mit Zwischenprüfungen pro Abschnitt und Abschlusszertifikat.",
      language: "de",
      priceCents: 0,
      published: true,
      requiredWatchPercent: 50,
      finalExamRequired: true,
      sections: {
        create: [
          {
            title: "Grundlagen",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Was ist React?",
                  order: 1,
                  durationSeconds: 127,
                  blocks: {
                    create: [
                      {
                        type: "VIDEO",
                        order: 1,
                        url: "https://www.youtube.com/watch?v=Tn6-PIqc4UM",
                        durationSeconds: 127,
                      },
                    ],
                  },
                },
                {
                  title: "Cheatsheet: JSX-Syntax",
                  order: 2,
                  blocks: {
                    create: [
                      {
                        type: "TEXT",
                        order: 1,
                        content:
                          "JSX ist eine Syntax-Erweiterung für JavaScript.\n\n- Komponenten beginnen mit Großbuchstaben\n- Attribute heißen className statt class\n- Ausdrücke stehen in geschweiften Klammern: {wert}",
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            title: "Komponenten & State",
            order: 2,
            lessons: {
              create: [
                {
                  title: "Props und State",
                  order: 1,
                  durationSeconds: 1265,
                  blocks: {
                    create: [
                      {
                        type: "VIDEO",
                        order: 1,
                        url: "https://www.youtube.com/watch?v=O6P86uwfdR0",
                        durationSeconds: 1265,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  const course = await db.course.findUnique({
    where: { slug: "react-fuer-einsteiger" },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  // Zwischenprüfung für den ersten Abschnitt
  await db.quiz.create({
    data: {
      courseId: course.id,
      sectionId: course.sections[0].id,
      kind: "SECTION",
      title: "Zwischenprüfung: Grundlagen",
      passPercent: 50,
      questions: {
        create: [
          {
            text: "Was ist React?",
            kind: "SINGLE",
            order: 1,
            options: {
              create: [
                { text: "Eine JavaScript-Bibliothek für UIs", isCorrect: true, order: 1 },
                { text: "Eine Datenbank", isCorrect: false, order: 2 },
                { text: "Ein CSS-Framework", isCorrect: false, order: 3 },
              ],
            },
          },
        ],
      },
    },
  });
  await db.quiz.create({
    data: {
      courseId: course.id,
      kind: "FINAL",
      title: "Abschlussprüfung: React für Einsteiger",
      passPercent: 70,
      questions: {
        create: [
          {
            text: "Womit aktualisiert man State in einer Funktionskomponente?",
            kind: "SINGLE",
            order: 1,
            options: {
              create: [
                { text: "useState", isCorrect: true, order: 1 },
                { text: "setTimeout", isCorrect: false, order: 2 },
                { text: "querySelector", isCorrect: false, order: 3 },
              ],
            },
          },
          {
            text: "Welche Aussagen über Props stimmen? (mehrere richtig)",
            kind: "MULTIPLE",
            order: 2,
            options: {
              create: [
                { text: "Props fließen von Eltern zu Kind", isCorrect: true, order: 1 },
                { text: "Props sind schreibgeschützt", isCorrect: true, order: 2 },
                { text: "Props können nur Strings sein", isCorrect: false, order: 3 },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("Seed abgeschlossen.");
  console.log(`Creator: ${CREATOR_EMAIL} / ${PASSWORD}`);
  console.log(`Learner: ${LEARNER_EMAIL} / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
