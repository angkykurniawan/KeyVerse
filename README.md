# KeyVerse — Sistem Permainan Mengetik Adaptif Berbasis Google AI Studio

**KeyVerse** adalah aplikasi latihan mengetik multi-bahasa yang dibangun menggunakan **React (Vite + TypeScript)** di sisi frontend dan **PHP 8 REST API + MySQL** yang dirancang siap deploy ke **InfinityFree**.

## Fitur Utama

1. **Autentikasi Terkelola (Tanpa Pendaftaran Mandiri)**
   - Tidak ada halaman/endpoint registrasi publik.
   - Seluruh akun user didaftarkan langsung oleh **Administrator** melalui Panel Admin.
   - Autentikasi stateless menggunakan JWT HMAC-SHA256 dan enkripsi password `bcrypt`.
2. **Manajemen Multi-Bahasa oleh Admin**
   - Admin dapat menambah, mengubah, mengaktifkan/menonaktifkan, dan menghapus bahasa latihan beserta panduan gaya prompt AI.
3. **Generate Teks Latihan dari 5 Kata Utama + Model Dinamis Google AI Studio**
   - User memilih bahasa aktif dan memasukkan **tepat 5 kata utama** dari bidang minatnya.
   - Daftar model AI diambil **secara dinamis dari Google AI Studio API** sesuai API key yang aktif (default dari `GEMINI_API_KEY` di `.env`, dengan opsi override API key kustom di menu **Pengaturan API Key**).
4. **Arena Mengetik Real-Time & Grafik Progres**
   - Live WPM, Raw WPM, Akurasi %, timer otomatis, efek suara ketikan opsional (Web Audio API), dan grafik kecepatan per detik.
   - Riwayat latihan otomatis tersimpan ke database lengkap dengan statistik KPI, filter bahasa, dan grafik tren progres.
5. **Konfigurasi Confidential di `.env`**
   - Kredensial database InfinityFree, `JWT_SECRET`, `GEMINI_API_KEY`, dan akun admin awal seluruhnya dikelola lewat `.env` (terproteksi oleh `.gitignore` dan `.htaccess`).

---

## Menjalankan Secara Lokal (Development)

### Prasyarat
- **Node.js** 18+ & npm
- **PHP** 8.1+ (dengan ekstensi `pdo_sqlite` atau `pdo_mysql`, dan `curl`)

### 1. Konfigurasi `.env`
Salin `.env.example` menjadi `.env` (jika belum ada), lalu isi `GEMINI_API_KEY` dari [Google AI Studio](https://aistudio.google.com/apikey):

```env
DB_DRIVER=sqlite
GEMINI_API_KEY=AIzaSy...
JWT_SECRET=ganti_dengan_string_acak_panjang_minimal_32_karakter
ADMIN_INIT_USERNAME=admin
ADMIN_INIT_PASSWORD=AdminKeyVerse123!
```

> Saat pertama kali API diakses, akun admin awal otomatis dibuat dari `ADMIN_INIT_*` di `.env` jika tabel `users` masih kosong.

### 2. Install & Jalankan Server
Jalankan di 2 terminal terpisah:

```bash
# Terminal 1: PHP REST API (port 8000)
npm run dev:api

# Terminal 2: React Frontend (port 5173, proxy /api -> 127.0.0.1:8000)
npm run dev
```

Buka `http://localhost:5173`, lalu login dengan akun admin awal dari `.env`.

---

## Panduan Deploy ke InfinityFree

Karena InfinityFree hanya mendukung **PHP + MySQL** (dan tidak mendukung Node.js maupun Remote MySQL dari luar server), KeyVerse mem-build React menjadi file statis yang berjalan berdampingan dengan PHP API di dalam `htdocs/`.

### Langkah 1: Buat Database & Import SQL di InfinityFree
1. Masuk ke Control Panel InfinityFree -> **MySQL Databases** -> buat database baru (contoh: `if0_12345678_keyverse`).
2. Catat **MySQL Hostname** (`sqlXXX.infinityfree.com`), **Database Name**, **Username**, dan **Password**.
3. Buka **phpMyAdmin** untuk database tersebut -> pilih tab **Import** -> upload file `database/schema_infinityfree.sql` -> klik **Go**.

### Langkah 2: Build Paket Deploy
Jalankan perintah berikut di komputer lokal:

```bash
npm run build:deploy
```

Perintah ini akan membuat folder `deploy_htdocs/` yang berisi:
- File hasil build React (`index.html`, `assets/`, `.htaccess`)
- Folder `api/` (PHP REST API + `api/.htaccess`)

### Langkah 3: Upload & Atur `.env` di InfinityFree
1. Upload seluruh isi folder `deploy_htdocs/` ke folder **`htdocs/`** di akun InfinityFree Anda (via FileZilla/FTP atau File Manager).
2. Di dalam `htdocs/api/`, buat file baru bernama **`.env`** (salin dari `htdocs/api/.env.example`) dan isi kredensial asli Anda:

```env
APP_ENV=production
APP_DEBUG=false
CORS_ORIGIN=https://domain-anda.infinityfreeapp.com

DB_DRIVER=mysql
DB_HOST=sqlXXX.infinityfree.com
DB_PORT=3306
DB_NAME=if0_12345678_keyverse
DB_USER=if0_12345678
DB_PASS=password_database_infinityfree_anda

JWT_SECRET=isi_string_acak_minimal_32_karakter_yang_sangat_kuat
JWT_TTL_SECONDS=86400

GEMINI_API_KEY=AIzaSy_api_key_google_ai_studio_anda

ADMIN_INIT_NAME=Administrator
ADMIN_INIT_USERNAME=admin
ADMIN_INIT_EMAIL=admin@domain-anda.com
ADMIN_INIT_PASSWORD=PasswordAdminKuat123!
```

3. File `.htaccess` di `htdocs/` dan `htdocs/api/` sudah memblokir akses HTTP langsung ke `.env`, `.sql`, dan folder internal `config/`, `lib/`, `controllers/`.
4. Buka domain InfinityFree Anda, login sebagai Admin, lalu mulai daftarkan user dan tambahkan bahasa!
