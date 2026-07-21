-- "Meine Kurse": Standard-Sortierung nach zuletzt geöffnetem Editor
ALTER TABLE `Course` ADD COLUMN `lastOpenedAt` DATETIME(3) NULL;
