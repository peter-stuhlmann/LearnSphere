-- Vertrieb: Storefront-Felder, Shop-Sichtbarkeit, API-Keys
ALTER TABLE `User`
  ADD COLUMN `handle` VARCHAR(191) NULL,
  ADD COLUMN `storefrontName` VARCHAR(191) NULL,
  ADD COLUMN `brandColor` VARCHAR(191) NULL,
  ADD COLUMN `customDomain` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_handle_key` ON `User`(`handle`);
CREATE UNIQUE INDEX `User_customDomain_key` ON `User`(`customDomain`);

ALTER TABLE `Course`
  ADD COLUMN `listedInShop` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `ApiKey` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `keyHash` VARCHAR(191) NOT NULL,
  `prefix` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastUsedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,

  UNIQUE INDEX `ApiKey_keyHash_key`(`keyHash`),
  INDEX `ApiKey_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ApiKey`
  ADD CONSTRAINT `ApiKey_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
