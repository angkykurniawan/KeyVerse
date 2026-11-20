# 🔑 Daftar Kredensial Akun (Username & Password) — KeyVerse

Dokumen ini memuat seluruh akun default, akun administrator awal, dan akun peserta lomba untuk web aplikasi **KeyVerse**.

* **URL Web Aplikasi (Live Production):** [https://key-verse-seven.vercel.app/](https://key-verse-seven.vercel.app/)
* **Backend & Database Host:** InfinityFree (`mythoria.site.je`)
* **MySQL Database:** `if0_43461432_keyverse` (Host: `sql200.infinityfree.com`)

---

## 🛡️ 1. Akun Administrator (Full Access)

Digunakan untuk mengakses **Admin HQ**, mengelola user (menambah, mengubah status aktif/nonaktif, menghapus), mengatur sirkuit multi-bahasa, serta mengatur konfigurasi Google AI Studio API Key.

| Atribut | Detail Kredensial |
| :--- | :--- |
| **Akses Web** | [https://key-verse-seven.vercel.app/](https://key-verse-seven.vercel.app/) |
| **Role** | `admin` |
| **Nama** | Administrator |
| **Username** | `admin` |
| **Email** | `admin@keyverse.local` |
| **Password** | `AdminKeyVerse123!` |
| **Hak Akses** | Kelola Pengguna, Pengaturan Bahasa Latihan, API Key Gemini, Pantau Seluruh Riwayat Latihan |

> ⚠️ **Catatan Keamanan:** Disarankan untuk segera mengganti password akun admin ini melalui panel admin setelah sistem digunakan secara luas.

---

## 🏎️ 2. Akun Pengguna / Peserta Lomba (Production Database)

Akun-akun ini siap pakai dan terdaftar di dalam database MySQL untuk mencoba simulasi latihan mengetik mandiri maupun adu ketik *Real-Time Versus Room*.

> 🔑 **Password Default untuk SEMUA akun peserta di bawah:**  
> **`UserKeyVerse123!`**

| No | Nama Lengkap | Username | Email | Role | Password |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | **Budi Santoso** | `budi.racer` | `budi@keyverse.local` | `user` | `UserKeyVerse123!` |
| 2 | **Nadia Pratama** | `nadia.speed` | `nadia@keyverse.local` | `user` | `UserKeyVerse123!` |
| 3 | **Raka Wijaya** | `raka.pro` | `raka@keyverse.local` | `user` | `UserKeyVerse123!` |
| 4 | **Sinta Maharani** | `sinta.dev` | `sinta@keyverse.local` | `user` | `UserKeyVerse123!` |

---

## 💻 3. Akun Pengguna Demo (Mode Lokal / SQLite Development)

Akun cadangan yang di-*seed* secara otomatis saat sistem dijalankan di komputer lokal menggunakan SQLite (`DB_DRIVER=sqlite`).

| Atribut | Detail Kredensial |
| :--- | :--- |
| **Role** | `user` |
| **Nama** | Peserta Demo |
| **Username** | `user` |
| **Email** | `user@keyverse.local` |
| **Password** | `UserKeyVerse123!` |

---

## 📌 Cara Melakukan Login di Web

1. Kunjungi website resmi: **[https://key-verse-seven.vercel.app/](https://key-verse-seven.vercel.app/)**
2. Pada bagian kanan formulir **RACER CHECK-IN**:
   * Masukkan **Username** (contoh: `admin` atau `budi.racer`) atau **Email** di kolom pertama.
   * Masukkan **Password** (contoh: `AdminKeyVerse123!` untuk admin atau `UserKeyVerse123!` untuk peserta).
3. Klik tombol **MASUK KE ARENA**.
