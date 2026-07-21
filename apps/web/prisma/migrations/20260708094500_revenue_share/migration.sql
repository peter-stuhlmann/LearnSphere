-- Preismodell-Umstellung: Umsatzbeteiligung statt Abo
-- 1) Verkaufskanal + Creator-Anteil an der Einschreibung
ALTER TABLE `Enrollment`
  ADD COLUMN `salesChannel` ENUM('PLATFORM', 'EXTERNAL') NOT NULL DEFAULT 'PLATFORM',
  ADD COLUMN `creatorShareCents` INTEGER NOT NULL DEFAULT 0;

-- Backfill: bisherige Verkäufe gelten als Plattform-Verkäufe (80 %)
UPDATE `Enrollment`
SET `creatorShareCents` = ROUND(`pricePaidCents` * 0.8)
WHERE `pricePaidCents` > 0;

-- 2) Abo-Modell entfernen (keine festen monatlichen Kosten mehr)
DROP TABLE `Subscription`;
