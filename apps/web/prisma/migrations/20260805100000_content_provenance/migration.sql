-- Herkunfts-Kennzeichnung von Lerninhalten (Fußnote, Art. 50 KI-VO)
ALTER TABLE `LessonBlock` ADD COLUMN `provenance` VARCHAR(191) NOT NULL DEFAULT 'HUMAN';
