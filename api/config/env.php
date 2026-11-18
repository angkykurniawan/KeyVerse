<?php
declare(strict_types=1);

/**
 * Memuat variabel konfigurasi confidential dari file .env
 * Mencari di api/.env terlebih dahulu, lalu root project / htdocs/.env
 */
function load_env(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $candidates = [
        dirname(__DIR__) . '/.env',
        dirname(__DIR__, 2) . '/.env',
    ];

    foreach ($candidates as $path) {
        if (!is_file($path) || !is_readable($path)) {
            continue;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            continue;
        }

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            $pos = strpos($trimmed, '=');
            if ($pos === false) {
                continue;
            }

            $key = trim(substr($trimmed, 0, $pos));
            $value = trim(substr($trimmed, $pos + 1));

            if ($key === '') {
                continue;
            }

            // Hapus tanda kutip pembungkus jika ada
            $len = strlen($value);
            if ($len >= 2) {
                $first = $value[0];
                $last = $value[$len - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                }
            }

            // Jangan timpa env yang sudah diset oleh server/OS
            if (getenv($key) === false && !array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $value;
                putenv("{$key}={$value}");
            }
        }

        break;
    }
}

function env(string $key, ?string $default = null): ?string
{
    load_env();

    if (array_key_exists($key, $_ENV)) {
        return (string) $_ENV[$key];
    }

    $val = getenv($key);
    if ($val !== false) {
        return (string) $val;
    }

    return $default;
}

function env_bool(string $key, bool $default = false): bool
{
    $val = env($key);
    if ($val === null || $val === '') {
        return $default;
    }
    return in_array(strtolower($val), ['1', 'true', 'yes', 'on'], true);
}
