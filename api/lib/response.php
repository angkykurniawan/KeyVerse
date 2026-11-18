<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/env.php';

function apply_cors(): void
{
    $allowedOrigin = trim((string) env('CORS_ORIGIN', ''));
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($allowedOrigin === '*') {
        header('Access-Control-Allow-Origin: *');
    } elseif ($allowedOrigin !== '' && $requestOrigin !== '') {
        $origins = array_map('trim', explode(',', $allowedOrigin));
        if (in_array($requestOrigin, $origins, true)) {
            header("Access-Control-Allow-Origin: {$requestOrigin}");
            header('Vary: Origin');
        }
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Gemini-Api-Key, X-HTTP-Method-Override');
    header('Access-Control-Max-Age: 86400');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400, ?array $details = null): void
{
    $payload = ['error' => $message];
    if ($details !== null) {
        $payload['details'] = $details;
    }
    json_response($payload, $status);
}

function get_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_error('Body request harus berupa JSON yang valid.', 400);
    }
    return $decoded;
}

function get_header_value(string $name): ?string
{
    $upper = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (!empty($_SERVER[$upper])) {
        return trim((string) $_SERVER[$upper]);
    }

    $redirectKey = 'REDIRECT_' . $upper;
    if (!empty($_SERVER[$redirectKey])) {
        return trim((string) $_SERVER[$redirectKey]);
    }

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $k => $v) {
                if (strcasecmp((string) $k, $name) === 0 && trim((string) $v) !== '') {
                    return trim((string) $v);
                }
            }
        }
    }

    return null;
}
