<?php
declare(strict_types=1);

// Pastikan fatal error pun mengembalikan JSON terstruktur (bukan HTTP 500 kosong)
register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err !== null && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'error' => 'Kesalahan fatal PHP pada server: ' . $err['message'],
        ], JSON_UNESCAPED_UNICODE);
    }
});

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/response.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/LanguageController.php';
require_once __DIR__ . '/controllers/AdminUserController.php';
require_once __DIR__ . '/controllers/AiController.php';
require_once __DIR__ . '/controllers/SessionController.php';
require_once __DIR__ . '/controllers/RoomController.php';

load_env();
apply_cors();

// Normalisasi HTTP method (mendukung X-HTTP-Method-Override untuk kompatibilitas shared hosting)
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'POST') {
    $override = get_header_value('X-HTTP-Method-Override');
    if ($override !== null) {
        $upperOverride = strtoupper($override);
        if (in_array($upperOverride, ['PUT', 'PATCH', 'DELETE'], true)) {
            $method = $upperOverride;
        }
    }
}

// Normalisasi path: hilangkan prefix /api jika ada
$rawPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^/api(?=/|$)#', '', $rawPath) ?: '/';
$path = '/' . trim($path, '/');

try {
    $pdo = get_db();

    // Health check
    if ($method === 'GET' && ($path === '/' || $path === '/health')) {
        json_response([
            'status' => 'ok',
            'app' => 'KeyVerse API',
            'php_version' => PHP_VERSION,
            'db_driver' => strtolower((string) env('DB_DRIVER', 'mysql')),
            'ai_ready' => is_ai_ready($pdo),
        ]);
    }

    // Auth routes (TIDAK ADA self-registration; pendaftaran user hanya oleh admin)
    if ($method === 'POST' && $path === '/auth/login') {
        handle_auth_login($pdo);
    }
    if ($method === 'GET' && $path === '/auth/me') {
        handle_auth_me($pdo);
    }
    if ($method === 'POST' && $path === '/auth/change-password') {
        handle_auth_change_password($pdo);
    }

    // Languages (User melihat bahasa aktif; Admin dapat menambah/edit/hapus)
    if ($method === 'GET' && $path === '/languages') {
        handle_languages_list($pdo);
    }
    if ($method === 'POST' && $path === '/admin/languages') {
        handle_admin_language_create($pdo);
    }
    if (($method === 'PUT' || $method === 'PATCH') && preg_match('#^/admin/languages/(\d+)$#', $path, $m)) {
        handle_admin_language_update($pdo, (int) $m[1]);
    }
    if ($method === 'DELETE' && preg_match('#^/admin/languages/(\d+)$#', $path, $m)) {
        handle_admin_language_delete($pdo, (int) $m[1]);
    }

    // Admin Users & Overview
    if ($method === 'GET' && $path === '/admin/overview') {
        handle_admin_overview($pdo);
    }
    if ($method === 'GET' && $path === '/admin/users') {
        handle_admin_users_list($pdo);
    }
    if ($method === 'POST' && $path === '/admin/users') {
        handle_admin_user_create($pdo);
    }
    if (($method === 'PUT' || $method === 'PATCH') && preg_match('#^/admin/users/(\d+)$#', $path, $m)) {
        handle_admin_user_update($pdo, (int) $m[1]);
    }
    if ($method === 'DELETE' && preg_match('#^/admin/users/(\d+)$#', $path, $m)) {
        handle_admin_user_delete($pdo, (int) $m[1]);
    }

    // Google AI Studio (Konfigurasi API Key & Model HANYA di Admin)
    if ($method === 'GET' && $path === '/admin/ai-config') {
        handle_admin_ai_config_get($pdo);
    }
    if ($method === 'POST' && $path === '/admin/ai-config') {
        handle_admin_ai_config_save($pdo);
    }
    if ($method === 'GET' && $path === '/ai/status') {
        handle_ai_status($pdo);
    }
    if ($method === 'POST' && $path === '/ai/models') {
        handle_ai_models($pdo);
    }
    if ($method === 'POST' && $path === '/ai/generate') {
        handle_ai_generate($pdo);
    }

    // Typing sessions, progress history & competition leaderboard
    if ($method === 'POST' && $path === '/sessions') {
        handle_session_create($pdo);
    }
    if ($method === 'GET' && $path === '/sessions') {
        handle_sessions_list($pdo);
    }
    if ($method === 'DELETE' && preg_match('#^/sessions/(\d+)$#', $path, $m)) {
        handle_session_delete($pdo, (int) $m[1]);
    }
    if ($method === 'GET' && $path === '/leaderboard') {
        handle_leaderboard($pdo);
    }

    // Multiplayer Versus Rooms ("Adu Ketik Dengan Kawan")
    if ($method === 'GET' && $path === '/rooms/open') {
        handle_rooms_open($pdo);
    }
    if ($method === 'POST' && $path === '/rooms') {
        handle_room_create($pdo);
    }
    if ($method === 'POST' && $path === '/rooms/join') {
        handle_room_join($pdo);
    }
    if ($method === 'GET' && preg_match('#^/rooms/([A-Za-z0-9]+)$#', $path, $m)) {
        handle_room_get($pdo, $m[1]);
    }
    if ($method === 'POST' && preg_match('#^/rooms/([A-Za-z0-9]+)/ready$#', $path, $m)) {
        handle_room_ready($pdo, $m[1]);
    }
    if ($method === 'POST' && preg_match('#^/rooms/([A-Za-z0-9]+)/start$#', $path, $m)) {
        handle_room_start($pdo, $m[1]);
    }
    if ($method === 'POST' && preg_match('#^/rooms/([A-Za-z0-9]+)/progress$#', $path, $m)) {
        handle_room_progress($pdo, $m[1]);
    }
    if ($method === 'POST' && preg_match('#^/rooms/([A-Za-z0-9]+)/rematch$#', $path, $m)) {
        handle_room_rematch($pdo, $m[1]);
    }
    if ($method === 'POST' && preg_match('#^/rooms/([A-Za-z0-9]+)/leave$#', $path, $m)) {
        handle_room_leave($pdo, $m[1]);
    }

    json_error("Endpoint tidak ditemukan: {$method} {$path}", 404);
} catch (PDOException $e) {
    $debug = env_bool('APP_DEBUG', false);
    json_error(
        $debug ? 'Database error: ' . $e->getMessage() : 'Terjadi kesalahan koneksi database. Periksa konfigurasi .env dan pastikan SQL sudah di-import.',
        500
    );
} catch (Throwable $e) {
    $debug = env_bool('APP_DEBUG', false);
    json_error(
        $debug ? 'Server error: ' . $e->getMessage() : 'Terjadi kesalahan internal pada server.',
        500
    );
}
