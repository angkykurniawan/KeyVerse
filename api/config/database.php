<?php
declare(strict_types=1);

require_once __DIR__ . '/env.php';

/**
 * Mengembalikan koneksi PDO tunggal (MySQL untuk InfinityFree atau SQLite untuk lokal).
 */
function get_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $driver = strtolower(env('DB_DRIVER', 'mysql') ?: 'mysql');

    if ($driver === 'sqlite') {
        $relPath = env('DB_SQLITE_PATH', 'storage/keyverse.sqlite') ?: 'storage/keyverse.sqlite';
        $fullPath = str_starts_with($relPath, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $relPath)
            ? $relPath
            : dirname(__DIR__) . '/' . ltrim($relPath, '/\\');

        $dir = dirname($fullPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $pdo = new PDO('sqlite:' . $fullPath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON;');
        init_sqlite_schema($pdo);
    } else {
        $host = env('DB_HOST', 'localhost');
        $port = env('DB_PORT', '3306');
        $name = env('DB_NAME', '');
        $user = env('DB_USER', '');
        $pass = env('DB_PASS', '');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        ensure_mysql_multiplayer_tables($pdo);
    }

    ensure_initial_admin($pdo);

    return $pdo;
}

function ensure_mysql_multiplayer_tables(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    try {
        $pdo->exec("
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
              KEY `idx_race_rooms_status` (`status`, `created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->exec("
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
              KEY `idx_participants_room` (`room_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `app_settings` (
              `setting_key` VARCHAR(64) NOT NULL,
              `setting_value` TEXT NOT NULL,
              `updated_by` INT UNSIGNED NULL,
              `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (`setting_key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    } catch (Throwable $e) {
        // Abaikan jika tabel utama belum dibuat
    }
}

function init_sqlite_schema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS languages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            native_name TEXT NOT NULL,
            prompt_hint TEXT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS typing_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            language_id INTEGER NOT NULL,
            keywords_json TEXT NOT NULL,
            ai_model TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            wpm REAL NOT NULL DEFAULT 0,
            raw_wpm REAL NOT NULL DEFAULT 0,
            accuracy REAL NOT NULL DEFAULT 0,
            total_chars INTEGER NOT NULL DEFAULT 0,
            correct_chars INTEGER NOT NULL DEFAULT 0,
            incorrect_chars INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER NOT NULL DEFAULT 0,
            duration_seconds REAL NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE RESTRICT
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON typing_sessions(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_language ON typing_sessions(language_id);

        CREATE TABLE IF NOT EXISTS race_rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            host_user_id INTEGER NOT NULL,
            language_id INTEGER NOT NULL,
            keywords_json TEXT NOT NULL,
            ai_model TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            word_count INTEGER NOT NULL DEFAULT 45,
            status TEXT NOT NULL DEFAULT 'waiting',
            starts_at_ms INTEGER NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS race_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_ready INTEGER NOT NULL DEFAULT 0,
            progress REAL NOT NULL DEFAULT 0,
            wpm REAL NOT NULL DEFAULT 0,
            raw_wpm REAL NOT NULL DEFAULT 0,
            accuracy REAL NOT NULL DEFAULT 100,
            correct_chars INTEGER NOT NULL DEFAULT 0,
            incorrect_chars INTEGER NOT NULL DEFAULT 0,
            duration_seconds REAL NOT NULL DEFAULT 0,
            finished_at_ms INTEGER NULL,
            session_saved INTEGER NOT NULL DEFAULT 0,
            joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(room_id, user_id),
            FOREIGN KEY (room_id) REFERENCES race_rooms(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_by INTEGER NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        );
    ");

    // Seed bahasa awal jika tabel languages masih kosong
    $count = (int) $pdo->query('SELECT COUNT(*) FROM languages')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare(
            'INSERT INTO languages (code, name, native_name, prompt_hint, is_active) VALUES (?, ?, ?, ?, 1)'
        );
        $defaults = [
            ['id', 'Indonesian', 'Bahasa Indonesia', 'Gunakan bahasa Indonesia baku yang alami, jelas, dan mudah diketik tanpa singkatan aneh.'],
            ['en', 'English', 'English', 'Use natural, clear standard English suitable for touch typing practice.'],
            ['ja-romaji', 'Japanese (Romaji)', 'Nihongo (Romaji)', 'Write natural Japanese sentences transcribed cleanly in Hepburn Romaji using ASCII Latin letters only.'],
            ['de', 'German', 'Deutsch', 'Use natural, well-structured German suitable for typing practice.'],
            ['es', 'Spanish', 'Español', 'Use natural, clear Spanish suitable for typing practice.'],
        ];
        foreach ($defaults as $lang) {
            $stmt->execute($lang);
        }
    }
}

/**
 * Membuat akun admin awal (dari .env) serta user dummy lokal jika tabel users masih kosong.
 */
function ensure_initial_admin(PDO $pdo): void
{
    static $checked = false;
    if ($checked) {
        return;
    }
    $checked = true;

    try {
        $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($count > 0) {
            return;
        }

        $name = trim((string) env('ADMIN_INIT_NAME', 'Administrator'));
        $username = strtolower(trim((string) env('ADMIN_INIT_USERNAME', 'admin')));
        $email = strtolower(trim((string) env('ADMIN_INIT_EMAIL', 'admin@keyverse.local')));
        $password = (string) env('ADMIN_INIT_PASSWORD', '');

        if ($username === '' || $password === '') {
            return;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare(
            'INSERT INTO users (name, username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)'
        );
        $stmt->execute([$name !== '' ? $name : 'Administrator', $username, $email, $hash, 'admin']);
        $adminId = (int) $pdo->lastInsertId();

        // Pada mode lokal (SQLite), tambahkan juga 4 user dummy + beberapa sesi agar podium langsung aktif
        $driver = strtolower(env('DB_DRIVER', 'mysql') ?: 'mysql');
        if ($driver === 'sqlite') {
            seed_local_dummy_data($pdo, $adminId);
        }
    } catch (Throwable $e) {
        // Jangan crash jika tabel belum di-import saat health check
    }
}

function seed_local_dummy_data(PDO $pdo, int $adminId): void
{
    $dummyPassHash = password_hash('UserKeyVerse123!', PASSWORD_BCRYPT);
    $insertUser = $pdo->prepare(
        'INSERT INTO users (name, username, email, password_hash, role, is_active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );

    $dummies = [
        ['Nadia Pratama', 'nadia.speed', 'nadia@keyverse.local'],
        ['Raka Wijaya', 'raka.pro', 'raka@keyverse.local'],
        ['Budi Santoso', 'budi.racer', 'budi@keyverse.local'],
        ['Sinta Maharani', 'sinta.dev', 'sinta@keyverse.local'],
    ];

    $userIds = [];
    foreach ($dummies as [$dName, $dUser, $dEmail]) {
        $insertUser->execute([$dName, $dUser, $dEmail, $dummyPassHash, 'user', $adminId]);
        $userIds[$dUser] = (int) $pdo->lastInsertId();
    }

    $insertSess = $pdo->prepare(
        'INSERT INTO typing_sessions
            (user_id, language_id, keywords_json, ai_model, generated_text, wpm, raw_wpm, accuracy,
             total_chars, correct_chars, incorrect_chars, word_count, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $sessions = [
        [$userIds['nadia.speed'], 1, '["algoritma","server","enkripsi","database","jaringan"]', 'gemini-2.5-flash', 'Pengembangan algoritma yang efisien membantu server memproses permintaan jaringan dengan cepat sambil menjaga enkripsi data tetap aman di dalam database modern.', 92.4, 95.1, 98.4, 154, 152, 2, 21, 19.7],
        [$userIds['nadia.speed'], 2, '["cloud","latency","pipeline","security","deploy"]', 'gemini-2.5-flash', 'Modern cloud infrastructure reduces network latency while automated pipeline tools strengthen security checks before every production deploy.', 86.2, 89.0, 97.6, 136, 133, 3, 18, 18.5],
        [$userIds['raka.pro'], 1, '["investasi","strategi","negosiasi","profit","audit"]', 'gemini-2.5-flash', 'Strategi investasi jangka panjang membutuhkan hasil audit yang transparan serta kemampuan negosiasi matang agar perusahaan memperoleh profit berkelanjutan.', 78.6, 81.2, 96.8, 152, 148, 4, 19, 22.6],
        [$userIds['budi.racer'], 1, '["turnamen","refleks","kombo","juara","arena"]', 'gemini-2.5-flash', 'Setiap peserta turnamen melatih refleks jari di arena latihan agar mampu menjaga kombo ketikan tetap stabil hingga menjadi juara utama.', 69.5, 72.1, 96.9, 135, 131, 4, 20, 22.6],
        [$userIds['sinta.dev'], 2, '["compiler","memory","syntax","runtime","module"]', 'gemini-2.5-flash', 'A reliable compiler validates program syntax early, manages memory safely during runtime, and links every reusable module without slowing down builds.', 58.3, 61.0, 95.8, 148, 142, 6, 21, 29.2],
    ];

    foreach ($sessions as $s) {
        $insertSess->execute($s);
    }
}
