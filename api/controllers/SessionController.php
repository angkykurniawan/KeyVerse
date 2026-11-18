<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

function handle_session_create(PDO $pdo): void
{
    $user = require_auth($pdo);
    $body = get_json_body();

    $languageId = (int) ($body['language_id'] ?? 0);
    $keywords = $body['keywords'] ?? [];
    $aiModel = trim((string) ($body['ai_model'] ?? ''));
    $generatedText = trim((string) ($body['generated_text'] ?? ''));
    $wpm = round((float) ($body['wpm'] ?? 0), 2);
    $rawWpm = round((float) ($body['raw_wpm'] ?? $wpm), 2);
    $accuracy = round((float) ($body['accuracy'] ?? 0), 2);
    $totalChars = max(0, (int) ($body['total_chars'] ?? 0));
    $correctChars = max(0, (int) ($body['correct_chars'] ?? 0));
    $incorrectChars = max(0, (int) ($body['incorrect_chars'] ?? 0));
    $wordCount = max(0, (int) ($body['word_count'] ?? 0));
    $durationSeconds = round(max(0.1, (float) ($body['duration_seconds'] ?? 0)), 2);

    if ($languageId <= 0 || !is_array($keywords) || count($keywords) !== 5) {
        json_error('Data bahasa atau 5 kata utama tidak valid.', 422);
    }
    if ($aiModel === '' || $generatedText === '') {
        json_error('Model AI dan teks latihan wajib disertakan.', 422);
    }

    $wpm = max(0, min(400, $wpm));
    $rawWpm = max(0, min(400, $rawWpm));
    $accuracy = max(0, min(100, $accuracy));

    $cleanKeywords = array_values(array_map(static fn($k): string => trim((string) $k), $keywords));
    $keywordsJson = json_encode($cleanKeywords, JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare(
        'INSERT INTO typing_sessions
            (user_id, language_id, keywords_json, ai_model, generated_text, wpm, raw_wpm, accuracy,
             total_chars, correct_chars, incorrect_chars, word_count, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $user['id'],
        $languageId,
        $keywordsJson,
        mb_substr($aiModel, 0, 120),
        $generatedText,
        $wpm,
        $rawWpm,
        $accuracy,
        $totalChars,
        $correctChars,
        $incorrectChars,
        $wordCount,
        $durationSeconds,
    ]);

    $id = (int) $pdo->lastInsertId();

    json_response([
        'message' => 'Hasil latihan berhasil disimpan.',
        'session_id' => $id,
    ], 201);
}

function handle_sessions_list(PDO $pdo): void
{
    $user = require_auth($pdo);
    $languageId = isset($_GET['language_id']) && $_GET['language_id'] !== '' ? (int) $_GET['language_id'] : null;
    $limit = isset($_GET['limit']) ? max(1, min(100, (int) $_GET['limit'])) : 50;

    $where = 's.user_id = ?';
    $params = [$user['id']];
    if ($languageId !== null && $languageId > 0) {
        $where .= ' AND s.language_id = ?';
        $params[] = $languageId;
    }

    $stmt = $pdo->prepare(
        "SELECT s.id, s.language_id, l.code AS language_code, l.name AS language_name, l.native_name AS language_native_name,
                s.keywords_json, s.ai_model, s.wpm, s.raw_wpm, s.accuracy,
                s.total_chars, s.correct_chars, s.incorrect_chars, s.word_count,
                s.duration_seconds, s.created_at
         FROM typing_sessions s
         INNER JOIN languages l ON l.id = s.language_id
         WHERE {$where}
         ORDER BY s.created_at DESC, s.id DESC
         LIMIT {$limit}"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $sessions = array_map(static function (array $r): array {
        $kw = json_decode((string) $r['keywords_json'], true);
        return [
            'id' => (int) $r['id'],
            'language_id' => (int) $r['language_id'],
            'language_code' => (string) $r['language_code'],
            'language_name' => (string) $r['language_name'],
            'language_native_name' => (string) $r['language_native_name'],
            'keywords' => is_array($kw) ? $kw : [],
            'ai_model' => (string) $r['ai_model'],
            'wpm' => (float) $r['wpm'],
            'raw_wpm' => (float) $r['raw_wpm'],
            'accuracy' => (float) $r['accuracy'],
            'total_chars' => (int) $r['total_chars'],
            'correct_chars' => (int) $r['correct_chars'],
            'incorrect_chars' => (int) $r['incorrect_chars'],
            'word_count' => (int) $r['word_count'],
            'duration_seconds' => (float) $r['duration_seconds'],
            'created_at' => (string) $r['created_at'],
        ];
    }, $rows);

    // Statistik ringkasan (mengikuti filter bahasa jika ada)
    $summaryStmt = $pdo->prepare(
        "SELECT
            COUNT(*) AS total_sessions,
            COALESCE(ROUND(MAX(s.wpm), 1), 0) AS best_wpm,
            COALESCE(ROUND(AVG(s.wpm), 1), 0) AS avg_wpm,
            COALESCE(ROUND(AVG(s.accuracy), 1), 0) AS avg_accuracy,
            COALESCE(SUM(s.word_count), 0) AS total_words,
            COALESCE(ROUND(SUM(s.duration_seconds), 1), 0) AS total_duration_seconds
         FROM typing_sessions s
         WHERE {$where}"
    );
    $summaryStmt->execute($params);
    $summary = $summaryStmt->fetch() ?: [];

    // Ringkasan per bahasa untuk user ini
    $byLangStmt = $pdo->prepare(
        'SELECT l.id AS language_id, l.code, l.name, l.native_name,
                COUNT(s.id) AS sessions,
                ROUND(AVG(s.wpm), 1) AS avg_wpm,
                ROUND(MAX(s.wpm), 1) AS best_wpm,
                ROUND(AVG(s.accuracy), 1) AS avg_accuracy
         FROM typing_sessions s
         INNER JOIN languages l ON l.id = s.language_id
         WHERE s.user_id = ?
         GROUP BY l.id, l.code, l.name, l.native_name
         ORDER BY sessions DESC'
    );
    $byLangStmt->execute([$user['id']]);
    $byLanguage = array_map(static function (array $r): array {
        return [
            'language_id' => (int) $r['language_id'],
            'code' => (string) $r['code'],
            'name' => (string) $r['name'],
            'native_name' => (string) $r['native_name'],
            'sessions' => (int) $r['sessions'],
            'avg_wpm' => (float) $r['avg_wpm'],
            'best_wpm' => (float) $r['best_wpm'],
            'avg_accuracy' => (float) $r['avg_accuracy'],
        ];
    }, $byLangStmt->fetchAll());

    // Data tren untuk grafik (urutan kronologis lama -> baru, maksimal 30 sesi terakhir)
    $trend = array_reverse(array_slice($sessions, 0, 30));

    json_response([
        'summary' => [
            'total_sessions' => (int) ($summary['total_sessions'] ?? 0),
            'best_wpm' => (float) ($summary['best_wpm'] ?? 0),
            'avg_wpm' => (float) ($summary['avg_wpm'] ?? 0),
            'avg_accuracy' => (float) ($summary['avg_accuracy'] ?? 0),
            'total_words' => (int) ($summary['total_words'] ?? 0),
            'total_duration_seconds' => (float) ($summary['total_duration_seconds'] ?? 0),
        ],
        'by_language' => $byLanguage,
        'trend' => $trend,
        'sessions' => $sessions,
    ]);
}

function handle_session_delete(PDO $pdo, int $id): void
{
    $user = require_auth($pdo);
    $stmt = $pdo->prepare('DELETE FROM typing_sessions WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $user['id']]);

    if ($stmt->rowCount() === 0) {
        json_error('Riwayat latihan tidak ditemukan.', 404);
    }

    json_response(['message' => 'Riwayat latihan berhasil dihapus.']);
}

/**
 * Papan peringkat perlombaan antar user terdaftar (berdasarkan rekor WPM terbaik).
 */
function handle_leaderboard(PDO $pdo): void
{
    $currentUser = require_auth($pdo);
    $languageId = isset($_GET['language_id']) && $_GET['language_id'] !== '' ? (int) $_GET['language_id'] : null;

    $where = 'u.is_active = 1';
    $params = [];
    if ($languageId !== null && $languageId > 0) {
        $where .= ' AND s.language_id = ?';
        $params[] = $languageId;
    }

    $stmt = $pdo->prepare(
        "SELECT u.id AS user_id, u.name, u.username,
                COUNT(s.id) AS total_races,
                ROUND(MAX(s.wpm), 1) AS best_wpm,
                ROUND(AVG(s.wpm), 1) AS avg_wpm,
                ROUND(AVG(s.accuracy), 1) AS avg_accuracy,
                MAX(s.created_at) AS last_race_at
         FROM typing_sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE {$where}
         GROUP BY u.id, u.name, u.username
         ORDER BY best_wpm DESC, avg_accuracy DESC, total_races DESC
         LIMIT 25"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $leaderboard = [];
    $rank = 1;
    foreach ($rows as $r) {
        $leaderboard[] = [
            'rank' => $rank++,
            'user_id' => (int) $r['user_id'],
            'name' => (string) $r['name'],
            'username' => (string) $r['username'],
            'is_me' => ((int) $r['user_id'] === $currentUser['id']),
            'total_races' => (int) $r['total_races'],
            'best_wpm' => (float) $r['best_wpm'],
            'avg_wpm' => (float) $r['avg_wpm'],
            'avg_accuracy' => (float) $r['avg_accuracy'],
            'last_race_at' => (string) $r['last_race_at'],
        ];
    }

    json_response(['leaderboard' => $leaderboard]);
}
