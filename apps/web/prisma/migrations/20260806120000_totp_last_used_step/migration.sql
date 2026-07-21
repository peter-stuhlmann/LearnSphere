-- TOTP-Replay-Schutz: zuletzt verbrauchter Zeitschritt (floor(unix/30)).
-- Verhindert, dass derselbe 2FA-Code innerhalb seines 30-Sekunden-Fensters
-- ein zweites Mal verwendet werden kann.
--
-- Die Spalte kam seinerzeit nur per "db push" in die Entwicklungs-Datenbank
-- und fehlte in der Migrationshistorie.
ALTER TABLE `User` ADD COLUMN `totpLastUsedStep` INTEGER NULL;
