<?php
declare(strict_types=1);

require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/response.php';

function extract_bearer_token(): ?string
{
    $auth = get_header_value('Authorization');
    if ($auth !== null && preg_match('/^Bearer\s+(.+)$/i', $auth, $matches)) {
        return trim($matches[1]);
    }

    $fallback = get_header_value('X-Auth-Token');
    if ($fallback !== null && $fallback !== '') {
        return $fallback;
    }

    return null;
}

function require_auth(PDO $pdo): array
{
    $token = extract_bearer_token();
    if ($token === null) {
        json_error('Sesi login tidak ditemukan. Silakan masuk terlebih dahulu.', 401);
    }

    try {
        $payload = jwt_decode($token);
    } catch (Throwable $e) {
        json_error($e->getMessage(), 500);
    }

    if ($payload === null || empty($payload['sub'])) {
        json_error('Token autentikasi tidak valid atau telah kedaluwarsa.', 401);
    }

    $stmt = $pdo->prepare(
        'SELECT id, name, username, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([(int) $payload['sub']]);
    $user = $stmt->fetch();

    if (!$user) {
        json_error('Akun pengguna tidak ditemukan.', 401);
    }

    if ((int) $user['is_active'] !== 1) {
        json_error('Akun Anda sedang dinonaktifkan oleh admin.', 403);
    }

    $user['id'] = (int) $user['id'];
    $user['is_active'] = (bool) $user['is_active'];

    return $user;
}

function require_admin(PDO $pdo): array
{
    $user = require_auth($pdo);
    if (($user['role'] ?? '') !== 'admin') {
        json_error('Akses ditolak. Fitur ini hanya untuk admin.', 403);
    }
    return $user;
}
