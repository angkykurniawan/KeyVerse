<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/gemini.php';

function now_ms(): int
{
    return (int) round(microtime(true) * 1000);
}

function generate_room_code(PDO $pdo): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($attempt = 0; $attempt < 12; $attempt++) {
        $code = 'KV';
        for ($i = 0; $i < 4; $i++) {
            $code .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $check = $pdo->prepare('SELECT id FROM race_rooms WHERE code = ? LIMIT 1');
        $check->execute([$code]);
        if (!$check->fetch()) {
            return $code;
        }
    }
    return 'KV' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
}

function fetch_room_payload(PDO $pdo, string $code, array $currentUser): ?array
{
    $stmt = $pdo->prepare(
        'SELECT r.*, l.code AS language_code, l.name AS language_name, l.native_name AS language_native_name,
                u.name AS host_name, u.username AS host_username
         FROM race_rooms r
         INNER JOIN languages l ON l.id = r.language_id
         INNER JOIN users u ON u.id = r.host_user_id
         WHERE r.code = ?
         LIMIT 1'
    );
    $stmt->execute([strtoupper($code)]);
    $room = $stmt->fetch();
    if (!$room) {
        return null;
    }

    $roomId = (int) $room['id'];
    $nowMs = now_ms();

    // Otomatis transisi countdown -> racing saat waktu start tercapai
    if ($room['status'] === 'countdown' && !empty($room['starts_at_ms']) && $nowMs >= (int) $room['starts_at_ms']) {
        $upd = $pdo->prepare("UPDATE race_rooms SET status = 'racing', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $upd->execute([$roomId]);
        $room['status'] = 'racing';
    }

    // Ambil semua peserta room
    $pStmt = $pdo->prepare(
        'SELECT p.*, u.name, u.username
         FROM race_participants p
         INNER JOIN users u ON u.id = p.user_id
         WHERE p.room_id = ?
         ORDER BY p.joined_at ASC'
    );
    $pStmt->execute([$roomId]);
    $rawParticipants = $pStmt->fetchAll();

    // Cek apakah waktu 1 menit (60 detik) sudah habis atau semua peserta sudah selesai
    if ($room['status'] === 'racing' && count($rawParticipants) > 0) {
        $raceEndedByTime = !empty($room['starts_at_ms']) && $nowMs >= ((int) $room['starts_at_ms'] + 62000);
        $allFinished = true;
        foreach ($rawParticipants as $rp) {
            if (empty($rp['finished_at_ms'])) {
                $allFinished = false;
                break;
            }
        }
        if ($allFinished || $raceEndedByTime) {
            $upd = $pdo->prepare("UPDATE race_rooms SET status = 'finished', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
            $upd->execute([$roomId]);
            $room['status'] = 'finished';
        }
    }

    $participants = array_map(static function (array $p) use ($room, $currentUser): array {
        return [
            'user_id' => (int) $p['user_id'],
            'name' => (string) $p['name'],
            'username' => (string) $p['username'],
            'is_host' => ((int) $p['user_id'] === (int) $room['host_user_id']),
            'is_me' => ((int) $p['user_id'] === (int) $currentUser['id']),
            'is_ready' => ((int) $p['is_ready'] === 1),
            'progress' => (float) $p['progress'],
            'wpm' => (float) $p['wpm'],
            'raw_wpm' => (float) $p['raw_wpm'],
            'accuracy' => (float) $p['accuracy'],
            'correct_chars' => (int) $p['correct_chars'],
            'incorrect_chars' => (int) $p['incorrect_chars'],
            'duration_seconds' => (float) $p['duration_seconds'],
            'finished' => !empty($p['finished_at_ms']),
            'finished_at_ms' => !empty($p['finished_at_ms']) ? (int) $p['finished_at_ms'] : null,
        ];
    }, $rawParticipants);

    // Hitung peringkat live berdasarkan WPM tertinggi & akurasi (lomba 1 menit)
    $ranked = $participants;
    usort($ranked, static function (array $a, array $b): int {
        if (abs($b['wpm'] - $a['wpm']) > 0.05) {
            return $b['wpm'] <=> $a['wpm'];
        }
        if (abs($b['accuracy'] - $a['accuracy']) > 0.05) {
            return $b['accuracy'] <=> $a['accuracy'];
        }
        return $b['correct_chars'] <=> $a['correct_chars'];
    });

    $rankMap = [];
    foreach ($ranked as $idx => $item) {
        $rankMap[$item['user_id']] = $idx + 1;
    }

    foreach ($participants as &$p) {
        $p['rank'] = $rankMap[$p['user_id']] ?? 1;
    }
    unset($p);

    $keywords = json_decode((string) $room['keywords_json'], true);

    return [
        'id' => $roomId,
        'code' => (string) $room['code'],
        'host_user_id' => (int) $room['host_user_id'],
        'host_name' => (string) $room['host_name'],
        'host_username' => (string) $room['host_username'],
        'is_host' => ((int) $room['host_user_id'] === (int) $currentUser['id']),
        'language' => [
            'id' => (int) $room['language_id'],
            'code' => (string) $room['language_code'],
            'name' => (string) $room['language_name'],
            'native_name' => (string) $room['language_native_name'],
        ],
        'keywords' => is_array($keywords) ? $keywords : [],
        'ai_model' => (string) $room['ai_model'],
        'generated_text' => (string) $room['generated_text'],
        'word_count' => (int) $room['word_count'],
        'status' => (string) $room['status'],
        'starts_at_ms' => !empty($room['starts_at_ms']) ? (int) $room['starts_at_ms'] : null,
        'server_time_ms' => $nowMs,
        'participants' => $participants,
    ];
}

/**
 * Daftar room adu ketik terbuka (waiting) yang bisa langsung dimasuki kawan.
 */
function handle_rooms_open(PDO $pdo): void
{
    require_auth($pdo);

    $stmt = $pdo->query(
        "SELECT r.code, r.status, r.word_count, r.ai_model, r.keywords_json, r.created_at,
                l.native_name AS language_native_name, l.code AS language_code,
                u.name AS host_name, u.username AS host_username,
                (SELECT COUNT(*) FROM race_participants p WHERE p.room_id = r.id) AS participant_count
         FROM race_rooms r
         INNER JOIN languages l ON l.id = r.language_id
         INNER JOIN users u ON u.id = r.host_user_id
         WHERE r.status = 'waiting'
         ORDER BY r.id DESC
         LIMIT 15"
    );

    $rooms = array_map(static function (array $r): array {
        $kw = json_decode((string) $r['keywords_json'], true);
        return [
            'code' => (string) $r['code'],
            'host_name' => (string) $r['host_name'],
            'host_username' => (string) $r['host_username'],
            'language_native_name' => (string) $r['language_native_name'],
            'language_code' => (string) $r['language_code'],
            'keywords' => is_array($kw) ? $kw : [],
            'word_count' => (int) $r['word_count'],
            'ai_model' => (string) $r['ai_model'],
            'participant_count' => (int) $r['participant_count'],
            'created_at' => (string) $r['created_at'],
        ];
    }, $stmt->fetchAll());

    json_response(['rooms' => $rooms]);
}

/**
 * Buat room adu ketik 1 menit (panjang kata otomatis ~155 kata, model otomatis sesuai API key).
 */
function handle_room_create(PDO $pdo): void
{
    $user = require_auth($pdo);
    $body = get_json_body();

    $languageId = (int) ($body['language_id'] ?? 0);
    $rawKeywords = $body['keywords'] ?? [];
    $wordCount = 110;

    if ($languageId <= 0) {
        json_error('Pilih bahasa terlebih dahulu.', 422);
    }
    if (!is_array($rawKeywords) || count($rawKeywords) !== 5) {
        json_error('Masukkan tepat 5 kata utama untuk soal adu ketik.', 422);
    }

    $keywords = [];
    foreach ($rawKeywords as $idx => $kw) {
        $clean = trim(preg_replace('/\s+/u', ' ', (string) $kw) ?? '');
        if ($clean === '') {
            json_error('Kata utama #' . ($idx + 1) . ' tidak boleh kosong.', 422);
        }
        $keywords[] = mb_substr($clean, 0, 40);
    }

    $langStmt = $pdo->prepare('SELECT id, code, name, native_name, prompt_hint, is_active FROM languages WHERE id = ? LIMIT 1');
    $langStmt->execute([$languageId]);
    $language = $langStmt->fetch();
    if (!$language || (int) $language['is_active'] !== 1) {
        json_error('Bahasa tidak ditemukan atau sedang nonaktif.', 404);
    }

    $cfg = resolve_active_gemini_config($pdo);
    if ($cfg['key'] === '') {
        json_error('Layanan AI belum dikonfigurasi oleh Administrator. Hubungi Admin untuk mengatur API key Google AI Studio.', 503);
    }

    try {
        $gen = gemini_generate_typing_text_auto($cfg['key'], $cfg['preferred_model'], $language, $keywords, $wordCount);
        $generatedText = $gen['text'];
        $cleanModel = $gen['model_used'];
    } catch (Throwable $e) {
        $status = ($e->getCode() >= 400 && $e->getCode() < 500) ? (int) $e->getCode() : 502;
        json_error('Gagal membuat teks balapan dari Gemini AI: ' . $e->getMessage(), $status);
    }

    $words = preg_split('/\s+/u', trim($generatedText)) ?: [];
    $actualWordCount = count(array_filter($words, static fn(string $w): bool => $w !== ''));

    $code = generate_room_code($pdo);

    $stmt = $pdo->prepare(
        'INSERT INTO race_rooms (code, host_user_id, language_id, keywords_json, ai_model, generated_text, word_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $code,
        $user['id'],
        $languageId,
        json_encode($keywords, JSON_UNESCAPED_UNICODE),
        $cleanModel,
        $generatedText,
        $actualWordCount,
        'waiting',
    ]);
    $roomId = (int) $pdo->lastInsertId();

    // Host otomatis bergabung dan berstatus ready
    $join = $pdo->prepare(
        'INSERT INTO race_participants (room_id, user_id, is_ready) VALUES (?, ?, 1)'
    );
    $join->execute([$roomId, $user['id']]);

    $room = fetch_room_payload($pdo, $code, $user);
    json_response(['room' => $room], 201);
}

/**
 * Gabung ke room kawan dengan kode room.
 */
function handle_room_join(PDO $pdo): void
{
    $user = require_auth($pdo);
    $body = get_json_body();
    $code = strtoupper(trim((string) ($body['code'] ?? '')));

    if ($code === '') {
        json_error('Masukkan kode room terlebih dahulu.', 422);
    }

    $stmt = $pdo->prepare('SELECT id, status FROM race_rooms WHERE code = ? LIMIT 1');
    $stmt->execute([$code]);
    $room = $stmt->fetch();
    if (!$room) {
        json_error("Room dengan kode '{$code}' tidak ditemukan.", 404);
    }

    $roomId = (int) $room['id'];
    $exists = $pdo->prepare('SELECT id FROM race_participants WHERE room_id = ? AND user_id = ? LIMIT 1');
    $exists->execute([$roomId, $user['id']]);
    if (!$exists->fetch()) {
        if ($room['status'] !== 'waiting') {
            json_error('Balapan di room ini sudah dimulai atau selesai. Tunggu host membuat rematch atau buat room baru.', 409);
        }
        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM race_participants WHERE room_id = ?');
        $countStmt->execute([$roomId]);
        if ((int) $countStmt->fetchColumn() >= 8) {
            json_error('Room sudah penuh (maksimal 8 peserta).', 409);
        }

        $ins = $pdo->prepare('INSERT INTO race_participants (room_id, user_id, is_ready) VALUES (?, ?, 1)');
        $ins->execute([$roomId, $user['id']]);
    }

    $payload = fetch_room_payload($pdo, $code, $user);
    json_response(['room' => $payload]);
}

/**
 * Poll status live room & seluruh peserta.
 */
function handle_room_get(PDO $pdo, string $code): void
{
    $user = require_auth($pdo);
    $payload = fetch_room_payload($pdo, $code, $user);
    if ($payload === null) {
        json_error('Room tidak ditemukan.', 404);
    }
    json_response(['room' => $payload]);
}

/**
 * Toggle siap / belum siap di ruang tunggu.
 */
function handle_room_ready(PDO $pdo, string $code): void
{
    $user = require_auth($pdo);
    $body = get_json_body();

    $stmt = $pdo->prepare('SELECT id, status FROM race_rooms WHERE code = ? LIMIT 1');
    $stmt->execute([strtoupper($code)]);
    $room = $stmt->fetch();
    if (!$room) {
        json_error('Room tidak ditemukan.', 404);
    }

    $isReady = isset($body['is_ready']) ? ((bool) $body['is_ready'] ? 1 : 0) : 1;
    $upd = $pdo->prepare(
        'UPDATE race_participants SET is_ready = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?'
    );
    $upd->execute([$isReady, (int) $room['id'], $user['id']]);

    json_response(['room' => fetch_room_payload($pdo, $code, $user)]);
}

/**
 * Host memulai countdown serentak (3-2-1-GO!) untuk semua peserta room.
 */
function handle_room_start(PDO $pdo, string $code): void
{
    $user = require_auth($pdo);

    $stmt = $pdo->prepare('SELECT id, host_user_id, status FROM race_rooms WHERE code = ? LIMIT 1');
    $stmt->execute([strtoupper($code)]);
    $room = $stmt->fetch();
    if (!$room) {
        json_error('Room tidak ditemukan.', 404);
    }
    if ((int) $room['host_user_id'] !== $user['id']) {
        json_error('Hanya host room yang dapat memulai balapan.', 403);
    }
    if ($room['status'] !== 'waiting') {
        json_error('Balapan sudah berjalan atau selesai.', 409);
    }

    $startsAtMs = now_ms() + 4000; // Countdown sinkron 4 detik
    $upd = $pdo->prepare(
        "UPDATE race_rooms SET status = 'countdown', starts_at_ms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    );
    $upd->execute([$startsAtMs, (int) $room['id']]);

    json_response(['room' => fetch_room_payload($pdo, $code, $user)]);
}

/**
 * Kirim progres mengetik live (WPM, akurasi, %) selama balapan & simpan hasil saat finish.
 */
function handle_room_progress(PDO $pdo, string $code): void
{
    $user = require_auth($pdo);
    $body = get_json_body();

    $stmt = $pdo->prepare('SELECT * FROM race_rooms WHERE code = ? LIMIT 1');
    $stmt->execute([strtoupper($code)]);
    $room = $stmt->fetch();
    if (!$room) {
        json_error('Room tidak ditemukan.', 404);
    }

    $roomId = (int) $room['id'];
    $pStmt = $pdo->prepare('SELECT * FROM race_participants WHERE room_id = ? AND user_id = ? LIMIT 1');
    $pStmt->execute([$roomId, $user['id']]);
    $part = $pStmt->fetch();
    if (!$part) {
        json_error('Anda tidak terdaftar di room ini.', 403);
    }

    $progress = max(0, min(100, round((float) ($body['progress'] ?? 0), 2)));
    $wpm = max(0, min(400, round((float) ($body['wpm'] ?? 0), 2)));
    $rawWpm = max(0, min(400, round((float) ($body['raw_wpm'] ?? $wpm), 2)));
    $accuracy = max(0, min(100, round((float) ($body['accuracy'] ?? 100), 2)));
    $correctChars = max(0, (int) ($body['correct_chars'] ?? 0));
    $incorrectChars = max(0, (int) ($body['incorrect_chars'] ?? 0));
    $durationSeconds = max(0, round((float) ($body['duration_seconds'] ?? 0), 2));
    $finished = (bool) ($body['finished'] ?? false);

    $finishedAtMs = !empty($part['finished_at_ms']) ? (int) $part['finished_at_ms'] : null;
    if ($finished && $finishedAtMs === null) {
        $finishedAtMs = now_ms();
        $progress = 100.0;
    }

    $sessionSaved = (int) $part['session_saved'];
    if ($finished && $sessionSaved === 0) {
        // Catat otomatis ke tabel typing_sessions agar masuk Klasemen & Progres pribadi!
        $totalChars = mb_strlen((string) $room['generated_text']);
        $saveStmt = $pdo->prepare(
            'INSERT INTO typing_sessions
                (user_id, language_id, keywords_json, ai_model, generated_text, wpm, raw_wpm, accuracy,
                 total_chars, correct_chars, incorrect_chars, word_count, duration_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $saveStmt->execute([
            $user['id'],
            (int) $room['language_id'],
            (string) $room['keywords_json'],
            (string) $room['ai_model'],
            (string) $room['generated_text'],
            $wpm,
            $rawWpm,
            $accuracy,
            $totalChars,
            $correctChars,
            $incorrectChars,
            (int) $room['word_count'],
            max(0.1, $durationSeconds),
        ]);
        $sessionSaved = 1;
    }

    $upd = $pdo->prepare(
        'UPDATE race_participants
         SET progress = ?, wpm = ?, raw_wpm = ?, accuracy = ?, correct_chars = ?, incorrect_chars = ?,
             duration_seconds = ?, finished_at_ms = ?, session_saved = ?, updated_at = CURRENT_TIMESTAMP
         WHERE room_id = ? AND user_id = ?'
    );
    $upd->execute([
        $progress,
        $wpm,
        $rawWpm,
        $accuracy,
        $correctChars,
        $incorrectChars,
        $durationSeconds,
        $finishedAtMs,
        $sessionSaved,
        $roomId,
        $user['id'],
    ]);

    json_response(['room' => fetch_room_payload($pdo, $code, $user)]);
}

/**
 * Host memulai ronde rematch baru dengan teks baru dari Gemini AI di room yang sama.
 */
function handle_room_rematch(PDO $pdo, string $code): void
{
    $user = require_auth($pdo);

    $stmt = $pdo->prepare(
        'SELECT r.*, l.code AS lang_code, l.name AS lang_name, l.native_name AS lang_native_name, l.prompt_hint
         FROM race_rooms r
         INNER JOIN languages l ON l.id = r.language_id
         WHERE r.code = ? LIMIT 1'
    );
    $stmt->execute([strtoupper($code)]);
    $room = $stmt->fetch();
    if (!$room) {
        json_error('Room tidak ditemukan.', 404);
    }
    if ((int) $room['host_user_id'] !== $user['id']) {
        json_error('Hanya host room yang dapat memulai rematch.', 403);
    }

    $cfg = resolve_active_gemini_config($pdo);
    if ($cfg['key'] === '') {
        json_error('Layanan AI belum dikonfigurasi oleh Administrator.', 503);
    }

    $keywords = json_decode((string) $room['keywords_json'], true);
    if (!is_array($keywords) || count($keywords) !== 5) {
        $keywords = ['turnamen', 'refleks', 'kombo', 'juara', 'arena'];
    }

    $language = [
        'name' => $room['lang_name'],
        'native_name' => $room['lang_native_name'],
        'prompt_hint' => $room['prompt_hint'],
    ];

    try {
        $gen = gemini_generate_typing_text_auto(
            $cfg['key'],
            $cfg['preferred_model'],
            $language,
            $keywords,
            110
        );
        $newText = $gen['text'];
        $modelUsed = $gen['model_used'];
    } catch (Throwable $e) {
        json_error('Gagal membuat teks rematch dari Gemini AI: ' . $e->getMessage(), 502);
    }

    $words = preg_split('/\s+/u', trim($newText)) ?: [];
    $actualWordCount = count(array_filter($words, static fn(string $w): bool => $w !== ''));

    $roomId = (int) $room['id'];
    $updRoom = $pdo->prepare(
        "UPDATE race_rooms
         SET generated_text = ?, word_count = ?, ai_model = ?, status = 'waiting', starts_at_ms = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?"
    );
    $updRoom->execute([$newText, $actualWordCount, $modelUsed, $roomId]);

    $resetParts = $pdo->prepare(
        'UPDATE race_participants
         SET progress = 0, wpm = 0, raw_wpm = 0, accuracy = 100, correct_chars = 0, incorrect_chars = 0,
             duration_seconds = 0, finished_at_ms = NULL, session_saved = 0, is_ready = 1, updated_at = CURRENT_TIMESTAMP
         WHERE room_id = ?'
    );
    $resetParts->execute([$roomId]);

    json_response(['room' => fetch_room_payload($pdo, $code, $user)]);
}

/**
 * Keluar dari room saat menunggu.
 */
function handle_room_leave(PDO $pdo, string $code): void
{
    $user = require_auth($pdo);
    $stmt = $pdo->prepare('SELECT id, host_user_id FROM race_rooms WHERE code = ? LIMIT 1');
    $stmt->execute([strtoupper($code)]);
    $room = $stmt->fetch();
    if (!$room) {
        json_response(['message' => 'Sudah keluar dari room.']);
    }

    $roomId = (int) $room['id'];
    $del = $pdo->prepare('DELETE FROM race_participants WHERE room_id = ? AND user_id = ?');
    $del->execute([$roomId, $user['id']]);

    // Jika host keluar, alihkan host ke peserta berikutnya atau hapus room jika kosong
    if ((int) $room['host_user_id'] === $user['id']) {
        $next = $pdo->prepare('SELECT user_id FROM race_participants WHERE room_id = ? ORDER BY joined_at ASC LIMIT 1');
        $next->execute([$roomId]);
        $nextHost = $next->fetch();
        if ($nextHost) {
            $upd = $pdo->prepare('UPDATE race_rooms SET host_user_id = ? WHERE id = ?');
            $upd->execute([(int) $nextHost['user_id'], $roomId]);
        } else {
            $delRoom = $pdo->prepare('DELETE FROM race_rooms WHERE id = ?');
            $delRoom->execute([$roomId]);
        }
    }

    json_response(['message' => 'Berhasil keluar dari room.']);
}
