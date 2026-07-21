-- CreateTable
CREATE TABLE `LessonBlock` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `type` ENUM('VIDEO', 'AUDIO', 'IMAGE', 'FILE', 'TEXT', 'HTML') NOT NULL,
    `order` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `url` TEXT NULL,
    `fileName` VARCHAR(191) NULL,
    `content` MEDIUMTEXT NULL,
    `css` MEDIUMTEXT NULL,
    `durationSeconds` INTEGER NOT NULL DEFAULT 0,

    INDEX `LessonBlock_lessonId_idx`(`lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LessonBlock` ADD CONSTRAINT `LessonBlock_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
