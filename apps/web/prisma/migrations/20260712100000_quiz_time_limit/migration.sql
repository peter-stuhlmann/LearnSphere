-- Prüfungen: optionales Zeitlimit + laufende Prüfungs-Uhr

ALTER TABLE `Quiz` ADD COLUMN `timeLimitMinutes` INTEGER NULL;

CREATE TABLE `QuizTimer` (
    `id` VARCHAR(191) NOT NULL,
    `quizId` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QuizTimer_enrollmentId_quizId_key`(`enrollmentId`, `quizId`),
    INDEX `QuizTimer_quizId_idx`(`quizId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QuizTimer` ADD CONSTRAINT `QuizTimer_quizId_fkey`
    FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuizTimer` ADD CONSTRAINT `QuizTimer_enrollmentId_fkey`
    FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
