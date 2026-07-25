-- Nachgetragene Migration: Struktur, die lokal per `prisma db push` entstand
-- und in den Migrationen fehlte (Business-Einmalkauf, Whitelabel-Workspaces,
-- Warenkorb, Lektions-Favoriten, Creator-E-Mail-Kampagnen). Ohne sie bekäme
-- eine frische Produktions-Datenbank diese Tabellen/Spalten nie.

-- AlterTable: neue Spalten auf bestehenden Tabellen
ALTER TABLE `User`
    ADD COLUMN `creatorJoinedAt` DATETIME(3) NULL,
    ADD COLUMN `businessJoinedAt` DATETIME(3) NULL;

ALTER TABLE `Course`
    ADD COLUMN `businessEnabled` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `LessonBlock`
    ADD COLUMN `script` MEDIUMTEXT NULL;

-- CreateTable
CREATE TABLE `CreatorCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `contentHtml` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELED') NOT NULL DEFAULT 'SENT',
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `allCourses` BOOLEAN NOT NULL DEFAULT true,
    `courseIds` JSON NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'de',
    `courseTitles` JSON NULL,
    `recipientCount` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreatorCampaign_creatorId_createdAt_idx`(`creatorId`, `createdAt`),
    INDEX `CreatorCampaign_status_scheduledAt_idx`(`status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreatorEmailOptOut` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreatorEmailOptOut_creatorId_idx`(`creatorId`),
    UNIQUE INDEX `CreatorEmailOptOut_email_creatorId_key`(`email`, `creatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessLicense` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `seats` INTEGER NOT NULL,
    `seatPriceCents` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `canceledAt` DATETIME(3) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `stripeCheckoutSessionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BusinessLicense_stripeCheckoutSessionId_key`(`stripeCheckoutSessionId`),
    INDEX `BusinessLicense_ownerId_idx`(`ownerId`),
    INDEX `BusinessLicense_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessWorkspace` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `customDomain` VARCHAR(191) NULL,
    `domainVerifyToken` VARCHAR(191) NULL,
    `domainVerifiedAt` DATETIME(3) NULL,
    `brandName` VARCHAR(191) NOT NULL,
    `logo` MEDIUMTEXT NULL,
    `brandColor` VARCHAR(191) NULL,
    `emailFromName` VARCHAR(191) NULL,
    `emailDomain` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessWorkspace_ownerId_key`(`ownerId`),
    UNIQUE INDEX `BusinessWorkspace_slug_key`(`slug`),
    UNIQUE INDEX `BusinessWorkspace_customDomain_key`(`customDomain`),
    INDEX `BusinessWorkspace_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessMember` (
    `id` VARCHAR(191) NOT NULL,
    `licenseId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `invitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NULL,
    `enrolledAt` DATETIME(3) NULL,

    INDEX `BusinessMember_email_idx`(`email`),
    UNIQUE INDEX `BusinessMember_licenseId_email_key`(`licenseId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CartItem_courseId_idx`(`courseId`),
    UNIQUE INDEX `CartItem_userId_courseId_key`(`userId`, `courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LessonFavorite` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LessonFavorite_lessonId_idx`(`lessonId`),
    UNIQUE INDEX `LessonFavorite_userId_lessonId_key`(`userId`, `lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreatorCampaign` ADD CONSTRAINT `CreatorCampaign_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreatorEmailOptOut` ADD CONSTRAINT `CreatorEmailOptOut_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessLicense` ADD CONSTRAINT `BusinessLicense_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessLicense` ADD CONSTRAINT `BusinessLicense_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessWorkspace` ADD CONSTRAINT `BusinessWorkspace_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMember` ADD CONSTRAINT `BusinessMember_licenseId_fkey` FOREIGN KEY (`licenseId`) REFERENCES `BusinessLicense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonFavorite` ADD CONSTRAINT `LessonFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonFavorite` ADD CONSTRAINT `LessonFavorite_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
