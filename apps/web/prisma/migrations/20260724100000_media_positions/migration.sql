-- Exakte Abspielposition je Medienblock (Fortsetzen an der letzten Sekunde)
ALTER TABLE `LessonProgress` ADD COLUMN `positions` JSON NULL;
