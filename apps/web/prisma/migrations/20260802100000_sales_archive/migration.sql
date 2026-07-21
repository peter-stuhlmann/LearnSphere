-- Zweckgebundenes Belegarchiv für gelöschte Konten (§147 AO / §257 HGB,
-- Art. 17 Abs. 3 lit. b DSGVO)
CREATE TABLE `SalesArchive` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `purgeAfter` DATETIME(3) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `description` VARCHAR(191) NOT NULL,
    `partyName` VARCHAR(191) NOT NULL,
    `partyEmail` VARCHAR(191) NOT NULL,
    `details` JSON NULL,

    INDEX `SalesArchive_purgeAfter_idx`(`purgeAfter`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
