-- Video-Heatmap: anonyme Seh-Zähler je Medienblock und Zeit-Bucket
CREATE TABLE `BlockWatchBucket` (
    `id` VARCHAR(191) NOT NULL,
    `blockId` VARCHAR(191) NOT NULL,
    `bucket` INTEGER NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `BlockWatchBucket_blockId_bucket_key`(`blockId`, `bucket`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BlockWatchBucket` ADD CONSTRAINT `BlockWatchBucket_blockId_fkey`
  FOREIGN KEY (`blockId`) REFERENCES `LessonBlock`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
