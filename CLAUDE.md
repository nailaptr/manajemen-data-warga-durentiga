# CLAUDE.md — Sistem Pendataan Warga RT/RW

Sumber kebenaran: `docs/PRD.md` (PRD/SRS), `docs/mockup/` (14 layar), `docs/V1 Playbook Vibe Coding Sistem Pendataan Warga RT RW.md`. Jika dokumen ini bertentangan dengan PRD, tanyakan; jangan menebak.

## 1. Ringkasan proyek

Aplikasi web ini mengganti pendataan warga di Excel untuk satu RW (RW 03) yang terdiri dari beberapa RT. Pengurus (Super Admin, Admin RW, Ketua RT) mengelola Kartu Keluarga dan warga, sedangkan warga memakai portal mobile-first untuk melihat data keluarganya dan mengajukan perubahan. Setiap pengajuan warga baru mengubah data resmi setelah disetujui Ketua RT, dan semua perubahan penting tercatat di log aktivitas. Dashboard statistik dan Cari Warga memakai satu logika filter yang sama, dan data lama masuk lewat import Excel. Cakupan data (RW, RT, atau satu KK) ditegakkan di server, dan NIK serta No KK dimasking karena termasuk data pribadi.

## 2. Tech stack

| Pilihan | Alasan |
| --- | --- |
| Next.js (App Router) + TypeScript | Server Actions dan Route Handlers menggantikan controller, deploy ke Vercel tanpa konfigurasi, dan tipe dipakai dari server sampai UI. |
| Tailwind CSS | Warna dan ukuran dari mockup dijadikan token sehingga tampilan konsisten di semua layar. |
| shadcn/ui | Tabel, dialog, drawer, combobox, dan form siap pakai serta mudah disesuaikan dengan token tema. Terpasang dengan style `base-nova` (`components.json`, primitif `@base-ui/react`); komponen belum ada, ditambah per kebutuhan dengan `pnpm dlx shadcn@4.22.0 add <nama>`. Komponennya mengimpor `cn` dari paket `cn` (dibuat tim shadcn), bukan `lib/utils.ts`. Token semantik shadcn dipetakan ke warna proyek di `app/globals.css`. |
| Prisma 7 | Skema bertipe dan migrasi terversi, dengan `$queryRaw` berparameter untuk filter usia. Memakai driver adapter `@prisma/adapter-pg`; client dibuat ke `generated/prisma` (tidak di-commit, dibuat oleh `postinstall`). Versi `prisma`, `@prisma/client`, dan adapter dipin sama. |
| PostgreSQL 17 | Mendukung partial unique index dan `age()`. Lokal: Docker Compose. Produksi: Neon lewat Vercel Marketplace (akun Neon belum dibuat, belum dipakai). |
| Better Auth | Email + kata sandi, verifikasi email, dan reset sandi sudah tersedia. Dipetakan ke tabel `users`; kata sandi disimpan di tabel `account` (lihat bagian 7). Sign-up publik dimatikan. |
| Zod | Satu skema validasi dipakai di browser dan di server. Terpasang, belum dipakai. |
| React Hook Form (belum dipasang) | Form besar (repeater anggota KK) tetap ringan dan terhubung ke skema Zod. |
| TanStack Table | Pagination, sorting, dan filter di server untuk tabel dengan ribuan baris. Terpasang versi 9 (`@tanstack/react-table`), API-nya beda dari v8: opsi `features: tableFeatures({ rowPaginationFeature })`, bukan `getCoreRowModel`. Baru `DataTable` yang memakainya. |
| Recharts (belum dipasang) | Bar, donut, dan piramida penduduk di dashboard tanpa pustaka grafik tambahan. |
| SheetJS / ExcelJS (belum dipasang) | SheetJS membaca `.xlsx`/`.csv` di browser untuk import, ExcelJS menulis file export di server (asumsi sementara; lihat bagian 7). |
| Resend (belum dipasang) | Email verifikasi akun, reset sandi, dan notifikasi pengajuan dengan konfigurasi minimal. Sementara `lib/email.ts` mencetak tautan ke terminal saat dev dan melempar error di produksi. |
| Vitest | Tes aturan bisnis, parser filter, normalisasi import, dan tes integrasi ke Postgres lokal. |
| Playwright (belum dipasang) | E2E untuk alur kritis dan tes otomatis cakupan data (SEC-04, AC-04, AC-05). |

## 3. Struktur folder

Berdasarkan PRD bagian 9.3. Perubahan struktur butuh persetujuan (lihat "Cara bekerja").

```text
app/
  layout.tsx, globals.css   # Plus Jakarta Sans, token warna Tailwind
  page.tsx                  # arahkan: belum masuk -> /masuk, WARGA -> /beranda, lainnya -> /dashboard
  tidak-berwenang/          # tujuan requireRole() bila peran tidak cocok
  (publik)/masuk, lupa-sandi, atur-ulang-sandi   # ada; `daftar` (klaim akun) belum
  (pengurus)/layout.tsx     # requireRole(...PENGURUS) + KerangkaPengurus (sidebar)
  (pengurus)/dashboard, cari-warga, warga, kk (baru, [id], [id]/ubah),
             pengajuan, import, pengguna (klaim), pengaturan (master, kategori-usia), log
             # semua rute PRD 5.1 ada, tetapi isinya baru judul halaman + requireRole
  (warga)/layout.tsx        # requireRole("WARGA") + KerangkaWarga (header + navigasi bawah)
  (warga)/beranda, keluarga, pengajuan-saya (baru)   # judul saja
  profil/                   # layout memilih kerangka pengurus atau warga menurut peran (PRD 5.1: "Semua")
  api/auth/[...all]         # ada (handler Better Auth); api/export, api/import-batch belum
components/
  kartu-form.tsx, tombol-keluar.tsx   # form publik, tombol Keluar (prop className)
  kerangka-pengurus.tsx, kerangka-warga.tsx   # kerangka halaman (klien, menu aktif lewat usePathname)
  judul-halaman.tsx                   # h1 + deskripsi opsional, dipakai semua halaman
  stat-card.tsx, status-badge.tsx, filter-chip.tsx, data-table.tsx   # komponen dasar
  ui/                                 # shadcn/ui, belum ada komponen
lib/
  db.ts            # singleton PrismaClient (adapter pg), baca DATABASE_URL
  auth.ts          # konfigurasi Better Auth + getSession() + requireRole(...peran)
  auth-client.ts   # authClient untuk komponen klien
  navigasi.ts      # PENGURUS/ADMIN (daftar peran), NAMA_PERAN, menuPengurus(role), MENU_WARGA, menuAktif()
  login-lockout.ts # hitungLoginGagal(), catatLoginGagal() (via activity_logs)
  akun.ts          # buatAkunAktif(): satu-satunya jalan membuat akun berkata sandi (seed, skrip admin)
  email.ts         # kirimEmail()
  scope.ts         # scopeWhere(user, entity): cakupan RW/RT/KK; entity = "warga" | "kartu_keluarga" | "pengajuan"
  filters.ts       # satu parser filter URL -> query                (belum)
  data/            # satu-satunya tempat memanggil prisma.warga / prisma.kartuKeluarga (belum)
  import/          # parse, normalisasi, validasi                   (belum)
  validators/      # skema Zod bersama                              (belum)
  activity-log.ts  # penulisan activity_logs                        (belum)
  mask.ts          # masking NIK / No KK                            (belum)
prisma/
  schema.prisma, migrations/
  seed.ts, seed-dev-users.ts   # master data + akun uji dev
prisma.config.ts               # skema, migrasi, perintah seed, DATABASE_URL
generated/prisma/              # client Prisma (tidak di-commit)
scripts/create-admin.ts        # Super Admin pertama (produksi)
tests/
  integration/     # Vitest ke Postgres lokal; helpers.ts berisi dalamRollback() dan tipe Tx
  unit/            # Vitest tanpa database (belum)
  e2e/             # Playwright (belum)
docs/              # PRD, playbook, mockup
.github/workflows/ci.yml   # CI tiap pull request
README.md          # "Menjalankan secara lokal"
```

## 4. Perintah

Manajer paket: pnpm. Postgres lokal harus jalan sebelum `pnpm test` dan `pnpm db:*`. Tes memakai wilayah dari seed, jadi `pnpm db:deploy` dan `pnpm db:seed` harus sudah dijalankan.

| Keperluan | Perintah |
| --- | --- |
| Postgres lokal (Docker Compose, port 5433) | `pnpm db:up` (`docker compose up -d db`) |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` (`next typegen && tsc --noEmit`; typegen membuat tipe `LayoutProps`/`PageProps`) |
| Tes (Vitest) | `pnpm test` (`vitest run`) |
| E2E | `pnpm test:e2e` (Playwright belum dipasang, skrip belum bisa jalan) |
| Migrasi baru (dev) | `pnpm db:migrate` (`prisma migrate dev`) |
| Migrasi (produksi/CI) | `pnpm db:deploy` (`prisma migrate deploy`) |
| Buat ulang client Prisma | `pnpm db:generate` (jalankan setelah mengubah `schema.prisma`; `migrate dev` tidak melakukannya) |
| Seed (master data + akun uji dev) | `pnpm db:seed` |
| Super Admin pertama | `ADMIN_NAMA=... ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm db:create-admin` |

Variabel lingkungan (`.env`, tidak di-commit; contoh di `.env.example`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SEED_DEV_PASSWORD` (min. 12 karakter; kosong berarti akun uji dilewati).

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

### Pola yang sudah dipakai di kode

- CI (`.github/workflows/ci.yml`, tiap pull request): install `--frozen-lockfile`, lint, typecheck, `db:deploy` + `db:seed`, test, dengan service Postgres 17. Variabel lingkungan diisi nilai uji di workflow; `SEED_DEV_PASSWORD` sengaja kosong sehingga akun uji dilewati.
- Daftar peran dan menu ada di `lib/navigasi.ts`: halaman pengurus memanggil `requireRole(...PENGURUS)` atau `requireRole(...ADMIN)` (Import, Pengguna, Pengaturan, Log). Menu sidebar mengikuti PRD 5.2; menu aktif dicocokkan dengan awalan rute (`awalan` untuk Pengaturan).
- Layout kelompok rute (`(pengurus)`, `(warga)`, `profil`) memanggil `requireRole` dan membungkus halaman dengan kerangka; tiap `page.tsx` di `(pengurus)` dan `(warga)` tetap memanggil `requireRole` sendiri (peran per halaman bisa lebih sempit dari layout). `profil/page.tsx` tidak, karena layout-nya sudah menerima semua peran.
- Kerangka pengurus: sidebar tetap di layar lebar (`lg`), laci dengan tombol menu di layar kecil (Escape menutup). Kerangka warga: navigasi bawah tetap, lebar maksimum `max-w-xl`, huruf dasar 16 px, target sentuh minimal 44 px.
- Komponen dasar: `StatCard` (ikon sebagai ReactNode), `StatusBadge` (status `aktif | disetujui | menunggu | ditolak | nonaktif`, teks selalu tertulis), `FilterChip` (`hrefHapus` = URL tanpa filter itu, tautan biasa), `DataTable` (komponen klien; `halaman` dan `ukuranHalaman` dari URL `?halaman=`, `total` dari server, ada keadaan kosong dan galat). Kolom `DataTable` yang dikirim dari Server Component harus data biasa (`accessorKey`, `header` string), bukan fungsi.
- Token status (hijau, kuning, merah, abu, teal muda) ada di `app/globals.css` sebagai `--color-sukses(-latar)`, `--color-peringatan(-latar)`, `--color-galat-latar`, `--color-nonaktif-latar`, `--color-teal-muda`.

- Akses database lewat `import { prisma } from "@/lib/db"` (dari `prisma/` dan `scripts/` pakai path relatif).
- Halaman terlindungi memanggil `requireRole("SUPER_ADMIN", ...)` dari `lib/auth.ts`. Belum masuk dialihkan ke `/masuk`; peran tidak cocok ke `/tidak-berwenang`. `getSession()` membaca ulang peran dan status dari database di tiap permintaan.
- `scopeWhere(user, entity)` (`lib/scope.ts`) mengembalikan filter Prisma untuk cakupan akses: Super Admin semua, Admin RW menurut `rw`, Ketua RT menurut `wilayah_id`, Warga hanya KK dari `warga_id` (warga yang di-soft-delete tidak mendapat apa pun). Data pengguna tidak lengkap menghasilkan filter yang tidak cocok dengan apa pun. Filter ini tidak menyaring `deleted_at` atau status; pemanggil menambahkannya sendiri. Dipakai dengan `where: { AND: [scopeWhere(user, "warga"), ...] }`.
- Seed dev membuat empat akun (satu per peran): `superadmin@`, `adminrw@`, `ketuart01@`, `warga@contoh.test`; akun Warga terhubung ke satu KK dan warga palsu (NIK/No KK berawalan `999`).
- Akun berkata sandi dibuat hanya lewat `buatAkunAktif()` (`lib/akun.ts`). Sign-up Better Auth dimatikan.
- Id Better Auth dibuat sebagai UUID (`advanced.database.generateId: "uuid"`) karena semua kunci utama bertipe `uuid`.
- Kunci login: `hooks.before`/`hooks.after` di `lib/auth.ts` memakai `activity_logs` (aksi `LOGIN_GAGAL`, `entitas = "email"`, `entitas_id` = email huruf kecil). Berlaku untuk email apa pun agar respons tidak membuka email terdaftar.
- Pesan galat login dipetakan ke Bahasa Indonesia di `app/(publik)/masuk/form-masuk.tsx`; pesan "lupa sandi" selalu sama.
- Komponen halaman klien diletakkan satu folder dengan `page.tsx` (contoh `form-masuk.tsx`); komponen bersama di `components/`. Navigasi klien memakai `useRouter()` (`push` lalu `refresh`), bukan `window.location`.
- Tabel pustaka Better Auth (`session`, `account`, `verification`) memakai nama kolom camelCase bawaan; tabel PRD memakai snake_case. Pemetaan field `users` ada di `user.fields` pada `lib/auth.ts`.
- Constraint yang tidak bisa ditulis di Prisma (CHECK 16 digit `nik`/`no_kk`, partial unique index `one_head_per_kk`) ada di SQL migrasi `20261028175015_init`.
- Seed idempoten (`upsert`/cek ada dulu). `prisma/seed-dev-users.ts` menolak jalan bila `NODE_ENV=production`.

### Cara menulis tes (pola yang ada)

- Berkas di `tests/<jenis>/*.test.ts`; konfigurasi `vitest.config.mts` (alias `@` ke akar repo, `fileParallelism: false` karena semua tes integrasi memakai satu database).
- Nama tes dalam Bahasa Indonesia, menyebut ID aturan PRD bila ada (contoh: "(BR-02)", "(FR-AUTH-04)").
- Tes DB memakai transaksi yang selalu di-rollback (`dalamRollback()` di `tests/integration/db-constraints.test.ts`) agar database tetap bersih. Tes yang harus melewati transaksi sendiri (Better Auth) membuat data dengan email `@contoh.test`, dan menghapusnya di `beforeAll`/`afterAll`.
- Data uji memakai NIK/No KK berawalan `999` dan email `@contoh.test`; bukan data nyata.
- Tes `requireRole` memalsukan `next/headers`, `next/navigation` (redirect melempar `REDIRECT:<url>`), dan `auth.api.getSession` dengan `vi.mock`/`vi.spyOn`; pengguna tetap dibuat di database sungguhan.
- Tes cakupan membuat data lalu membatasi hasil dengan `id in [...]` agar data seed tidak ikut terhitung.
- Tes constraint memanggil SQL mentah untuk kasus yang ditolak Prisma sebelum sampai ke database (NIK bukan 16 digit, warga tanpa KK).

## 6. Definisi selesai

- Sesuai ID kebutuhan di PRD, tes aturan bisnis lulus, lint dan typecheck bersih, tidak ada TODO tersembunyi, ringkasan perubahan ditulis.

Gerbang per fase merujuk ke kriteria penerimaan PRD 12.2: gerbang 1 → AC-04, gerbang 2 → AC-03, gerbang 3 → AC-01, gerbang 4 → AC-06, gerbang 5 → semua AC.

## 7. Hal yang belum diputuskan (PRD 12.4) dan asumsi sementara

Asumsi di bawah dipakai agar pengembangan jalan. Setiap asumsi bisa berubah; jika sebuah tugas bergantung padanya, sebutkan di rencana.

| Pertanyaan terbuka | Asumsi sementara |
| --- | --- |
| Kolom dan jumlah baris Excel saat ini | Memakai kolom template PRD 7.2; perbedaan nama kolom dijembatani wizard mapping. Batas 5.000 baris per file. |
| Satu RW atau beberapa RW | Satu RW (RW 03 di mockup). Model data tetap menyimpan `rw` dan `rt` lewat tabel `wilayah` agar bisa berkembang. |
| Login dengan email atau nomor HP | Login dengan email saja; `no_hp` disimpan sebagai kontak opsional. OTP SMS/WhatsApp di luar lingkup v1. Kata sandi minimal 8 karakter (bawaan Better Auth; PRD tidak menyebut angkanya). |
| Siapa Super Admin dan penanggung jawab data pribadi | Produksi: satu akun Super Admin dibuat dengan `pnpm db:create-admin` (menolak jalan bila Super Admin aktif sudah ada). Dev: seed membuat akun uji. Penanggung jawab data diisi pengurus sebelum peluncuran. |
| Ketua RT atau Admin RW yang memverifikasi klaim dan pengajuan | Ketua RT untuk RT-nya; Admin RW dan Super Admin boleh menggantikan (sesuai matriks PRD 2.2). |
| Foto KK/KTP wajib untuk perubahan NIK, nama, tanggal lahir | Tidak wajib; lampiran (FR-PGJ-07, Could) ditunda. |
| Usia minimal akun warga | 17 tahun (PRD 1.4). |
| Definisi final kategori usia dan default wilayah | Kategori awal sesuai tabel PRD 6.2, disimpan di tabel `kategori_usia` dan bisa diubah tanpa deploy. Default kelurahan, kecamatan, kota diambil dari konfigurasi seed (nilai placeholder sampai dikonfirmasi). |
| Persetujuan kebijakan privasi oleh kelurahan/hukum | Halaman Kebijakan Privasi berisi draf; persetujuan pihak luar menjadi syarat peluncuran, bukan syarat pengembangan. |
| Estimasi durasi fase | Tidak diestimasi sampai jumlah pengembang dan kolom Excel diketahui. |

Asumsi teknis yang masih perlu dikonfirmasi saat pertama dipakai: SheetJS untuk parse di browser dan ExcelJS untuk export di server. Sudah diputuskan dan dipakai: pnpm, Prisma, Better Auth, Docker Compose untuk database lokal.

### Penyimpangan dari PRD bagian 8 yang sudah diterapkan

- `users.password_hash` tidak ada; Better Auth menyimpan hash di `account.password` (`providerId = "credential"`).
- `users.email_verified_at` (timestamp) diganti `users.email_verified` (boolean), sesuai tipe yang dipakai Better Auth.
- `users.image` ditambahkan karena diwajibkan Better Auth; aplikasi tidak memakainya.
- Tabel `session`, `account`, `verification` ditambahkan (PRD 8 mengizinkan tabel pustaka sesi).
- `cacheComponents` dan `partialPrefetching` dimatikan di `next.config.ts`; dengan opsi itu build gagal pada halaman yang membaca sesi.
- Pengiriman email produksi belum ada (Resend belum dipasang); `kirimEmail()` melempar error di produksi.
- Sesi berakhir setelah 30 menit tidak aktif lewat `session.expiresIn` + `updateAge` (FR-AUTH-04).
- `activity_logs.user_id` nullable agar kejadian tanpa pengguna dikenal (login gagal) tercatat.

## 8. Catatan dari mockup dan PRD yang perlu ditanyakan saat relevan

- Mockup memakai huruf 14/15 px; portal warga harus 16 px (NFR-04).
- Halaman Masuk, Lupa sandi, dan Atur ulang sandi dibuat sebagai form sederhana (satu kartu di tengah, token warna PRD) atas persetujuan pemilik proyek karena mockup tidak ada; boleh diganti bila mockup datang.
- Mockup belum menggambar: Detail KK, Profil, Import langkah 1/2/4, serta kondisi kosong, memuat, dan error. Tanyakan sebelum merancang sendiri.
- Mockup Pengaturan memakai satu halaman bertab (Pendidikan, Pekerjaan, Kategori usia, RT dan RW), sedangkan PRD 5.1 menyebut dua rute (`/pengaturan/master`, `/pengaturan/kategori-usia`). Putuskan bersama sebelum membangun.
- Seluruh nama, NIK, dan angka di mockup adalah data contoh; jangan dijadikan data seed nyata.
