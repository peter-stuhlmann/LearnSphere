-- Affiliate-Programm: Beitritt + Code am User, Provision + Guthaben-Einsatz am Kauf

ALTER TABLE `User`
    ADD COLUMN `affiliateCode` VARCHAR(191) NULL,
    ADD COLUMN `affiliateJoinedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_affiliateCode_key` ON `User`(`affiliateCode`);

ALTER TABLE `Enrollment`
    ADD COLUMN `affiliateUserId` VARCHAR(191) NULL,
    ADD COLUMN `affiliateShareCents` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `creditUsedCents` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `Enrollment_affiliateUserId_idx` ON `Enrollment`(`affiliateUserId`);

ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_affiliateUserId_fkey`
    FOREIGN KEY (`affiliateUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
