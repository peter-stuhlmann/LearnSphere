-- KI-Selbsttests: Kurs-Schalter + generierte Übungsfragen je Lektion/Sprache
ALTER TABLE `Course` ADD COLUMN `selfTestsEnabled` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `SelfTestQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `lang` VARCHAR(191) NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `prompt` TEXT NOT NULL,
    `options` JSON NOT NULL,
    `explanation` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SelfTestQuestion_lessonId_lang_contentHash_idx`(`lessonId`, `lang`, `contentHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SelfTestQuestion` ADD CONSTRAINT `SelfTestQuestion_lessonId_fkey`
  FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
