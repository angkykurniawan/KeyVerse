-- =============================================================================
-- KeyVerse — File SQL Lengkap Siap Upload ke InfinityFree (phpMyAdmin)
-- =============================================================================
-- CARA UPLOAD KE INFINITYFREE:
-- 1. Masuk ke Control Panel InfinityFree -> MySQL Databases -> buat database.
-- 2. Klik "Admin" (phpMyAdmin) pada database yang baru dibuat.
-- 3. Pilih tab "Import" -> pilih file ini (schema_infinityfree.sql) -> klik "Go".
--
-- AKUN DEFAULT & USER DUMMY YANG TERSEDIA:
--   [ADMIN]
--     Username : admin
--     Email    : admin@keyverse.local
--     Password : AdminKeyVerse123!
--
--   [USER DUMMY / PESERTA LOMBA] (Password semuanya: UserKeyVerse123!)
--     1. budi.racer  (Budi Santoso)   - budi@keyverse.local
--     2. nadia.speed (Nadia Pratama)  - nadia@keyverse.local
--     3. raka.pro    (Raka Wijaya)    - raka@keyverse.local
--     4. sinta.dev   (Sinta Maharani) - sinta@keyverse.local
--
-- * Segera ubah password admin setelah masuk ke production!
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Tabel users (hanya didaftarkan oleh admin, tanpa registrasi mandiri)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `email` VARCHAR(160) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role_active` (`role`, `is_active`),
  CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Tabel languages (dikelola oleh admin)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `languages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `native_name` VARCHAR(100) NOT NULL,
  `prompt_hint` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_languages_code` (`code`),
  KEY `idx_languages_active` (`is_active`),
  CONSTRAINT `fk_languages_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Tabel typing_sessions (riwayat latihan, skor WPM & klasemen)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `typing_sessions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `language_id` INT UNSIGNED NOT NULL,
  `keywords_json` TEXT NOT NULL,
  `ai_model` VARCHAR(120) NOT NULL,
  `generated_text` TEXT NOT NULL,
  `wpm` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `raw_wpm` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `accuracy` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `total_chars` INT UNSIGNED NOT NULL DEFAULT 0,
  `correct_chars` INT UNSIGNED NOT NULL DEFAULT 0,
  `incorrect_chars` INT UNSIGNED NOT NULL DEFAULT 0,
  `word_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `duration_seconds` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_user_created` (`user_id`, `created_at`),
  KEY `idx_sessions_language` (`language_id`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sessions_language` FOREIGN KEY (`language_id`) REFERENCES `languages` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Tabel race_rooms & race_participants (Fitur Adu Ketik Multiplayer vs Kawan)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `race_rooms` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(10) NOT NULL,
  `host_user_id` INT UNSIGNED NOT NULL,
  `language_id` INT UNSIGNED NOT NULL,
  `keywords_json` TEXT NOT NULL,
  `ai_model` VARCHAR(120) NOT NULL,
  `generated_text` TEXT NOT NULL,
  `word_count` INT UNSIGNED NOT NULL DEFAULT 45,
  `status` ENUM('waiting', 'countdown', 'racing', 'finished') NOT NULL DEFAULT 'waiting',
  `starts_at_ms` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_race_rooms_code` (`code`),
  KEY `idx_race_rooms_status` (`status`, `created_at`),
  CONSTRAINT `fk_rooms_host` FOREIGN KEY (`host_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rooms_lang` FOREIGN KEY (`language_id`) REFERENCES `languages` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `race_participants` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `is_ready` TINYINT(1) NOT NULL DEFAULT 0,
  `progress` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `wpm` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `raw_wpm` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `accuracy` DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  `correct_chars` INT UNSIGNED NOT NULL DEFAULT 0,
  `incorrect_chars` INT UNSIGNED NOT NULL DEFAULT 0,
  `duration_seconds` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `finished_at_ms` BIGINT UNSIGNED NULL,
  `session_saved` TINYINT(1) NOT NULL DEFAULT 0,
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_room_participant` (`room_id`, `user_id`),
  KEY `idx_participants_room` (`room_id`),
  CONSTRAINT `fk_part_room` FOREIGN KEY (`room_id`) REFERENCES `race_rooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_part_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Tabel app_settings (Konfigurasi AI API Key & Model — HANYA untuk Admin)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`),
  CONSTRAINT `fk_settings_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 4. Seed Akun 1 Admin & 1 User (password bcrypt valid untuk PHP 8)
-- -----------------------------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `username`, `email`, `password_hash`, `role`, `is_active`, `created_by`)
VALUES
  (1, 'Administrator', 'admin', 'admin@keyverse.local', '$2y$10$d/4cQvP1Tzryba1Zk2x9P.JgWMscC3MOu0CTz4JuUYQWX4qJH4d46', 'admin', 1, NULL),
  (2, 'Peserta Demo', 'user', 'user@keyverse.local', '$2y$10$f1JIsmj8jZpEiy3MmIhUnePCZuIIFQntxeDk0otJk0DmA6lnUKMv2', 'user', 1, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- -----------------------------------------------------------------------------
-- 5. Seed Bahasa Awal (dapat ditambah/ubah oleh Admin)
-- -----------------------------------------------------------------------------
INSERT INTO `languages` (`id`, `code`, `name`, `native_name`, `prompt_hint`, `is_active`, `created_by`)
VALUES
  (1, 'id', 'Indonesian', 'Bahasa Indonesia', 'Gunakan bahasa Indonesia baku yang alami, jelas, dan mudah diketik tanpa singkatan aneh.', 1, 1),
  (2, 'en', 'English', 'English', 'Use natural, clear standard English suitable for touch typing practice.', 1, 1),
  (3, 'ja-romaji', 'Japanese (Romaji)', 'Nihongo (Romaji)', 'Write natural Japanese sentences transcribed cleanly in Hepburn Romaji using ASCII Latin letters only.', 1, 1),
  (4, 'de', 'German', 'Deutsch', 'Use natural, well-structured German suitable for typing practice.', 1, 1),
  (5, 'es', 'Spanish', 'Español', 'Use natural, clear Spanish suitable for typing practice.', 1, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- -----------------------------------------------------------------------------
-- 6. Seed Riwayat Balapan Awal (agar Podium & Grafik langsung aktif)
-- -----------------------------------------------------------------------------
INSERT IGNORE INTO `typing_sessions`
  (`id`, `user_id`, `language_id`, `keywords_json`, `ai_model`, `generated_text`, `wpm`, `raw_wpm`, `accuracy`, `total_chars`, `correct_chars`, `incorrect_chars`, `word_count`, `duration_seconds`)
VALUES
  (1, 2, 1, '["algoritma","server","enkripsi","database","jaringan"]', 'gemini-2.5-flash', 'Pengembangan algoritma yang efisien membantu server memproses permintaan jaringan dengan cepat sambil menjaga enkripsi data tetap aman di dalam database modern.', 92.40, 95.10, 98.40, 154, 152, 2, 21, 19.70),
  (2, 2, 2, '["cloud","latency","pipeline","security","deploy"]', 'gemini-2.5-flash', 'Modern cloud infrastructure reduces network latency while automated pipeline tools strengthen security checks before every production deploy.', 86.20, 89.00, 97.60, 136, 133, 3, 18, 18.50),
  (3, 1, 1, '["investasi","strategi","negosiasi","profit","audit"]', 'gemini-2.5-flash', 'Strategi investasi jangka panjang membutuhkan hasil audit yang transparan serta kemampuan negosiasi matang agar perusahaan memperoleh profit berkelanjutan.', 78.60, 81.20, 96.80, 152, 148, 4, 19, 22.60),
  (4, 1, 2, '["design","motion","layout","contrast","vector"]', 'gemini-2.0-flash', 'Thoughtful layout structure combines clean vector shapes with strong visual contrast and subtle motion cues for clear interface design.', 74.10, 76.80, 96.50, 134, 129, 5, 19, 20.90);
