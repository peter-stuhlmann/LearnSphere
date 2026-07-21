-- Drip Content: Abschnitte optional zeit- oder prüfungsgesteuert freischalten
ALTER TABLE `Section` ADD COLUMN `dripAfterDays` INTEGER NULL,
    ADD COLUMN `dripAfterQuiz` BOOLEAN NOT NULL DEFAULT false;

-- Warteliste für unveröffentlichte Kurse ("Demnächst"-Seite)
ALTER TABLE `Course` ADD COLUMN `waitlistEnabled` BOOLEAN NOT NULL DEFAULT false;

-- Spaced Repetition: Wiederholungszustand je Nutzer und Prüfungsfrage (SM-2 light)
CREATE TABLE `FlashcardReview` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `ease` DOUBLE NOT NULL DEFAULT 2.5,
    `intervalDays` INTEGER NOT NULL DEFAULT 0,
    `reps` INTEGER NOT NULL DEFAULT 0,
    `lapses` INTEGER NOT NULL DEFAULT 0,
    `dueAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FlashcardReview_userId_dueAt_idx`(`userId`, `dueAt`),
    UNIQUE INDEX `FlashcardReview_userId_questionId_key`(`userId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Lern-Streak: ein Eintrag je Nutzer und Kalendertag (UTC)
CREATE TABLE `LearnActivity` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `LearnActivity_userId_day_key`(`userId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Warteliste: Eintragungen je Kurs (Doppel-Mails über notifiedAt ausgeschlossen)
CREATE TABLE `WaitlistEntry` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'de',
    `userId` VARCHAR(191) NULL,
    `notifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WaitlistEntry_courseId_idx`(`courseId`),
    UNIQUE INDEX `WaitlistEntry_courseId_email_key`(`courseId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FlashcardReview` ADD CONSTRAINT `FlashcardReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FlashcardReview` ADD CONSTRAINT `FlashcardReview_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LearnActivity` ADD CONSTRAINT `LearnActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WaitlistEntry` ADD CONSTRAINT `WaitlistEntry_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
