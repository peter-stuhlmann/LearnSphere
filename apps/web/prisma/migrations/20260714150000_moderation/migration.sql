-- Inhaltsmoderation: Pruef-Tabelle je Upload + Kurs-Flag durch Admin
ALTER TABLE `Course` ADD COLUMN `flaggedAt` DATETIME(3) NULL;
ALTER TABLE `Course` ADD COLUMN `flagReason` TEXT NULL;

CREATE TABLE `MediaModeration` (
  `id` VARCHAR(191) NOT NULL,
  `url` VARCHAR(400) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reason` TEXT NULL,
  `categories` JSON NULL,
  `reviewedBy` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MediaModeration_url_key`(`url`),
  INDEX `MediaModeration_status_idx`(`status`),
  INDEX `MediaModeration_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;