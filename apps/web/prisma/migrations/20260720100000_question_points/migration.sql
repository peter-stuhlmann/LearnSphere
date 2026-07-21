-- Individuelle Punktzahl je Frage: gewichtet die Quote (Standard 1)
ALTER TABLE `Question` ADD COLUMN `points` INTEGER NOT NULL DEFAULT 1;
