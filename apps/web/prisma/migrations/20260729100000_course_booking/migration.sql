-- Live-Termine via termine.lol: Kalender-Konfiguration je Kurs
ALTER TABLE `Course` ADD COLUMN `bookingCalendarId` VARCHAR(191) NULL;
ALTER TABLE `Course` ADD COLUMN `bookingApiKey` VARCHAR(191) NULL;
