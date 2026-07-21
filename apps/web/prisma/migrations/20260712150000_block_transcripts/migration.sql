-- Transkripte für Video-/Audio-Blöcke (Barrierefreiheit + Übersetzung)

ALTER TABLE `LessonBlock`
    ADD COLUMN `transcriptDe` MEDIUMTEXT NULL,
    ADD COLUMN `transcriptEn` MEDIUMTEXT NULL;
