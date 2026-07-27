-- Whitelabel-Portal: Rechtsangaben des Betreibers (Impressum + DSGVO-
-- Verantwortlicher) als JSON. Ohne diese Angaben zeigt das Portal einen
-- Platzhalter statt Rechtstexte.
ALTER TABLE `BusinessWorkspace` ADD COLUMN `legal` JSON NULL;
