-- 2FA-Wiederherstellungscodes (SHA-256-Hashes, einmal verwendbar)
ALTER TABLE `User` ADD COLUMN `totpRecoveryCodes` JSON NULL;
