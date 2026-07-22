-- Lernassistent: Embeddings binär speichern und eine Landkarte des Kurses
-- einführen.
--
-- 1) Das Embedding lag als JSON-Array vor (~23 KB je Chunk) und musste vor
--    JEDER Frage für den ganzen Kurs geladen und geparst werden. Bei einem
--    zehnstündigen Videokurs sind das rund 650 Chunks, also ~15 MB
--    JSON-Parsing pro Frage. Als rohes Float32-Array sind es 6 KB ohne
--    Parsing.
--
--    Bestehende Zeilen lassen sich nicht konvertieren und werden verworfen.
--    Das ist unkritisch: Die Chunks werden beim nächsten Assistenten-Aufruf
--    aus dem Kursinhalt neu erzeugt, und neue Embeddings kosten bei
--    text-embedding-3-small rund 0,3 Cent je zehnstündigem Kurs.
DELETE FROM `KnowledgeChunk`;

ALTER TABLE `KnowledgeChunk` MODIFY COLUMN `embedding` BLOB NOT NULL;

-- Alle indexierten Kurse zur Neuindexierung vormerken
UPDATE `KnowledgeIndexState` SET `staleAt` = CURRENT_TIMESTAMP(3);

-- 2) Zusammenfassungen je Lektion und Abschnitt. Sie gehen dem Assistenten
--    bei JEDER Frage vollständig mit: Das Retrieval liefert Details zur
--    Frage, diese Tabelle liefert den Überblick über den ganzen Kurs.
CREATE TABLE `KnowledgeSummary` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `lang` VARCHAR(191) NOT NULL,
    `sectionTitle` VARCHAR(191) NOT NULL,
    `lessonTitle` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `text` TEXT NOT NULL,
    `sourceHash` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeSummary_courseId_idx`(`courseId`),
    UNIQUE INDEX `KnowledgeSummary_courseId_kind_lang_sectionId_lessonId_key`(`courseId`, `kind`, `lang`, `sectionId`, `lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KnowledgeSummary` ADD CONSTRAINT `KnowledgeSummary_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
