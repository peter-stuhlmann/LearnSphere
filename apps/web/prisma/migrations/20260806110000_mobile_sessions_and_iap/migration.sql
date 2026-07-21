-- Mobile-App: Geräte-Sessions (Refresh-Token-Rotation) und In-App-Käufe.
-- Diese Modelle wurden seinerzeit nur per "db push" in die lokale
-- Entwicklungs-Datenbank gebracht und fehlten in der Migrationshistorie;
-- eine frische Produktions-Datenbank hätte sie deshalb nicht bekommen.

-- CreateTable
CREATE TABLE `MobileSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `refreshTokenHash` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `devicePlatform` VARCHAR(191) NULL,
    `deviceName` VARCHAR(191) NULL,
    `deviceId` VARCHAR(191) NULL,
    `appVersion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `MobileSession_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `MobileSession_userId_idx`(`userId`),
    INDEX `MobileSession_familyId_idx`(`familyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IapPurchaseIntent` (
    `id` VARCHAR(191) NOT NULL,
    `appAccountToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `tierCents` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consumedAt` DATETIME(3) NULL,

    UNIQUE INDEX `IapPurchaseIntent_appAccountToken_key`(`appAccountToken`),
    INDEX `IapPurchaseIntent_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IapTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `store` ENUM('APPLE', 'GOOGLE') NOT NULL,
    `storeTransactionId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NULL,
    `grossCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `storeFeeCents` INTEGER NOT NULL,
    `creatorShareCents` INTEGER NOT NULL,
    `status` ENUM('VERIFIED', 'REVOKED') NOT NULL DEFAULT 'VERIFIED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `refundedAt` DATETIME(3) NULL,

    UNIQUE INDEX `IapTransaction_storeTransactionId_key`(`storeTransactionId`),
    UNIQUE INDEX `IapTransaction_enrollmentId_key`(`enrollmentId`),
    INDEX `IapTransaction_userId_idx`(`userId`),
    INDEX `IapTransaction_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MobileSession` ADD CONSTRAINT `MobileSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
