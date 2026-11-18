<?php
declare(strict_types=1);

// Router untuk PHP built-in development server:
// php -S 127.0.0.1:8000 -t api api/router.php
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Blokir akses langsung ke file sensitif saat dev
if (preg_match('#^/(config|lib|controllers|storage)/#', $uri) || str_contains($uri, '.env')) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

require __DIR__ . '/index.php';
