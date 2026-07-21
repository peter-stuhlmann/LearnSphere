-- Mehrsprachige Kurse: Zusatzsprachen am Kurs + Übersetzungs-Overrides als JSON
ALTER TABLE `Course`
  ADD COLUMN `extraLanguages` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `translations` JSON NULL;

ALTER TABLE `Section` ADD COLUMN `translations` JSON NULL;

ALTER TABLE `Lesson` ADD COLUMN `translations` JSON NULL;

ALTER TABLE `LessonBlock` ADD COLUMN `translations` JSON NULL;
