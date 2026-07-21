-- Kurse: feste LearnSphere-Kategorie (genau eine) + freie Tags

ALTER TABLE `Course`
    ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `tags` VARCHAR(191) NOT NULL DEFAULT '';

CREATE INDEX `Course_category_idx` ON `Course`(`category`);
