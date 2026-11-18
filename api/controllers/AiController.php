<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/gemini.php';

/**
 * Status ketersediaan AI bagi semua user terautentikasi (tanpa membocorkan key).
 */
function handle_ai_status(PDO $pdo): void
{
    require_auth($pdo);
    $cfg = resolve_active_gemini_config($pdo);
    json_response([
        'ai_ready' => $cfg['key'] !== '',
        'preferred_model' => $cfg['preferred_model'],
    ]);
}

/**
 * ADMIN ONLY: Mengambil konfigurasi Google AI Studio API Key & daftar model tersedia dari key aktif.
 */
function handle_admin_ai_config_get(PDO $pdo): void
{
    require_admin($pdo);
    $cfg = resolve_active_gemini_config($pdo);

    $models = [];
    $modelError = null;
    if ($cfg['key'] !== '') {
        try {
            $models = gemini_list_models($cfg['key']);
        } catch (Throwable $e) {
            $modelError = $e->getMessage();
        }
    }

    json_response([
        'config' => [
            'has_api_key' => $cfg['key'] !== '',
            'key_source' => $cfg['source'],
            'masked_key' => $cfg['masked_key'],
            'has_server_env_key' => $cfg['has_server_env_key'],
            'preferred_model' => $cfg['preferred_model'],
        ],
        'models' => $models,
        'model_error' => $modelError,
    ]);
}

/**
 * ADMIN ONLY: Menyimpan / mengganti API Key Google AI Studio dan model pilihan global untuk seluruh user.
 */
function handle_admin_ai_config_save(PDO $pdo): void
{
    $admin = require_admin($pdo);
    $body = get_json_body();

    $resetToEnv = !empty($body['reset_to_env']);
    $newApiKey = array_key_exists('api_key', $body) ? trim((string) $body['api_key']) : null;
    $preferredModel = array_key_exists('preferred_model', $body) ? trim((string) $body['preferred_model']) : null;

    if ($resetToEnv) {
        delete_app_setting($pdo, 'gemini_api_key');
        set_app_setting($pdo, 'gemini_preferred_model', 'auto', $admin['id']);

        $cfg = resolve_active_gemini_config($pdo);
        $models = [];
        $modelError = null;
        if ($cfg['key'] !== '') {
            try {
                $models = gemini_list_models($cfg['key']);
            } catch (Throwable $e) {
                $modelError = $e->getMessage();
            }
        }

        json_response([
            'message' => $cfg['key'] !== ''
                ? 'Berhasil kembali menggunakan GEMINI_API_KEY default dari file .env server.'
                : 'API key khusus telah dihapus. Catatan: GEMINI_API_KEY di .env server saat ini masih kosong.',
            'config' => [
                'has_api_key' => $cfg['key'] !== '',
                'key_source' => $cfg['source'],
                'masked_key' => $cfg['masked_key'],
                'has_server_env_key' => $cfg['has_server_env_key'],
                'preferred_model' => $cfg['preferred_model'],
            ],
            'models' => $models,
            'model_error' => $modelError,
        ]);
    }

    // Jika admin mengirim API key baru, verifikasi langsung ke Google AI Studio sebelum menyimpan
    $validatedModels = null;
    if ($newApiKey !== null && $newApiKey !== '') {
        try {
            $validatedModels = gemini_list_models($newApiKey);
            if (count($validatedModels) === 0) {
                json_error('API key valid tetapi tidak memiliki model teks Gemini yang aktif.', 400);
            }
        } catch (Throwable $e) {
            $status = ($e->getCode() >= 400 && $e->getCode() < 500) ? (int) $e->getCode() : 502;
            json_error('API key gagal diverifikasi ke Google AI Studio: ' . $e->getMessage(), $status);
        }

        set_app_setting($pdo, 'gemini_api_key', encrypt_setting_value($newApiKey), $admin['id']);
        // Reset model ke auto jika admin baru saja mengganti API key tanpa memilih model spesifik
        if ($preferredModel === null || $preferredModel === '') {
            set_app_setting($pdo, 'gemini_preferred_model', 'auto', $admin['id']);
        }
    }

    if ($preferredModel !== null && $preferredModel !== '') {
        $cleanModel = $preferredModel === 'auto'
            ? 'auto'
            : (preg_replace('/^models\//', '', $preferredModel) ?? 'auto');
        if ($cleanModel !== 'auto' && !preg_match('/^[a-zA-Z0-9._-]+$/', $cleanModel)) {
            json_error('Format nama model AI tidak valid.', 422);
        }
        set_app_setting($pdo, 'gemini_preferred_model', $cleanModel, $admin['id']);
    }

    $cfg = resolve_active_gemini_config($pdo);
    $models = $validatedModels ?? [];
    $modelError = null;
    if ($validatedModels === null && $cfg['key'] !== '') {
        try {
            $models = gemini_list_models($cfg['key']);
        } catch (Throwable $e) {
            $modelError = $e->getMessage();
        }
    }

    json_response([
        'message' => 'Konfigurasi Google AI Studio berhasil disimpan dan berlaku untuk seluruh pengguna.',
        'config' => [
            'has_api_key' => $cfg['key'] !== '',
            'key_source' => $cfg['source'],
            'masked_key' => $cfg['masked_key'],
            'has_server_env_key' => $cfg['has_server_env_key'],
            'preferred_model' => $cfg['preferred_model'],
        ],
        'models' => $models,
        'model_error' => $modelError,
    ]);
}

/**
 * ADMIN ONLY: Menguji daftar model dari API key aktif atau key uji coba.
 */
function handle_ai_models(PDO $pdo): void
{
    require_admin($pdo);
    $body = get_json_body();
    $testKey = isset($body['api_key']) ? trim((string) $body['api_key']) : '';

    if ($testKey !== '') {
        $activeKey = $testKey;
        $source = 'test_input';
    } else {
        $cfg = resolve_active_gemini_config($pdo);
        $activeKey = $cfg['key'];
        $source = $cfg['source'];
    }

    if ($activeKey === '') {
        json_error('API key Google AI Studio belum diatur di Admin HQ maupun file .env.', 400);
    }

    try {
        $models = gemini_list_models($activeKey);
    } catch (Throwable $e) {
        $status = ($e->getCode() >= 400 && $e->getCode() < 500) ? (int) $e->getCode() : 502;
        json_error('Gagal memuat daftar model dari Google AI Studio: ' . $e->getMessage(), $status);
    }

    json_response([
        'models' => $models,
        'key_source' => $source,
    ]);
}

/**
 * Generate teks latihan mengetik 1 menit (panjang kata otomatis ~155 kata)
 * Menggunakan API key & konfigurasi model yang diatur oleh Admin.
 */
function handle_ai_generate(PDO $pdo): void
{
    require_auth($pdo);
    $body = get_json_body();

    $languageId = (int) ($body['language_id'] ?? 0);
    $rawKeywords = $body['keywords'] ?? [];
    // ~110 kata (cepat di-generate AI dalam 1-2 detik; arena otomatis menyambung jika >110 WPM)
    $wordCount = 110;

    if ($languageId <= 0) {
        json_error('Silakan pilih bahasa terlebih dahulu.', 422);
    }

    if (!is_array($rawKeywords) || count($rawKeywords) !== 5) {
        json_error('Anda wajib memasukkan tepat 5 kata utama dari bidang yang diminati.', 422);
    }

    $keywords = [];
    foreach ($rawKeywords as $idx => $kw) {
        $clean = trim(preg_replace('/\s+/u', ' ', (string) $kw) ?? '');
        if ($clean === '') {
            json_error('Kata utama #' . ($idx + 1) . ' tidak boleh kosong. Lengkapi kelima kata utama.', 422);
        }
        if (mb_strlen($clean) > 40) {
            json_error('Setiap kata utama maksimal 40 karakter.', 422);
        }
        $keywords[] = $clean;
    }

    $langStmt = $pdo->prepare('SELECT id, code, name, native_name, prompt_hint, is_active FROM languages WHERE id = ? LIMIT 1');
    $langStmt->execute([$languageId]);
    $language = $langStmt->fetch();

    if (!$language || (int) $language['is_active'] !== 1) {
        json_error('Bahasa yang dipilih tidak ditemukan atau sedang nonaktif.', 404);
    }

    $cfg = resolve_active_gemini_config($pdo);
    if ($cfg['key'] === '') {
        json_error(
            'Layanan AI belum dikonfigurasi oleh Administrator. Silakan hubungi Admin untuk mengatur API key Google AI Studio.',
            503,
            ['code' => 'MISSING_API_KEY']
        );
    }

    try {
        $gen = gemini_generate_typing_text_auto($cfg['key'], $cfg['preferred_model'], $language, $keywords, $wordCount);
        $text = $gen['text'];
        $modelUsed = $gen['model_used'];
    } catch (InvalidArgumentException $e) {
        json_error($e->getMessage(), 422);
    } catch (Throwable $e) {
        $status = ($e->getCode() >= 400 && $e->getCode() < 500) ? (int) $e->getCode() : 502;
        json_error('Gagal menghasilkan teks latihan dari Gemini AI: ' . $e->getMessage(), $status);
    }

    $words = preg_split('/\s+/u', trim($text)) ?: [];
    $actualWordCount = count(array_filter($words, static fn(string $w): bool => $w !== ''));

    json_response([
        'text' => $text,
        'word_count' => $actualWordCount,
        'char_count' => mb_strlen($text),
        'model_used' => $modelUsed,
        'key_source' => $cfg['source'],
        'keywords' => $keywords,
        'language' => [
            'id' => (int) $language['id'],
            'code' => (string) $language['code'],
            'name' => (string) $language['name'],
            'native_name' => (string) $language['native_name'],
        ],
    ]);
}
