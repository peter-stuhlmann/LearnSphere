-- termine.lol-Verbindung zieht vom Kurs auf das Creator-Konto um:
-- verbinden/trennen passiert in den Einstellungen, Kurse schalten nur
-- noch per bookingEnabled frei.
ALTER TABLE `User` ADD COLUMN `bookingCalendarId` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `bookingApiKey` VARCHAR(191) NULL;

-- Bestehende Kurs-Verbindungen übernehmen (jüngster verbundener Kurs gewinnt)
UPDATE `User` u
JOIN (
  SELECT c.creatorId, c.bookingCalendarId, c.bookingApiKey
  FROM `Course` c
  JOIN (
    SELECT creatorId, MAX(updatedAt) AS maxUpdated
    FROM `Course`
    WHERE bookingCalendarId IS NOT NULL AND bookingApiKey IS NOT NULL
    GROUP BY creatorId
  ) latest
    ON latest.creatorId = c.creatorId AND latest.maxUpdated = c.updatedAt
  WHERE c.bookingCalendarId IS NOT NULL AND c.bookingApiKey IS NOT NULL
) src ON src.creatorId = u.id
SET u.bookingCalendarId = src.bookingCalendarId,
    u.bookingApiKey     = src.bookingApiKey;

ALTER TABLE `Course` DROP COLUMN `bookingCalendarId`;
ALTER TABLE `Course` DROP COLUMN `bookingApiKey`;
