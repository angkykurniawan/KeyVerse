<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/env.php';

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder > 0) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    $decoded = base64_decode(strtr($data, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

function jwt_secret(): string
{
    $secret = (string) env('JWT_SECRET', '');
    if (strlen($secret) < 16) {
        throw new RuntimeException('JWT_SECRET pada file .env belum diatur atau terlalu pendek (minimal 16 karakter).');
    }
    return $secret;
}

function jwt_encode(array $payload, ?int $ttlSeconds = null): string
{
    $ttl = $ttlSeconds ?? (int) env('JWT_TTL_SECONDS', '86400');
    if ($ttl < 300) {
        $ttl = 86400;
    }

    $now = time();
    $payload['iat'] = $now;
    $payload['exp'] = $now + $ttl;

    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $segments = [
        base64url_encode((string) json_encode($header)),
        base64url_encode((string) json_encode($payload)),
    ];

    $signingInput = implode('.', $segments);
    $signature = hash_hmac('sha256', $signingInput, jwt_secret(), true);
    $segments[] = base64url_encode($signature);

    return implode('.', $segments);
}

function jwt_decode(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$headerB64, $payloadB64, $sigB64] = $parts;
    $header = json_decode(base64url_decode($headerB64), true);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
        return null;
    }

    $expectedSig = base64url_encode(
        hash_hmac('sha256', "{$headerB64}.{$payloadB64}", jwt_secret(), true)
    );
    if (!hash_equals($expectedSig, $sigB64)) {
        return null;
    }

    $payload = json_decode(base64url_decode($payloadB64), true);
    if (!is_array($payload)) {
        return null;
    }

    if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
        return null;
    }

    return $payload;
}
