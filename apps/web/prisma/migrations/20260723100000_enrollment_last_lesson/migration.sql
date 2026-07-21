-- Letzte Position im Kurs: zuletzt geöffnete Lektion je Einschreibung
ALTER TABLE `Enrollment` ADD COLUMN `lastLessonId` VARCHAR(191) NULL;

CREATE INDEX `Enrollment_lastLessonId_idx` ON `Enrollment`(`lastLessonId`);

ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_lastLessonId_fkey`
  FOREIGN KEY (`lastLessonId`) REFERENCES `Lesson`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
