-- Zertifikatsprüfung: Kursinhalt zum Ausstellungszeitpunkt einfrieren
-- (null = Alt-Zertifikate; die Verifikations-Seite fällt dann mit Hinweis
-- auf den aktuellen Kursstand zurück)
ALTER TABLE `Certificate` ADD COLUMN `curriculum` JSON NULL;
