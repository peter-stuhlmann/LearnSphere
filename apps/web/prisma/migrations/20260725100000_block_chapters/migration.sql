-- Kapitelmarker für Video-/Audio-Blöcke: [{ t: sekunden, title }]
ALTER TABLE `LessonBlock` ADD COLUMN `chapters` JSON NULL;
