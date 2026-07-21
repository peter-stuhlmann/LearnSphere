-- Kurs-Community & Q&A: Kommentare je Lektion (bis 3 Ebenen)
CREATE TABLE `LessonComment` (
  `id` VARCHAR(191) NOT NULL,
  `lessonId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `depth` INTEGER NOT NULL DEFAULT 0,
  `content` MEDIUMTEXT NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `LessonComment_lessonId_createdAt_idx`(`lessonId`, `createdAt`),
  INDEX `LessonComment_parentId_idx`(`parentId`),
  INDEX `LessonComment_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LessonComment` ADD CONSTRAINT `LessonComment_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LessonComment` ADD CONSTRAINT `LessonComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LessonComment` ADD CONSTRAINT `LessonComment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `LessonComment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;