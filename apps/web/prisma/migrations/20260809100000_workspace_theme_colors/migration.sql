-- Whitelabel-Portal: erweiterbare Farbpalette (Hintergrund/Text/Sekundär).
-- `brandColor` bleibt die Akzentfarbe; die übrigen Tokens werden daraus und
-- aus diesen drei Feldern im Layout abgeleitet.
ALTER TABLE `BusinessWorkspace`
  ADD COLUMN `colorBackground` VARCHAR(191) NULL,
  ADD COLUMN `colorText` VARCHAR(191) NULL,
  ADD COLUMN `colorSecondary` VARCHAR(191) NULL;
