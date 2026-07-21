-- Prüfungen: Misch-Optionen + Freitext-Fragen (exakt oder KI-bewertet)

ALTER TABLE `Quiz`
    ADD COLUMN `shuffleQuestions` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shuffleAnswers` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `Question`
    MODIFY `kind` ENUM('SINGLE', 'MULTIPLE', 'FREE_TEXT') NOT NULL DEFAULT 'SINGLE',
    ADD COLUMN `expectedAnswer` TEXT NULL,
    ADD COLUMN `aiGraded` BOOLEAN NOT NULL DEFAULT false;
