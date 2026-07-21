-- 30-Tage-Rückgabegarantie: Fenster + Verzicht + Stripe-Referenz am Kauf
ALTER TABLE `Enrollment` ADD COLUMN `refundableUntil` DATETIME(3) NULL;
ALTER TABLE `Enrollment` ADD COLUMN `guaranteeWaivedAt` DATETIME(3) NULL;
ALTER TABLE `Enrollment` ADD COLUMN `stripeSessionId` VARCHAR(191) NULL;

-- Rückgabe-Beleg für Creator-Finanzen (Einschreibung selbst wird gelöscht)
CREATE TABLE `Refund` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NULL,
    `creatorId` VARCHAR(191) NULL,
    `courseTitle` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `creatorShareCents` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Refund_creatorId_createdAt_idx`(`creatorId`, `createdAt`),
    INDEX `Refund_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Refund` ADD CONSTRAINT `Refund_courseId_fkey`
    FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_creatorId_fkey`
    FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
