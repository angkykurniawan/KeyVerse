<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

function handle_languages_list(PDO $pdo): void
{
    $user = require_auth($pdo);
    $includeAll = (($_GET['all'] ?? '') === '1') && ($user['role'] === 'admin');

    if ($includeAll) {
        $stmt = $pdo->query(
            'SELECT l.id, l.code, l.name, l.native_name, l.prompt_hint, l.is_active, l.created_at,
                    (SELECT COUNT(*) FROM typing_sessions s WHERE s.language_id = l.id) AS session_count
             FROM languages l
             ORDER BY l.is_active DESC, l.name ASC'
        );
    } else {
        $stmt = $pdo->query(
            'SELECT id, code, name, native_name, prompt_hint, is_active, created_at
             FROM languages
             WHERE is_active = 1
             ORDER BY name ASC'
        );
    }

    $rows = $stmt->fetchAll();
    $languages = array_map(static function (array $r): array {
        $item = [
            'id' => (int) $r['id'],
            'code' => (string) $r['code'],
            'name' => (string) $r['name'],
            'native_name' => (string) $r['native_name'],
            'prompt_hint' => (string) ($r['prompt_hint'] ?? ''),
            'is_active' => (bool) ((int) $r['is_active'] === 1),
            'created_at' => (string) $r['created_at'],
        ];
        if (isset($r['session_count'])) {
            $item['session_count'] = (int) $r['session_count'];
        }
        return $item;
    }, $rows);

    json_response(['languages' => $languages]);
}

function handle_admin_language_create(PDO $pdo): void
{
    $admin = require_admin($pdo);
    $body = get_json_body();

    $code = strtolower(trim((string) ($body['code'] ?? '')));
    $name = trim((string) ($body['name'] ?? ''));
    $nativeName = trim((string) ($body['native_name'] ?? $name));
    $promptHint = trim((string) ($body['prompt_hint'] ?? ''));
    $isActive = array_key_exists('is_active', $body) ? ((bool) $body['is_active'] ? 1 : 0) : 1;

    if ($code === '' || !preg_match('/^[a-z0-9_-]{2,20}$/', $code)) {
        json_error('Kode bahasa wajib diisi (2-20 karakter huruf kecil, angka, tanda hubung/underscore, misal: id, en, fr, ja-romaji).', 422);
    }
    if ($name === '' || mb_strlen($name) > 100) {
        json_error('Nama bahasa wajib diisi (maksimal 100 karakter).', 422);
    }
    if ($nativeName === '') {
        $nativeName = $name;
    }

    $check = $pdo->prepare('SELECT id FROM languages WHERE LOWER(code) = ? LIMIT 1');
    $check->execute([$code]);
    if ($check->fetch()) {
        json_error("Kode bahasa '{$code}' sudah terdaftar.", 409);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO languages (code, name, native_name, prompt_hint, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$code, $name, $nativeName, $promptHint !== '' ? $promptHint : null, $isActive, $admin['id']]);
    $id = (int) $pdo->lastInsertId();

    json_response([
        'message' => 'Bahasa baru berhasil ditambahkan.',
        'language' => [
            'id' => $id,
            'code' => $code,
            'name' => $name,
            'native_name' => $nativeName,
            'prompt_hint' => $promptHint,
            'is_active' => $isActive === 1,
            'session_count' => 0,
        ],
    ], 201);
}

function handle_admin_language_update(PDO $pdo, int $id): void
{
    require_admin($pdo);
    $body = get_json_body();

    $existingStmt = $pdo->prepare('SELECT * FROM languages WHERE id = ? LIMIT 1');
    $existingStmt->execute([$id]);
    $existing = $existingStmt->fetch();
    if (!$existing) {
        json_error('Bahasa tidak ditemukan.', 404);
    }

    $code = array_key_exists('code', $body) ? strtolower(trim((string) $body['code'])) : (string) $existing['code'];
    $name = array_key_exists('name', $body) ? trim((string) $body['name']) : (string) $existing['name'];
    $nativeName = array_key_exists('native_name', $body) ? trim((string) $body['native_name']) : (string) $existing['native_name'];
    $promptHint = array_key_exists('prompt_hint', $body) ? trim((string) $body['prompt_hint']) : (string) ($existing['prompt_hint'] ?? '');
    $isActive = array_key_exists('is_active', $body) ? ((bool) $body['is_active'] ? 1 : 0) : (int) $existing['is_active'];

    if ($code === '' || !preg_match('/^[a-z0-9_-]{2,20}$/', $code)) {
        json_error('Kode bahasa tidak valid.', 422);
    }
    if ($name === '' || mb_strlen($name) > 100) {
        json_error('Nama bahasa wajib diisi.', 422);
    }
    if ($nativeName === '') {
        $nativeName = $name;
    }

    $dup = $pdo->prepare('SELECT id FROM languages WHERE LOWER(code) = ? AND id <> ? LIMIT 1');
    $dup->execute([$code, $id]);
    if ($dup->fetch()) {
        json_error("Kode bahasa '{$code}' sudah digunakan bahasa lain.", 409);
    }

    $upd = $pdo->prepare(
        'UPDATE languages
         SET code = ?, name = ?, native_name = ?, prompt_hint = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?'
    );
    $upd->execute([$code, $name, $nativeName, $promptHint !== '' ? $promptHint : null, $isActive, $id]);

    json_response([
        'message' => 'Data bahasa berhasil diperbarui.',
        'language' => [
            'id' => $id,
            'code' => $code,
            'name' => $name,
            'native_name' => $nativeName,
            'prompt_hint' => $promptHint,
            'is_active' => $isActive === 1,
        ],
    ]);
}

function handle_admin_language_delete(PDO $pdo, int $id): void
{
    require_admin($pdo);

    $existing = $pdo->prepare('SELECT id, name FROM languages WHERE id = ? LIMIT 1');
    $existing->execute([$id]);
    if (!$existing->fetch()) {
        json_error('Bahasa tidak ditemukan.', 404);
    }

    $usage = $pdo->prepare('SELECT COUNT(*) FROM typing_sessions WHERE language_id = ?');
    $usage->execute([$id]);
    if ((int) $usage->fetchColumn() > 0) {
        json_error('Bahasa ini sudah memiliki riwayat latihan. Nonaktifkan saja statusnya agar riwayat user tetap terjaga.', 409);
    }

    $del = $pdo->prepare('DELETE FROM languages WHERE id = ?');
    $del->execute([$id]);

    json_response(['message' => 'Bahasa berhasil dihapus.']);
}
