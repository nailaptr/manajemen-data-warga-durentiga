# CLAUDE.md — Sistem Pendataan Warga RT/RW

Sumber kebenaran: `docs/PRD.md` (PRD/SRS), `docs/mockup/` (14 layar), `docs/V1 Playbook Vibe Coding Sistem Pendataan Warga RT RW.md`. Jika dokumen ini bertentangan dengan PRD, tanyakan; jangan menebak.

## 1. Ringkasan proyek

Aplikasi web ini mengganti pendataan warga di Excel untuk satu RW (RW 03) yang terdiri dari beberapa RT. Pengurus (Super Admin, Admin RW, Ketua RT) mengelola Kartu Keluarga dan warga, sedangkan warga memakai portal mobile-first untuk melihat data keluarganya dan mengajukan perubahan. Setiap pengajuan warga baru mengubah data resmi setelah disetujui Ketua RT, dan semua perubahan penting tercatat di log aktivitas. Dashboard statistik dan Cari Warga memakai satu logika filter yang sama, dan data lama masuk lewat import Excel. Cakupan data (RW, RT, atau satu KK) ditegakkan di server, dan NIK serta No KK dimasking karena termasuk data pribadi.

## 2. Tech stack

| Pilihan | Alasan |
| --- | --- |
| Next.js (App Router) + TypeScript | Server Actions dan Route Handlers menggantikan controller, deploy ke Vercel tanpa konfigurasi, dan tipe dipakai dari server sampai UI. |
| Tailwind CSS | Warna dan ukuran dari mockup dijadikan token sehingga tampilan konsisten di semua layar. |
| shadcn/ui | Tabel, dialog, drawer, combobox, dan form siap pakai serta mudah disesuaikan dengan token tema. |
| Prisma | Skema bertipe dan migrasi terversi, dengan `$queryRaw` berparameter untuk filter usia. |
| PostgreSQL (Neon) | Tersedia lewat Vercel Marketplace, mendukung partial unique index dan `age()`, dan punya branch database untuk preview. |
| Better Auth | Email + kata sandi, verifikasi email, dan reset sandi sudah tersedia, dengan field `role` dan cakupan pada tabel `users`. |
| Zod | Satu skema validasi dipakai di browser dan di server. |
| React Hook Form | Form besar (repeater anggota KK) tetap ringan dan terhubung ke skema Zod. |
| TanStack Table | Pagination, sorting, dan filter di server untuk tabel dengan ribuan baris. |
| Recharts | Bar, donut, dan piramida penduduk di dashboard tanpa pustaka grafik tambahan. |
| SheetJS / ExcelJS | SheetJS membaca `.xlsx`/`.csv` di browser untuk import, ExcelJS menulis file export di server (asumsi sementara; lihat bagian 7). |
| Resend | Email verifikasi akun, reset sandi, dan notifikasi pengajuan dengan konfigurasi minimal. |
| Vitest | Unit test cepat untuk aturan bisnis, parser filter, dan normalisasi import. |
| Playwright | E2E untuk alur kritis dan tes otomatis cakupan data (SEC-04, AC-04, AC-05). |

## 3. Struktur folder

Berdasarkan PRD bagian 9.3. Perubahan struktur butuh persetujuan (lihat "Cara bekerja").

```text
app/
  (publik)/masuk, daftar, lupa-sandi
  (pengurus)/dashboard, cari-warga, warga, kk (baru, [id], [id]/ubah),
             pengajuan, import, pengguna (klaim), pengaturan (master, kategori-usia), log
  (warga)/beranda, keluarga, pengajuan-saya (baru), profil
  api/export, api/import-batch, api/auth/[...all]
components/
  ui/              # shadcn/ui
  (komponen per fitur: filter, tabel, drawer, form)
lib/
  auth.ts          # sesi, requireRole()
  scope.ts         # scopeWhere(user): cakupan RW/RT/KK
  filters.ts       # satu parser filter URL -> query (dipakai dashboard + cari warga)
  data/            # satu-satunya tempat memanggil prisma.warga / prisma.kartuKeluarga
  import/          # parse, normalisasi, validasi
  validators/      # skema Zod bersama
  activity-log.ts  # penulisan activity_logs
  mask.ts          # masking NIK / No KK
prisma/
  schema.prisma
  migrations/
  seed.ts
tests/
  unit/            # Vitest
  e2e/             # Playwright
docs/              # PRD, playbook, mockup
```

## 4. Perintah

Skrip di bawah belum ada; dibuat di `package.json` saat inisialisasi proyek (setelah rencana disetujui). Manajer paket: pnpm (asumsi sementara).

| Keperluan | Perintah |
| --- | --- |
| Postgres lokal (Docker Compose) | `docker compose up -d db` |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) |
| Unit test | `pnpm test` (`vitest run`) |
| E2E test | `pnpm test:e2e` (`playwright test`) |
| Migrasi (dev, buat migrasi baru) | `pnpm db:migrate` (`prisma migrate dev`) |
| Migrasi (produksi/CI) | `pnpm db:deploy` (`prisma migrate deploy`) |
| Seed (master data, kategori usia, Super Admin, data uji) | `pnpm db:seed` (`prisma db seed`) |

## 5. Aturan kode dan keamanan

## Bahasa
- Teks antarmuka, pesan error, dan komentar bisnis dalam Bahasa Indonesia.
- Nama kolom dan variabel mengikuti PRD (nik, no_kk, kartu_keluarga_id).

## Data dan keamanan
- NIK dan No KK selalu string 16 digit, tidak pernah number.
- Semua query warga, KK, dan pengajuan HARUS lewat helper scopeWhere(user). Dilarang memanggil prisma.warga atau prisma.kartuKeluarga langsung di luar lib/data/.
- Setiap Server Action dan Route Handler memanggil requireRole() dan memvalidasi input dengan Zod di server.
- Jangan pernah mencatat (log/console) NIK, No KK, atau tanggal lahir.
- NIK dan No KK tampil dimasking di tabel. Tampil penuh hanya di detail untuk peran yang berhak, dan pembukaannya dicatat di activity_logs.
- Jangan commit .env*, file Excel asli, atau dump database.
- Hapus berarti soft delete (deleted_at). Statistik hanya menghitung status_kependudukan AKTIF.
- Usia tidak disimpan; hitung dari tanggal_lahir.

## Database
- Perubahan skema hanya lewat migrasi Prisma.
- Operasi multi-tabel memakai satu transaksi: simpan KK + anggota, setujui pengajuan, import per batch.

## Kode
- TypeScript strict, tanpa any.
- Tata letak mengikuti docs/mockup. Jangan mengubah desain tanpa bertanya.
- Warna dan ukuran lewat token Tailwind (teal #0B6E7F, sidebar #25303B, latar #EEF2F4).
- Dashboard dan Cari Warga memakai satu parser filter dan satu query (lib/filters.ts).
- Jangan menambah dependensi baru tanpa menyebut alasannya.

## Cara bekerja
- Mulai tiap tugas dengan rencana singkat; tunggu persetujuan untuk perubahan skema, autentikasi, atau struktur folder.
- Setelah selesai jalankan lint, typecheck, dan test, lalu laporkan hasilnya apa adanya.
- Jika PRD ambigu atau bertentangan, tanyakan. Jangan menebak.

### Acuan tambahan dari PRD (bukan pengganti aturan di atas)

- Token desain dari mockup (PRD 11.2): teks `#1C2630`, teks sekunder `#566370`; status hijau (aktif, disetujui), kuning (menunggu), merah (error, ditolak), abu (nonaktif); font Plus Jakarta Sans. Portal warga memakai huruf dasar 16 px dan target sentuh minimal 44 px.
- Logika filter: AND antar filter, OR di dalam satu filter multi-pilih (PRD bagian 6).
- Satu KK hanya punya satu Kepala Keluarga aktif: dijamin partial unique index `one_head_per_kk` (PRD 8.2).
- Import: file diparse di browser, dikirim per batch 200 baris, `upsert` berdasarkan NIK, file tidak disimpan di server (PRD bagian 7).
- Export dibatasi 5.000 baris per file dan setiap export dicatat di log.
- Pesan error klaim akun harus generik (tidak menyebut data mana yang salah), dibatasi 5 percobaan per jam.

## 6. Definisi selesai

- Sesuai ID kebutuhan di PRD, tes aturan bisnis lulus, lint dan typecheck bersih, tidak ada TODO tersembunyi, ringkasan perubahan ditulis.

Gerbang per fase merujuk ke kriteria penerimaan PRD 12.2: gerbang 1 → AC-04, gerbang 2 → AC-03, gerbang 3 → AC-01, gerbang 4 → AC-06, gerbang 5 → semua AC.

## 7. Hal yang belum diputuskan (PRD 12.4) dan asumsi sementara

Asumsi di bawah dipakai agar pengembangan jalan. Setiap asumsi bisa berubah; jika sebuah tugas bergantung padanya, sebutkan di rencana.

| Pertanyaan terbuka | Asumsi sementara |
| --- | --- |
| Kolom dan jumlah baris Excel saat ini | Memakai kolom template PRD 7.2; perbedaan nama kolom dijembatani wizard mapping. Batas 5.000 baris per file. |
| Satu RW atau beberapa RW | Satu RW (RW 03 di mockup). Model data tetap menyimpan `rw` dan `rt` lewat tabel `wilayah` agar bisa berkembang. |
| Login dengan email atau nomor HP | Login dengan email saja; `no_hp` disimpan sebagai kontak opsional. OTP SMS/WhatsApp di luar lingkup v1. |
| Siapa Super Admin dan penanggung jawab data pribadi | Satu akun Super Admin dibuat lewat seed; penanggung jawab data diisi pengurus sebelum peluncuran. |
| Ketua RT atau Admin RW yang memverifikasi klaim dan pengajuan | Ketua RT untuk RT-nya; Admin RW dan Super Admin boleh menggantikan (sesuai matriks PRD 2.2). |
| Foto KK/KTP wajib untuk perubahan NIK, nama, tanggal lahir | Tidak wajib; lampiran (FR-PGJ-07, Could) ditunda. |
| Usia minimal akun warga | 17 tahun (PRD 1.4). |
| Definisi final kategori usia dan default wilayah | Kategori awal sesuai tabel PRD 6.2, disimpan di tabel `kategori_usia` dan bisa diubah tanpa deploy. Default kelurahan, kecamatan, kota diambil dari konfigurasi seed (nilai placeholder sampai dikonfirmasi). |
| Persetujuan kebijakan privasi oleh kelurahan/hukum | Halaman Kebijakan Privasi berisi draf; persetujuan pihak luar menjadi syarat peluncuran, bukan syarat pengembangan. |
| Estimasi durasi fase | Tidak diestimasi sampai jumlah pengembang dan kolom Excel diketahui. |

Asumsi teknis lain yang perlu dikonfirmasi saat pertama dipakai: pnpm sebagai manajer paket; SheetJS untuk parse di browser dan ExcelJS untuk export di server; Prisma dipilih dibanding Drizzle; Better Auth dibanding Auth.js.

## 8. Catatan dari mockup dan PRD yang perlu ditanyakan saat relevan

- Mockup memakai huruf 14/15 px; portal warga harus 16 px (NFR-04).
- Mockup belum menggambar: Masuk, Lupa sandi, Detail KK, Profil, Import langkah 1/2/4, serta kondisi kosong, memuat, dan error. Tanyakan sebelum merancang sendiri.
- Mockup Pengaturan memakai satu halaman bertab (Pendidikan, Pekerjaan, Kategori usia, RT dan RW), sedangkan PRD 5.1 menyebut dua rute (`/pengaturan/master`, `/pengaturan/kategori-usia`). Putuskan bersama sebelum membangun.
- Seluruh nama, NIK, dan angka di mockup adalah data contoh; jangan dijadikan data seed nyata.
