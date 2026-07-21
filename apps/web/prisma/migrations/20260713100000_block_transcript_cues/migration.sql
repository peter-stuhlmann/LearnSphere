-- Zeitgestempelte Transkript-Segmente fuer die Karaoke-Anzeige
ALTER TABLE `LessonBlock` ADD COLUMN `transcriptCues` JSON NULL;
