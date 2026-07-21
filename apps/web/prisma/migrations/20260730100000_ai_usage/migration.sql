-- KI-Verbrauchsprotokoll: ein Datensatz je KI-Aufruf (Tokens, Modell,
-- Aktivität, Audio-Sekunden); Kosten werden zur Anzeige berechnet.
CREATE TABLE `AiUsage` (
  `id` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `activity` VARCHAR(191) NOT NULL,
  `model` VARCHAR(191) NOT NULL,
  `inputTokens` INTEGER NOT NULL DEFAULT 0,
  `systemTokens` INTEGER NOT NULL DEFAULT 0,
  `userTokens` INTEGER NOT NULL DEFAULT 0,
  `outputTokens` INTEGER NOT NULL DEFAULT 0,
  `audioSeconds` DOUBLE NOT NULL DEFAULT 0,
  `userId` VARCHAR(191) NULL,
  `courseId` VARCHAR(191) NULL,

  INDEX `AiUsage_createdAt_idx`(`createdAt`),
  INDEX `AiUsage_activity_idx`(`activity`),
  INDEX `AiUsage_model_idx`(`model`),
  INDEX `AiUsage_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiUsage`
  ADD CONSTRAINT `AiUsage_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
