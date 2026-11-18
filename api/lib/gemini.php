<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/env.php';

function settings_crypto_key(): string
{
    $secret = (string) env('JWT_SECRET', 'keyverse_fallback_crypto_secret_32');
    return hash('sha256', $secret . '|keyverse_settings_v1', true);
}

function encrypt_setting_value(string $plain): string
{
    if ($plain === '') {
        return '';
    }
    if (function_exists('openssl_encrypt')) {
        $iv = random_bytes(16);
        $cipher = openssl_encrypt($plain, 'AES-256-CBC', settings_crypto_key(), OPENSSL_RAW_DATA, $iv);
        if ($cipher !== false) {
            return 'enc:' . base64_encode($iv . $cipher);
        }
    }
    return 'b64:' . base64_encode($plain);
}

function decrypt_setting_value(string $stored): string
{
    if ($stored === '') {
        return '';
    }
    if (str_starts_with($stored, 'enc:') && function_exists('openssl_decrypt')) {
        $raw = base64_decode(substr($stored, 4), true);
        if ($raw !== false && strlen($raw) > 16) {
            $iv = substr($raw, 0, 16);
            $cipher = substr($raw, 16);
            $plain = openssl_decrypt($cipher, 'AES-256-CBC', settings_crypto_key(), OPENSSL_RAW_DATA, $iv);
            if ($plain !== false) {
                return $plain;
            }
        }
        return '';
    }
    if (str_starts_with($stored, 'b64:')) {
        $decoded = base64_decode(substr($stored, 4), true);
        return $decoded !== false ? $decoded : '';
    }
    return $stored;
}

function mask_api_key(string $key): string
{
    $len = strlen($key);
    if ($len === 0) {
        return '';
    }
    if ($len <= 10) {
        return str_repeat('•', $len);
    }
    return substr($key, 0, 6) . '••••••••' . substr($key, -4);
}

function get_app_setting(PDO $pdo, string $key): ?string
{
    try {
        $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? (string) $val : null;
    } catch (Throwable $e) {
        return null;
    }
}

function set_app_setting(PDO $pdo, string $key, string $value, int $adminUserId): void
{
    $driver = strtolower((string) env('DB_DRIVER', 'mysql'));
    if ($driver === 'sqlite') {
        $stmt = $pdo->prepare(
            'INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_by = excluded.updated_by,
                updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$key, $value, $adminUserId]);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO app_settings (setting_key, setting_value, updated_by)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                setting_value = VALUES(setting_value),
                updated_by = VALUES(updated_by),
                updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$key, $value, $adminUserId]);
    }
}

function delete_app_setting(PDO $pdo, string $key): void
{
    $stmt = $pdo->prepare('DELETE FROM app_settings WHERE setting_key = ?');
    $stmt->execute([$key]);
}

/**
 * Mengambil konfigurasi Gemini aktif yang hanya diatur oleh Admin:
 * 1) Key dari tabel app_settings (diatur via Admin HQ)
 * 2) Fallback ke GEMINI_API_KEY di file .env
 */
function resolve_active_gemini_config(PDO $pdo): array
{
    $preferredModel = trim((string) (get_app_setting($pdo, 'gemini_preferred_model') ?? 'auto'));
    if ($preferredModel === '') {
        $preferredModel = 'auto';
    }

    $storedEncrypted = get_app_setting($pdo, 'gemini_api_key');
    if ($storedEncrypted !== null && $storedEncrypted !== '') {
        $dbKey = trim(decrypt_setting_value($storedEncrypted));
        if ($dbKey !== '') {
            return [
                'key' => $dbKey,
                'source' => 'admin_db',
                'preferred_model' => $preferredModel,
                'masked_key' => mask_api_key($dbKey),
                'has_server_env_key' => has_server_gemini_key(),
            ];
        }
    }

    $envKey = trim((string) env('GEMINI_API_KEY', ''));
    if ($envKey !== '' && $envKey !== 'your_google_ai_studio_api_key_here') {
        return [
            'key' => $envKey,
            'source' => 'server_env',
            'preferred_model' => $preferredModel,
            'masked_key' => mask_api_key($envKey),
            'has_server_env_key' => true,
        ];
    }

    return [
        'key' => '',
        'source' => 'none',
        'preferred_model' => $preferredModel,
        'masked_key' => '',
        'has_server_env_key' => false,
    ];
}

function has_server_gemini_key(): bool
{
    $envKey = trim((string) env('GEMINI_API_KEY', ''));
    return $envKey !== '' && $envKey !== 'your_google_ai_studio_api_key_here';
}

function is_ai_ready(PDO $pdo): bool
{
    $cfg = resolve_active_gemini_config($pdo);
    return $cfg['key'] !== '';
}

function gemini_http_request(string $method, string $url, ?array $body = null, int $timeout = 30): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('Ekstensi PHP cURL tidak aktif di server.');
    }

    $ch = curl_init($url);
    $headers = ['Accept: application/json'];

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_SSL_VERIFYPEER => true,
    ];

    if ($body !== null) {
        $json = json_encode($body, JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json';
        $options[CURLOPT_POSTFIELDS] = $json;
    }

    $options[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $options);

    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || $raw === false) {
        throw new RuntimeException('Gagal terhubung ke Google AI Studio: ' . $error);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException("Respon tidak valid dari Google AI Studio (HTTP {$httpCode}).");
    }

    if ($httpCode >= 400) {
        $apiMsg = $decoded['error']['message'] ?? "HTTP {$httpCode} dari Google AI Studio.";
        throw new RuntimeException($apiMsg, $httpCode);
    }

    return $decoded;
}

/**
 * Mengambil daftar model Gemini yang tersedia secara dinamis berdasarkan API key yang dikirim.
 * Mengurutkan model versi terbaru (Gemini 3.x / Flash-Latest / 2.5 Flash) di posisi teratas.
 */
function gemini_list_models(string $apiKey): array
{
    $url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=' . urlencode($apiKey);
    $data = gemini_http_request('GET', $url, null, 20);

    $rawModels = $data['models'] ?? [];
    if (!is_array($rawModels)) {
        return [];
    }

    $excludedKeywords = [
        'embedding',
        'aqa',
        'imagen',
        'veo',
        'tts',
        'robotics',
        'computer-use',
        'deep-research',
        'native-audio',
        'image-generation',
        '-image',
        'lyria',
        'nano-banana',
        'customtools',
    ];

    $models = [];
    foreach ($rawModels as $item) {
        if (!is_array($item)) {
            continue;
        }
        $fullName = (string) ($item['name'] ?? '');
        $methods = $item['supportedGenerationMethods'] ?? [];
        if (!is_array($methods) || !in_array('generateContent', $methods, true)) {
            continue;
        }

        $id = preg_replace('/^models\//', '', $fullName) ?? $fullName;
        $lowerId = strtolower($id);

        if (!str_contains($lowerId, 'gemini') && !str_contains($lowerId, 'gemma')) {
            continue;
        }

        $skip = false;
        foreach ($excludedKeywords as $kw) {
            if (str_contains($lowerId, $kw)) {
                $skip = true;
                break;
            }
        }
        if ($skip) {
            continue;
        }

        $models[] = [
            'id' => $id,
            'display_name' => (string) ($item['displayName'] ?? $id),
            'description' => (string) ($item['description'] ?? ''),
            'input_token_limit' => (int) ($item['inputTokenLimit'] ?? 0),
            'output_token_limit' => (int) ($item['outputTokenLimit'] ?? 0),
            'score' => model_sort_score($lowerId),
        ];
    }

    // Skor lebih tinggi = lebih diprioritaskan (versi terbaru + Flash lebih cepat untuk tes mengetik)
    usort($models, static function (array $a, array $b): int {
        if ($a['score'] !== $b['score']) {
            return $b['score'] <=> $a['score'];
        }
        return strcmp($a['id'], $b['id']);
    });

    return array_values(array_map(static function (array $m, int $idx): array {
        unset($m['score']);
        $m['recommended'] = ($idx === 0);
        return $m;
    }, $models, array_keys($models)));
}

/**
 * Menghitung skor prioritas dinamis (memprioritaskan model tercepat & terbaru untuk tes ketik):
 * - Flash-Lite & Flash versi terbaru (3.1 / 3.0 / 2.5 / flash-latest) paling cepat (1-2 detik!)
 * - Model Pro lebih lambat (thinking berat), jadi ditaruh di bawah Flash
 * - Model lama (2.0 / 1.5 / 2.5-pro deprecated) diturunkan
 */
function model_sort_score(string $lowerId): int
{
    // Model Flash-Lite / Flash terbaru selalu paling cepat & paling stabil
    if ($lowerId === 'gemini-2.5-flash-lite') return 980;
    if ($lowerId === 'gemini-3.1-flash-lite-preview') return 970;
    if ($lowerId === 'gemini-flash-lite-latest') return 965;
    if ($lowerId === 'gemini-flash-latest') return 960;
    if ($lowerId === 'gemini-2.5-flash') return 950;
    if ($lowerId === 'gemini-3-flash-preview') return 940;
    if ($lowerId === 'gemini-pro-latest') return 720;

    $score = 0;

    if (str_starts_with($lowerId, 'gemini-')) {
        if (preg_match('/^gemini-(\d+)(?:\.(\d+))?/', $lowerId, $m)) {
            $major = (int) $m[1];
            $minor = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : 0;
            $score += ($major * 200) + ($minor * 25);
        } else {
            $score += 300;
        }

        // Flash-Lite & Flash jauh lebih cepat dibanding Pro untuk generate soal ketik
        if (str_contains($lowerId, 'flash-lite')) {
            $score += 180;
        } elseif (str_contains($lowerId, 'flash')) {
            $score += 140;
        } elseif (str_contains($lowerId, 'pro')) {
            $score += 10;
        }

        // Penalti model lama / deprecated
        if (preg_match('/^gemini-(1\.|2\.0)/', $lowerId)) {
            $score -= 400;
        }
        if (str_contains($lowerId, '-exp') || str_contains($lowerId, '-001') || str_contains($lowerId, '-002')) {
            $score -= 150;
        }
        if (str_contains($lowerId, '2.5-pro')) {
            $score -= 260;
        }
    } elseif (str_starts_with($lowerId, 'gemma-')) {
        $score = 250;
        if (preg_match('/gemma-(\d+)/', $lowerId, $m)) {
            $score += ((int) $m[1]) * 20;
        }
    }

    return $score;
}

/**
 * Mengembalikan opsi thinkingConfig minimal agar model Flash 2.5 / 3.x merespon dalam 1-2 detik
 * (tidak menghabiskan 10 detik untuk chain-of-thought internal).
 */
function build_fast_thinking_config(string $modelId): ?array
{
    $lower = strtolower($modelId);
    if (str_contains($lower, '2.5-flash') || $lower === 'gemini-flash-latest' || $lower === 'gemini-flash-lite-latest') {
        return ['thinkingBudget' => 0];
    }
    if (preg_match('/gemini-3(\.\d+)?-flash/', $lower)) {
        return ['thinkingLevel' => 'minimal'];
    }
    return null;
}

/**
 * Generate paragraf/kata latihan mengetik 1 menit menggunakan Google AI Studio (Gemini).
 */
function gemini_generate_typing_text(
    string $apiKey,
    string $modelId,
    array $language,
    array $keywords,
    int $wordCount = 110
): string {
    $cleanModel = preg_replace('/^models\//', '', trim($modelId)) ?? '';
    if ($cleanModel === '' || !preg_match('/^[a-zA-Z0-9._-]+$/', $cleanModel)) {
        throw new InvalidArgumentException('Nama model AI tidak valid.');
    }

    $langName = (string) ($language['name'] ?? 'Indonesian');
    $langNative = (string) ($language['native_name'] ?? $langName);
    $langHint = trim((string) ($language['prompt_hint'] ?? ''));
    $kwList = implode(', ', $keywords);

    $prompt = "Generate a smooth plain-text typing test passage in {$langName} ({$langNative}) of around {$wordCount} words.\n"
        . ($langHint !== '' ? "Style: {$langHint}\n" : '')
        . "Naturally include these 5 topic keywords and related everyday vocabulary from the same field: {$kwList}.\n"
        . "Rules: Plain text only, single paragraph, no markdown, no bullets, no quotes, no emojis, simple standard words and light punctuation. Output ONLY the passage text.";

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$cleanModel}:generateContent?key=" . urlencode($apiKey);

    $fastThinking = build_fast_thinking_config($cleanModel);
    $genConfig = [
        'temperature' => 0.8,
        'maxOutputTokens' => $fastThinking !== null ? 700 : 1800,
    ];
    if ($fastThinking !== null) {
        $genConfig['thinkingConfig'] = $fastThinking;
    }

    $payload = [
        'contents' => [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt],
                ],
            ],
        ],
        'generationConfig' => $genConfig,
    ];

    try {
        $response = gemini_http_request('POST', $url, $payload, 25);
    } catch (Throwable $e) {
        // Jika model menolak thinkingConfig (HTTP 400), langsung coba ulang tanpa thinkingConfig
        if ($fastThinking !== null && (int) $e->getCode() === 400 && str_contains(strtolower($e->getMessage()), 'thinking')) {
            unset($payload['generationConfig']['thinkingConfig']);
            $payload['generationConfig']['maxOutputTokens'] = 1800;
            $response = gemini_http_request('POST', $url, $payload, 25);
        } else {
            throw $e;
        }
    }

    $parts = $response['candidates'][0]['content']['parts'] ?? [];
    $textParts = [];
    if (is_array($parts)) {
        foreach ($parts as $p) {
            if (!is_array($p)) {
                continue;
            }
            // Lewati bagian internal thought dari model Gemini 2.5 / 3.x
            if (!empty($p['thought'])) {
                continue;
            }
            if (isset($p['text']) && is_string($p['text'])) {
                $textParts[] = $p['text'];
            }
        }
    }

    $rawText = trim(implode(' ', $textParts));
    if ($rawText === '') {
        $reason = $response['candidates'][0]['finishReason'] ?? 'UNKNOWN';
        throw new RuntimeException("Model AI {$cleanModel} tidak mengembalikan teks latihan (alasan: {$reason}).");
    }

    return sanitize_typing_text($rawText);
}

function sanitize_typing_text(string $text): string
{
    // Hilangkan simbol markdown umum
    $text = str_replace(['**', '__', '`', '*', '#', '>', '•'], '', $text);

    // Normalisasi tanda kutip & tanda hubung tipografis ke karakter keyboard standar
    $replacements = [
        "\u{2018}" => "'",
        "\u{2019}" => "'",
        "\u{201C}" => '"',
        "\u{201D}" => '"',
        "\u{2013}" => '-',
        "\u{2014}" => '-',
        "\u{2026}" => '...',
        "\u{00A0}" => ' ',
    ];
    $text = strtr($text, $replacements);

    // Gabungkan semua newline dan spasi berlebih menjadi satu spasi
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    $text = trim($text, " \t\n\r\0\x0B\"'");

    return $text;
}

function is_gemini_auth_error(Throwable $e): bool
{
    $code = (int) $e->getCode();
    $msg = strtolower($e->getMessage());

    if ($code === 401) {
        return true;
    }
    if (
        str_contains($msg, 'api key not valid')
        || str_contains($msg, 'api_key_invalid')
        || str_contains($msg, 'invalid api key')
        || str_contains($msg, 'api key expired')
    ) {
        return true;
    }

    return false;
}

/**
 * Cache daftar model & model tercepat yang berhasil per hash API key (berlaku 15 menit)
 * agar tidak perlu memanggil GET /v1beta/models berulang kali setiap klik "Mulai".
 */
function gemini_cache_path(string $apiKey): string
{
    $hash = substr(hash('sha256', $apiKey), 0, 16);
    return rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . "keyverse_gemini_{$hash}.json";
}

function gemini_read_cache(string $apiKey): ?array
{
    $file = gemini_cache_path($apiKey);
    if (!is_file($file) || !is_readable($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['expires_at']) || time() > (int) $data['expires_at']) {
        return null;
    }
    return $data;
}

function gemini_write_cache(string $apiKey, array $candidateIds, ?string $workingModel = null): void
{
    $file = gemini_cache_path($apiKey);
    $payload = [
        'expires_at' => time() + 900, // 15 menit
        'candidates' => array_values($candidateIds),
        'working_model' => $workingModel,
    ];
    @file_put_contents($file, json_encode($payload));
}

/**
 * Memilih model tercepat secara otomatis dari daftar model yang tersedia pada API key,
 * dengan cache 15 menit + fallback cerdas jika model deprecated / limit.
 */
function gemini_generate_typing_text_auto(
    string $apiKey,
    ?string $preferredModel,
    array $language,
    array $keywords,
    int $wordCount = 110
): array {
    $cleanPreferred = preg_replace('/^models\//', '', trim((string) ($preferredModel ?? ''))) ?? '';
    $cache = gemini_read_cache($apiKey);
    $candidateIds = [];
    $cachedWorking = null;

    if ($cache !== null && !empty($cache['candidates']) && is_array($cache['candidates'])) {
        $candidateIds = $cache['candidates'];
        $cachedWorking = isset($cache['working_model']) && is_string($cache['working_model'])
            ? $cache['working_model']
            : null;
    } else {
        $availableModels = gemini_list_models($apiKey);
        if (count($availableModels) === 0) {
            throw new RuntimeException('Tidak ada model teks Gemini yang tersedia untuk API key ini.');
        }
        $candidateIds = array_map(static fn(array $m): string => (string) $m['id'], $availableModels);
        gemini_write_cache($apiKey, $candidateIds, null);
    }

    $priorityFirst = [];
    if ($cleanPreferred !== '' && $cleanPreferred !== 'auto' && in_array($cleanPreferred, $candidateIds, true)) {
        $priorityFirst[] = $cleanPreferred;
    }
    if ($cachedWorking !== null && in_array($cachedWorking, $candidateIds, true)) {
        $priorityFirst[] = $cachedWorking;
    }
    $queue = array_values(array_unique(array_merge($priorityFirst, $candidateIds)));

    $tried = [];
    $maxAttempts = min(6, count($queue));
    $attempts = 0;
    $lastError = null;

    while ($attempts < $maxAttempts && count($queue) > 0) {
        $modelId = array_shift($queue);
        if ($modelId === null || isset($tried[$modelId])) {
            continue;
        }
        $tried[$modelId] = true;
        $attempts++;

        try {
            $text = gemini_generate_typing_text($apiKey, $modelId, $language, $keywords, $wordCount);
            // Simpan model yang berhasil ke cache agar permintaan berikutnya langsung 1 request (<2 detik)!
            gemini_write_cache($apiKey, $candidateIds, $modelId);
            return [
                'text' => $text,
                'model_used' => $modelId,
            ];
        } catch (Throwable $e) {
            $lastError = $e;

            if (is_gemini_auth_error($e)) {
                throw $e;
            }

            if (preg_match('/models\/([a-zA-Z0-9._-]+)/', $e->getMessage(), $suggested)) {
                $replacement = $suggested[1];
                if ($replacement !== $modelId && !isset($tried[$replacement])) {
                    array_unshift($queue, $replacement);
                }
            }
        }
    }

    throw $lastError ?? new RuntimeException('Gagal menghasilkan teks dari model yang tersedia pada API key.');
}
