# Sistem Pendataan Warga RT/RW

Aplikasi web pendataan warga untuk satu RW (RW 03). Spesifikasi lengkap ada di `docs/PRD.md`; aturan kerja di `CLAUDE.md`.

## Menjalankan secara lokal

### 1. Pasang prasyarat

| Perangkat | Versi | Keterangan |
| --- | --- | --- |
| Git | terbaru | Untuk mengambil kode. |
| Node.js | 22 | Cek dengan `node -v`. |
| pnpm | 12.9.1 | Dipasang lewat Corepack (langkah di bawah). |
| Docker Desktop | terbaru | Menjalankan PostgreSQL 17. Pastikan sudah menyala sebelum langkah 4. |

Aktifkan Corepack agar `pnpm` otomatis memakai versi yang tercatat di `package.json`:

```bash
corepack enable
```

### 2. Ambil kode dan pasang dependensi

```bash
git clone https://github.com/nailaptr/manajemen-data-warga-durentiga.git
cd manajemen-data-warga-durentiga
pnpm install
```

`pnpm install` juga membuat client Prisma (`postinstall`).

### 3. Buat file `.env`

Salin contoh, lalu isi tiga nilai di bawah.

```bash
cp .env.example .env
```

Di Windows PowerShell: `Copy-Item .env.example .env`.

| Variabel | Isi |
| --- | --- |
| `DATABASE_URL` | `postgresql://warga:warga_lokal@127.0.0.1:5433/warga` (cocok dengan `docker-compose.yml`) |
| `BETTER_AUTH_SECRET` | String acak minimal 32 karakter. Buat dengan `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SEED_DEV_PASSWORD` | Kata sandi akun uji, minimal 12 karakter. Hanya untuk lokal. |

`BETTER_AUTH_URL` sudah berisi `http://localhost:3000`. Jangan commit `.env`.

### 4. Jalankan database dan siapkan isinya

```bash
pnpm db:up
pnpm db:deploy
pnpm db:seed
```

- `db:up` menjalankan PostgreSQL di `127.0.0.1:5433`. Tunggu beberapa detik sampai siap.
- `db:deploy` membuat semua tabel.
- `db:seed` mengisi master data dan empat akun uji (satu per peran): `superadmin@contoh.test`, `adminrw@contoh.test`, `ketuart01@contoh.test`, `warga@contoh.test`. Kata sandinya sama dengan `SEED_DEV_PASSWORD`.

### 5. Jalankan aplikasi

```bash
pnpm dev
```

Buka http://localhost:3000 dan masuk dengan salah satu akun uji. Tautan email (verifikasi, atur ulang sandi) tidak dikirim saat pengembangan; tautannya dicetak di terminal tempat `pnpm dev` berjalan.

### 6. Periksa bahwa semuanya benar

```bash
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm test` memakai database dari `DATABASE_URL`, jadi langkah 4 (termasuk `db:seed`, karena tes memakai wilayah dari seed) harus sudah selesai. Pemeriksaan yang sama berjalan di GitHub Actions pada setiap pull request (`.github/workflows/ci.yml`).

### Masalah umum

- **`pnpm db:up` gagal menghubungi Docker**: nyalakan Docker Desktop dulu, lalu ulangi.
- **Port 5433 sudah dipakai**: hentikan program yang memakainya, atau ubah port di `docker-compose.yml` dan `DATABASE_URL`.
- **Tabel atau wilayah tidak ditemukan saat `pnpm test`**: jalankan `pnpm db:deploy` lalu `pnpm db:seed`.
- **Setelah mengubah `prisma/schema.prisma`**: jalankan `pnpm db:generate`.
- **Mengulang dari awal**: `docker compose down -v` menghapus data lokal, lalu ulangi langkah 4.

## Perintah lain

Daftar lengkap perintah ada di `CLAUDE.md` bagian 4.
