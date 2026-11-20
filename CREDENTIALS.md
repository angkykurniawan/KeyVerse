# 🔑 Daftar Kredensial Akun (Username & Password) — KeyVerse

Dokumen ini memuat seluruh akun default, akun administrator awal, dan akun dummy/peserta yang terdaftar di dalam sistem **KeyVerse** (berdasarkan konfigurasi `.env.example`, `database/schema_infinityfree.sql`, dan `api/config/database.php`).

---

## 🛡️ 1. Akun Administrator (Full Access)

Digunakan untuk mengakses **Admin HQ**, mengelola user (buat akun baru, ubah status), mengatur bahasa latihan, serta konfigurasi Google AI Studio API Key.

| Field | Nilai / Kredensial |
| :--- | :--- |
| **Role** | `admin` |
| **Nama** | Administrator |
| **Username** | `admin` |
| **Email** | `admin@keyverse.local` |
| **Password** | `AdminKeyVerse123!` |
| **Sumber Konfigurasi** | `.env.example` (variabel `ADMIN_INIT_*`) & `schema_infinityfree.sql` |

> ⚠️ **Catatan Keamanan:** Segera ubah password akun admin ini melalui panel admin atau database setelah aplikasi dideploy ke lingkungan produksi (production).

---

## 🏎️ 2. Akun Pengguna / Peserta Lomba (Production & MySQL Import)

Akun-akun ini otomatis terbuat saat mengimpor file `database/schema_infinityfree.sql` ke database MySQL (misal: di phpMyAdmin InfinityFree).

> **Password default untuk SEMUA akun peserta di bawah:**  
> 🔑 **`UserKeyVerse123!`**

| No | Nama Lengkap | Username | Email | Role | Password |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | Budi Santoso | `budi.racer` | `budi@keyverse.local` | `user` | `UserKeyVerse123!` |
| 2 | Nadia Pratama | `nadia.speed` | `nadia@keyverse.local` | `user` | `UserKeyVerse123!` |
| 3 | Raka Wijaya | `raka.pro` | `raka@keyverse.local` | `user` | `UserKeyVerse123!` |
| 4 | Sinta Maharani | `sinta.dev` | `sinta@keyverse.local` | `user` | `UserKeyVerse123!` |

---

## 💻 3. Akun Pengguna Demo (Mode Lokal / SQLite Development)

Akun ini otomatis dibuat oleh sistem saat menjalankan backend dalam mode SQLite (`DB_DRIVER=sqlite` pada `api/config/database.php`).

| Field | Nilai / Kredensial |
| :--- | :--- |
| **Role** | `user` |
| **Nama** | Peserta Demo |
| **Username** | `user` |
| **Email** | `user@keyverse.local` |
| **Password** | `UserKeyVerse123!` |

---

## 📌 Cara Melakukan Login

1. Buka halaman utama aplikasi KeyVerse di browser (`http://localhost:5173` atau domain live Anda).
2. Pada form **Racer Check-In**:
   - Masukkan **Username** atau **Email** di kolom pertama.
   - Masukkan **Password** di kolom kedua.
3. Klik tombol **MASUK KE ARENA**.
