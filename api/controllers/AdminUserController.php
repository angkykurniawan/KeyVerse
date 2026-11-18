<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

function handle_admin_overview(PDO $pdo): void
{
    require_admin($pdo);

    $userStats = $pdo->query(
        "SELECT
            COUNT(*) AS total_users,
            SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS learner_count,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users
         FROM users"
    )->fetch();

    $langStats = $pdo->query(
        'SELECT
            COUNT(*) AS total_languages,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_languages
         FROM languages'
    )->fetch();

    $sessionStats = $pdo->query(
        'SELECT
            COUNT(*) AS total_sessions,
            COALESCE(ROUND(AVG(wpm), 1), 0) AS avg_wpm,
            COALESCE(ROUND(AVG(accuracy), 1), 0) AS avg_accuracy,
            COALESCE(MAX(wpm), 0) AS best_wpm
         FROM typing_sessions'
    )->fetch();

    json_response([
        'overview' => [
            'total_users' => (int) ($userStats['total_users'] ?? 0),
            'learner_count' => (int) ($userStats['learner_count'] ?? 0),
            'active_users' => (int) ($userStats['active_users'] ?? 0),
            'total_languages' => (int) ($langStats['total_languages'] ?? 0),
            'active_languages' => (int) ($langStats['active_languages'] ?? 0),
            'total_sessions' => (int) ($sessionStats['total_sessions'] ?? 0),
            'avg_wpm' => (float) ($sessionStats['avg_wpm'] ?? 0),
            'avg_accuracy' => (float) ($sessionStats['avg_accuracy'] ?? 0),
            'best_wpm' => (float) ($sessionStats['best_wpm'] ?? 0),
        ],
    ]);
}

function handle_admin_users_list(PDO $pdo): void
{
    require_admin($pdo);

    $stmt = $pdo->query(
        'SELECT u.id, u.name, u.username, u.email, u.role, u.is_active, u.created_at,
                COUNT(s.id) AS session_count,
                COALESCE(ROUND(AVG(s.wpm), 1), 0) AS avg_wpm,
                COALESCE(ROUND(AVG(s.accuracy), 1), 0) AS avg_accuracy
         FROM users u
         LEFT JOIN typing_sessions s ON s.user_id = u.id
         GROUP BY u.id, u.name, u.username, u.email, u.role, u.is_active, u.created_at
         ORDER BY u.created_at DESC'
    );

    $users = array_map(static function (array $r): array {
        return [
            'id' => (int) $r['id'],
            'name' => (string) $r['name'],
            'username' => (string) $r['username'],
            'email' => (string) $r['email'],
            'role' => (string) $r['role'],
            'is_active' => (bool) ((int) $r['is_active'] === 1),
            'created_at' => (string) $r['created_at'],
            'session_count' => (int) $r['session_count'],
            'avg_wpm' => (float) $r['avg_wpm'],
            'avg_accuracy' => (float) $r['avg_accuracy'],
        ];
    }, $stmt->fetchAll());

    json_response(['users' => $users]);
}

function handle_admin_user_create(PDO $pdo): void
{
    $admin = require_admin($pdo);
    $body = get_json_body();

    $name = trim((string) ($body['name'] ?? ''));
    $username = strtolower(trim((string) ($body['username'] ?? '')));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    $role = strtolower(trim((string) ($body['role'] ?? 'user')));
    $isActive = array_key_exists('is_active', $body) ? ((bool) $body['is_active'] ? 1 : 0) : 1;

    if ($name === '' || mb_strlen($name) > 120) {
        json_error('Nama lengkap wajib diisi (maksimal 120 karakter).', 422);
    }
    if ($username === '' || !preg_match('/^[a-z0-9._-]{3,40}$/', $username)) {
        json_error('Username harus 3-40 karakter (huruf kecil, angka, titik, underscore, atau tanda hubung).', 422);
    }
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Alamat email tidak valid.', 422);
    }
    if (strlen($password) < 6) {
        json_error('Password minimal 6 karakter.', 422);
    }
    if (!in_array($role, ['user', 'admin'], true)) {
        json_error('Role harus user atau admin.', 422);
    }

    $dup = $pdo->prepare('SELECT id, username, email FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1');
    $dup->execute([$username, $email]);
    $conflict = $dup->fetch();
    if ($conflict) {
        if (strtolower((string) $conflict['username']) === $username) {
            json_error("Username '{$username}' sudah digunakan.", 409);
        }
        json_error("Email '{$email}' sudah terdaftar.", 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare(
        'INSERT INTO users (name, username, email, password_hash, role, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$name, $username, $email, $hash, $role, $isActive, $admin['id']]);
    $id = (int) $pdo->lastInsertId();

    json_response([
        'message' => 'Pengguna baru berhasil didaftarkan oleh admin.',
        'user' => [
            'id' => $id,
            'name' => $name,
            'username' => $username,
            'email' => $email,
            'role' => $role,
            'is_active' => $isActive === 1,
            'session_count' => 0,
            'avg_wpm' => 0,
            'avg_accuracy' => 0,
        ],
    ], 201);
}

function handle_admin_user_update(PDO $pdo, int $id): void
{
    $admin = require_admin($pdo);
    $body = get_json_body();

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_error('Pengguna tidak ditemukan.', 404);
    }

    $name = array_key_exists('name', $body) ? trim((string) $body['name']) : (string) $existing['name'];
    $username = array_key_exists('username', $body) ? strtolower(trim((string) $body['username'])) : (string) $existing['username'];
    $email = array_key_exists('email', $body) ? strtolower(trim((string) $body['email'])) : (string) $existing['email'];
    $role = array_key_exists('role', $body) ? strtolower(trim((string) $body['role'])) : (string) $existing['role'];
    $isActive = array_key_exists('is_active', $body) ? ((bool) $body['is_active'] ? 1 : 0) : (int) $existing['is_active'];
    $newPassword = isset($body['password']) ? (string) $body['password'] : '';

    if ($id === $admin['id'] && ($isActive !== 1 || $role !== 'admin')) {
        json_error('Anda tidak dapat menonaktifkan atau menurunkan role akun admin Anda sendiri.', 400);
    }

    if ($name === '' || mb_strlen($name) > 120) {
        json_error('Nama lengkap tidak valid.', 422);
    }
    if ($username === '' || !preg_match('/^[a-z0-9._-]{3,40}$/', $username)) {
        json_error('Format username tidak valid.', 422);
    }
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Format email tidak valid.', 422);
    }
    if (!in_array($role, ['user', 'admin'], true)) {
        json_error('Role harus user atau admin.', 422);
    }
    if ($newPassword !== '' && strlen($newPassword) < 6) {
        json_error('Password baru minimal 6 karakter.', 422);
    }

    $dup = $pdo->prepare('SELECT id FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND id <> ? LIMIT 1');
    $dup->execute([$username, $email, $id]);
    if ($dup->fetch()) {
        json_error('Username atau email sudah digunakan pengguna lain.', 409);
    }

    if ($newPassword !== '') {
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $upd = $pdo->prepare(
            'UPDATE users
             SET name = ?, username = ?, email = ?, role = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $upd->execute([$name, $username, $email, $role, $isActive, $hash, $id]);
    } else {
        $upd = $pdo->prepare(
            'UPDATE users
             SET name = ?, username = ?, email = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $upd->execute([$name, $username, $email, $role, $isActive, $id]);
    }

    json_response([
        'message' => 'Data pengguna berhasil diperbarui.',
        'user' => [
            'id' => $id,
            'name' => $name,
            'username' => $username,
            'email' => $email,
            'role' => $role,
            'is_active' => $isActive === 1,
        ],
    ]);
}

function handle_admin_user_delete(PDO $pdo, int $id): void
{
    $admin = require_admin($pdo);

    if ($id === $admin['id']) {
        json_error('Anda tidak dapat menghapus akun admin yang sedang digunakan.', 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        json_error('Pengguna tidak ditemukan.', 404);
    }

    $del = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $del->execute([$id]);

    json_response(['message' => 'Pengguna berhasil dihapus.']);
}
