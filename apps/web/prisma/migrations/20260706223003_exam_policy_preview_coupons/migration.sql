-- AlterTable
ALTER TABLE `Enrollment` ADD COLUMN `couponCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Lesson` ADD COLUMN `isPreview` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Quiz` ADD COLUMN `attemptWindowHours` INTEGER NULL,
    ADD COLUMN `maxAttempts` INTEGER NULL,
    ADD COLUMN `retakeAfterPass` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `kind` ENUM('PERCENT', 'AMOUNT_OFF', 'FIXED_PRICE') NOT NULL,
    `value` INTEGER NOT NULL,
    `maxRedemptions` INTEGER NULL,
    `redeemedCount` INTEGER NOT NULL DEFAULT 0,
    `validFrom` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Coupon_courseId_idx`(`courseId`),
    UNIQUE INDEX `Coupon_courseId_code_key`(`courseId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
