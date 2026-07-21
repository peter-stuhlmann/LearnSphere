-- Lernassistent: Kurs-Memory (KnowledgeChunk), Staleness-Marker und
-- persistenter Chatverlauf je Nutzer/Kurs
CREATE TABLE `KnowledgeChunk` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NULL,
    `sectionId` VARCHAR(191) NULL,
    `blockId` VARCHAR(191) NULL,
    `sourceType` ENUM('TEXT', 'TRANSCRIPT', 'IMAGE_CAPTION', 'COURSE_META') NOT NULL,
    `lang` VARCHAR(191) NOT NULL,
    `sectionTitle` VARCHAR(191) NOT NULL,
    `lessonTitle` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `embedding` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KnowledgeChunk_courseId_contentHash_key`(`courseId`, `contentHash`),
    INDEX `KnowledgeChunk_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KnowledgeIndexState` (
    `courseId` VARCHAR(191) NOT NULL,
    `staleAt` DATETIME(3) NULL,
    `indexedAt` DATETIME(3) NULL,

    PRIMARY KEY (`courseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AssistantMessage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT') NOT NULL,
    `content` TEXT NOT NULL,
    `sources` JSON NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssistantMessage_userId_courseId_archivedAt_createdAt_idx`(`userId`, `courseId`, `archivedAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssistantMessage` ADD CONSTRAINT `AssistantMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssistantMessage` ADD CONSTRAINT `AssistantMessage_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
