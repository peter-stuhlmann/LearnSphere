-- Legacy-Inhaltsfelder der Lektion entfernen (Inhalte wurden zu LessonBlocks konvertiert)
ALTER TABLE `Lesson`
  DROP COLUMN `type`,
  DROP COLUMN `videoUrl`,
  DROP COLUMN `fileUrl`,
  DROP COLUMN `fileName`,
  DROP COLUMN `content`;
