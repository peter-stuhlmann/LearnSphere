-- AlterTable
ALTER TABLE `User` ADD COLUMN `stripeAccountId` VARCHAR(191) NULL,
    ADD COLUMN `stripeChargesEnabled` BOOLEAN NOT NULL DEFAULT false;
