-- Gutscheine gelten künftig für mehrere Kurse:
-- Coupon hängt am Creator, die Kurs-Zuordnung liegt in CouponCourse.

-- 1) Join-Tabelle anlegen
CREATE TABLE `CouponCourse` (
    `couponId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,

    INDEX `CouponCourse_courseId_idx`(`courseId`),
    PRIMARY KEY (`couponId`, `courseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Bestehende 1:1-Zuordnungen übernehmen
INSERT INTO `CouponCourse` (`couponId`, `courseId`)
SELECT `id`, `courseId` FROM `Coupon`;

-- 3) creatorId aus dem bisherigen Kurs ableiten
ALTER TABLE `Coupon` ADD COLUMN `creatorId` VARCHAR(191) NULL;

UPDATE `Coupon` c
JOIN `Course` k ON k.`id` = c.`courseId`
SET c.`creatorId` = k.`creatorId`;

-- 4) Code-Duplikate je Creator entschärfen (Eindeutigkeit war bisher je Kurs)
UPDATE `Coupon` c
JOIN (
    SELECT `id`,
           ROW_NUMBER() OVER (PARTITION BY `creatorId`, `code` ORDER BY `createdAt`, `id`) AS rn
    FROM `Coupon`
) d ON d.`id` = c.`id` AND d.rn > 1
SET c.`code` = CONCAT(c.`code`, '-', d.rn);

ALTER TABLE `Coupon` MODIFY `creatorId` VARCHAR(191) NOT NULL;

-- 5) Alte Kurs-Bindung entfernen, neue Creator-Bindung aufbauen
ALTER TABLE `Coupon` DROP FOREIGN KEY `Coupon_courseId_fkey`;
DROP INDEX `Coupon_courseId_code_key` ON `Coupon`;
DROP INDEX `Coupon_courseId_idx` ON `Coupon`;
ALTER TABLE `Coupon` DROP COLUMN `courseId`;

CREATE UNIQUE INDEX `Coupon_creatorId_code_key` ON `Coupon`(`creatorId`, `code`);
CREATE INDEX `Coupon_creatorId_idx` ON `Coupon`(`creatorId`);

ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_creatorId_fkey`
    FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CouponCourse` ADD CONSTRAINT `CouponCourse_couponId_fkey`
    FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CouponCourse` ADD CONSTRAINT `CouponCourse_courseId_fkey`
    FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
