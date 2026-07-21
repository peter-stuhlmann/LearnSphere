-- Double-Opt-In der Registrierung: Verifizierungs-Token je Nutzer
CREATE TABLE `EmailVerifyToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerifyToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailVerifyToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmailVerifyToken` ADD CONSTRAINT `EmailVerifyToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestandskonten gelten als bestätigt – niemand wird ausgesperrt
UPDATE `User` SET `emailVerified` = CURRENT_TIMESTAMP(3) WHERE `emailVerified` IS NULL;
