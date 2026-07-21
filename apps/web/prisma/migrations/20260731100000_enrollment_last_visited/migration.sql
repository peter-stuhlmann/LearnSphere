-- "Mein Lernen": Standard-Sortierung nach zuletzt genutztem Kurs
ALTER TABLE `Enrollment` ADD COLUMN `lastVisitedAt` DATETIME(3) NULL;
