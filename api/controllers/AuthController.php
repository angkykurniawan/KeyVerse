<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/jwt.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/gemini.php';

function handle_auth_login(PDO $pdo): void
{
    $body = get_json_body();
    $identifier = strtolower(trim((string) ($body['identifier'] ?? $body['username'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    if ($identifier === '' || $password === '') {
        json_error('Username/email dan password wajib diisi.', 422);
    }

    $stmt = $pdo->prepare(
        'SELECT id, name, username, email, password_hash, role, is_active, created_at
         FROM users
         WHERE LOWER(username) = ? OR LOWER(email) = ?
         LIMIT 1'
    );
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();

    $hash = $user ? (string) $user['password_hash'] : '';
    $passwordOk = $user && (
        password_verify($password, $hash)
        || (trim($password) !== $password && password_verify(trim($password), $hash))
    );

    if (!$passwordOk) {
        json_error('Username/email atau password salah.', 401);
    }

    if ((int) $user['is_active'] !== 1) {
        json_error('Akun Anda sedang dinonaktifkan. Hubungi admin untuk mengaktifkan kembali.', 403);
    }

    try {
        $token = jwt_encode([
            'sub' => (int) $user['id'],
            'role' => (string) $user['role'],
            'username' => (string) $user['username'],
        ]);
    } catch (Throwable $e) {
        json_error($e->getMessage(), 500);
    }

    json_response([
        'token' => $token,
        'user' => [
            'id' => (int) $user['id'],
            'name' => (string) $user['name'],
            'username' => (string) $user['username'],
            'email' => (string) $user['email'],
            'role' => (string) $user['role'],
            'is_active' => true,
            'created_at' => (string) $user['created_at'],
        ],
        'ai_ready' => is_ai_ready($pdo),
    ]);
}

function handle_auth_me(PDO $pdo): void
{
    $user = require_auth($pdo);
    json_response([
        'user' => $user,
        'ai_ready' => is_ai_ready($pdo),
    ]);
}

function handle_auth_change_password(PDO $pdo): void
{
    $user = require_auth($pdo);
    $body = get_json_body();

    $currentPassword = (string) ($body['current_password'] ?? '');
    $newPassword = (string) ($body['new_password'] ?? '');

    if ($currentPassword === '' || strlen($newPassword) < 6) {
        json_error('Password saat ini wajib diisi dan password baru minimal 6 karakter.', 422);
    }

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($currentPassword, (string) $row['password_hash'])) {
        json_error('Password saat ini tidak sesuai.', 400);
    }

    $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $upd = $pdo->prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $upd->execute([$newHash, $user['id']]);

    json_response(['message' => 'Password berhasil diperbarui.']);
}
