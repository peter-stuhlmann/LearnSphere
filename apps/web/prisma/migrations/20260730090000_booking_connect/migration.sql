-- Live-Termine: Checkbox "Termine anbieten" am Kurs; die Verbindung selbst
-- (Kalender-ID + API-Key) entsteht über den termine.lol-Connect-Flow
ALTER TABLE `Course` ADD COLUMN `bookingEnabled` BOOLEAN NOT NULL DEFAULT false;
