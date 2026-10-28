# Playbook Vibe Coding: Sistem Pendataan Warga RT/RW

Oct 28, 2026 · @Krisna

## 1. Cara memakai playbook

Ikuti urutan ini: persiapan (bagian 2), Prompt 0 (bagian 4), lima fase (bagian 5 sampai 9), lalu deploy (bagian 10). Setiap fase berisi prompt berurutan yang bisa disalin dan satu gerbang kelulusan yang harus lolos sebelum lanjut ke fase berikutnya.

Playbook ini mengacu pada [PRD/SRS](https://claude.ai/artifact/C8R4yp7yP85Q5G7KMMifHX) dan [mockup](https://claude.ai/artifact/3micjnZZZNqap9Um2Vyu8D) yang sudah dibuat. Nomor bagian, ID kebutuhan (FR, BR, AC), dan nama layar di prompt merujuk ke keduanya.

### 1.1 Prinsip kerja

- **Konteks disimpan di repo, bukan di ingatan AI.** Claude tidak mengingat percakapan lama. PRD, mockup, dan aturan proyek ditaruh di `docs/` dan `CLAUDE.md` supaya setiap sesi mulai dari sumber yang sama.
- **Rencana dulu, kode kemudian.** Minta rencana dan daftar file, koreksi, baru suruh implementasi.
- **Satu prompt, satu hasil yang bisa dites, satu commit.** Prompt yang terlalu besar menghasilkan kode yang sulit diperiksa.
- **Tes adalah pagar pengaman.** Aturan bisnis, cakupan data per RT, dan import wajib punya tes. Minta AI menulisnya dan menjalankannya sendiri.
- **Kamu yang memutuskan.** Baca diff, jalankan aplikasinya, dan cek di Preview Vercel. Jangan menerima hasil hanya karena tampak benar.
- **Data warga asli tidak pernah masuk ke AI atau ke repo.** Pakai data contoh anonim untuk pengembangan.

### 1.2 Alat yang dipakai

Pakai **Claude Code** (agen yang membaca repo, mengedit file, dan menjalankan perintah; tersedia di terminal, aplikasi desktop, dan ekstensi editor) untuk semua prompt implementasi. Chat biasa di claude.ai cukup untuk berdiskusi, memutuskan pilihan desain, dan menyusun ulang prompt. Rincian pemasangan dan fitur Claude Code berubah dari waktu ke waktu, jadi ikuti dokumentasi di situs Anthropic.

### 1.3 Peta fase

| Fase | Fokus | Bagian PRD | Gerbang kelulusan |
| --- | --- | --- | --- |
| 1. Fondasi | Proyek, database, login, empat peran, layout sidebar, CI | 5, 8, 9, 10 | Login berjalan dan AC-04 lulus |
| 2. Data inti | KK, warga, master data, import Excel | 4.2, 4.3, 7 | AC-02 dan AC-03 |
| 3. Statistik | Dashboard, filter, Cari Warga, export | 4.5, 4.6, 6 | AC-01 dan AC-08 |
| 4. Portal warga | Klaim akun, pengajuan, persetujuan RT | 3, 4.4 | AC-05, AC-06, AC-09 |
| 5. Rilis | Log, masking, pengamanan, deploy produksi | 10, 11 | AC-07, AC-10, lalu semua kriteria |

Prompt ditulis dalam kotak kode. Bagian `[DI DALAM KURUNG SIKU]` kamu ganti sendiri.

## 2. Persiapan sebelum mulai

Selesaikan checklist ini sebelum menulis prompt pertama. Keterlambatan biasanya datang dari akun, data, dan keputusan yang belum siap, bukan dari kodenya.

### 2.1 Akun

- [ ] **GitHub:** repositori privat (misalnya `portal-warga-rw`). Aktifkan proteksi branch `main`: wajib lewat pull request dan CI lulus.
- [ ] **Vercel:** akun yang terhubung ke GitHub.
- [ ] **Neon (PostgreSQL):** buat lewat Vercel Marketplace atau akun Neon sendiri. Pilih region Singapura dan catat namanya.
- [ ] **Resend (atau layanan email lain):** verifikasi domain atau alamat pengirim untuk email verifikasi akun dan notifikasi.
- [ ] **Akun Claude dengan akses Claude Code.** Cek paket yang diperlukan di situs Anthropic.

### 2.2 Alat di komputer

- [ ] Git, Node.js versi LTS, pnpm (atau npm), Docker Desktop (untuk PostgreSQL lokal), editor kode, dan Claude Code.
- [ ] Cek: `node -v`, `git --version`, `docker --version` semuanya menampilkan versi.

### 2.3 Berkas yang disiapkan di repo

Link claude.ai tidak bisa dibuka oleh Claude Code, jadi PRD dan mockup harus dijadikan berkas di repo.

| Berkas | Isi | Cara membuatnya |
| --- | --- | --- |
| `docs/PRD.md` | PRD/SRS lengkap | Di dokumen PRD, ekspor ke Markdown lalu simpan |
| `docs/mockup/*.png` | Screenshot 14 layar, nama berkas = nama layar (`dashboard.png`, `cari-warga.png`, dan seterusnya) | Buka kanvas mockup, ambil screenshot tiap layar; Claude Code bisa membaca gambar |
| `docs/mockup/README.md` | Daftar layar dan ID kebutuhannya | Salin tabel 11.1 dari PRD |
| `docs/data-contoh/warga-contoh.xlsx` | 30 sampai 50 baris anonim, sengaja memuat data rusak: NIK 15 digit, NIK notasi ilmiah, tanggal campur, pendidikan "SLTA" | Salin dari Excel asli, ganti nama, NIK, dan No KK dengan angka acak |
| `CLAUDE.md` | Aturan proyek untuk setiap sesi | Bagian 4 |
| `.env.example` | Daftar variabel lingkungan tanpa nilai | Dibuat Claude di Fase 1 |
| `.gitignore` | Mengecualikan `.env*` dan `data-asli/` | Pastikan ada sebelum commit pertama |

Simpan Excel asli di luar repo, atau di folder `data-asli/` yang masuk `.gitignore`. Jangan unggah ke chat mana pun.

### 2.4 Keputusan yang dijawab dulu

Ini dipilih dari pertanyaan terbuka di PRD bagian 12.4. Jika belum tahu jawabannya, pakai jawaban sementara dan lanjut.

| Pertanyaan | Mempengaruhi | Jawaban sementara |
| --- | --- | --- |
| Kolom apa saja di Excel dan berapa baris? | Template dan pemetaan import (Fase 2) | Template di PRD bagian 7.2 |
| Satu RW atau beberapa? | Model wilayah | Satu RW; model tetap mendukung banyak |
| Warga login dengan email atau HP? | Autentikasi (Fase 1) | Email saja untuk versi 1 |
| Siapa Super Admin? | Akun pertama dan penanggung jawab data | Kamu sendiri |
| Definisi kategori usia | Seed `kategori_usia` | Nilai awal di PRD bagian 6.2 |
| Nilai default wilayah (kelurahan, kecamatan, kota) | Default form KK | Placeholder di berkas konfigurasi |
| Yang memverifikasi klaim dan pengajuan | Fase 4 | Ketua RT, sesuai asumsi PRD |

### 2.5 Uji awal

- [ ] Buat repo kosong, clone, buka Claude Code di foldernya, lalu minta "tampilkan isi folder ini". Pastikan agen bekerja di folder yang benar sebelum memberi tugas apa pun.

## 3. Siklus kerja untuk setiap fitur

Setiap prompt di bagian 5 sampai 9 dikerjakan dengan siklus yang sama, supaya kesalahan tertangkap saat masih kecil.

&#91;embedded content: siklus kerja · 7 langkah, 1 keputusan\]

Rencana disetujui lebih dulu, hasilnya dites, dan kamu membaca diff-nya sebelum commit. Jika tes gagal, perbaiki dan ulangi. Hanya hasil yang lulus yang masuk ke pull request dan diperiksa di Preview Vercel.

### 3.1 Aturan praktis

- Satu branch per fase (`fase-1-fondasi`, `fase-2-data-inti`, dan seterusnya), satu pull request per langkah.
- Jangan pindah ke prompt berikutnya sebelum hasil sebelumnya di-commit.
- Saat membaca diff, cari tiga hal: berkas yang tidak kamu minta, tes yang dilemahkan, dan data sensitif yang tercatat di log.
- Jika sebuah langkah gagal tiga kali, jangan terus memperbaiki. Buka sesi baru (bagian 11.5), jelaskan masalahnya dengan ringkas, dan minta pendekatan lain.

## 4. Prompt 0: konteks proyek

Prompt 0 membuat `CLAUDE.md`, berkas yang dibaca Claude Code di awal setiap sesi. Jalankan sekali, lalu perbarui setiap fase selesai.

### 4.1 Prompt 0

```text
Kamu membantu saya membangun "Sistem Pendataan Warga RT/RW".
Baca berurutan: docs/PRD.md (seluruhnya), docs/mockup/README.md, lalu lihat semua gambar di docs/mockup/.
Tugas: buat file CLAUDE.md di root repo. Jangan menulis kode aplikasi dulu.

CLAUDE.md harus berisi:
1. Ringkasan proyek dalam 5 kalimat.
2. Tech stack: Next.js (App Router) + TypeScript, Tailwind, shadcn/ui, Prisma, PostgreSQL (Neon), Better Auth, Zod, React Hook Form, TanStack Table, Recharts, SheetJS/ExcelJS, Resend, Vitest, Playwright. Beri alasan satu kalimat per pilihan.
3. Struktur folder yang akan dipakai.
4. Perintah: dev, build, lint, typecheck, test, migrasi database, seed.
5. Aturan kode dan keamanan: salin persis dari daftar di bawah.
6. Definisi selesai untuk setiap tugas.
7. Hal yang belum diputuskan (PRD bagian 12.4) beserta asumsi sementara.

Aturan yang harus masuk:
[TEMPEL ISI DARI BAGIAN 4.2]

Sebelum menulis, ajukan maksimal 5 pertanyaan yang benar-benar menghambat. Jika tidak ada, langsung tulis.
```

### 4.2 Aturan inti untuk CLAUDE.md

Tempel blok ini pada Prompt 0, lalu sesuaikan jika perlu.

```text
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

## Definisi selesai
- Sesuai ID kebutuhan di PRD, tes aturan bisnis lulus, lint dan typecheck bersih, tidak ada TODO tersembunyi, ringkasan perubahan ditulis.
```

### 4.3 Memperbarui CLAUDE.md

Setelah tiap fase lulus gerbang, jalankan prompt ini supaya fase berikutnya memakai pola yang sama:

```text
Perbarui CLAUDE.md berdasarkan kode yang sekarang ada: tambahkan keputusan dan pola yang kita pakai (nama helper, lokasi berkas, cara menulis tes), dan hapus yang sudah tidak berlaku. Jangan menambah aturan baru yang belum kita sepakati.
```

## 5. Fase 1: Fondasi

Hasil fase ini: aplikasi kosong yang sudah bisa login, punya empat peran, cakupan data per RT/RW/KK yang terbukti lewat tes, database lengkap dengan constraint, dan CI. Kerjakan di branch `fase-1-fondasi` dan buat satu pull request per langkah.

### Prompt 1.1: rencana

```text
Baca CLAUDE.md dan docs/PRD.md bagian 5, 8, 9, dan 10.
Susun rencana Fase 1 (Fondasi) tanpa menulis kode:
- daftar berkas yang akan dibuat atau diubah
- urutan langkah, tiap langkah bisa dites sendiri
- keputusan teknis yang perlu saya setujui (versi Next.js, pilihan library auth, struktur folder)
- risiko dan hal yang belum jelas
Tutup dengan maksimal 5 pertanyaan.
```

Baca rencananya, koreksi seperlunya, lalu setujui. Jika Claude Code punya mode rencana, pakai untuk prompt ini.

### Prompt 1.2: proyek dan database

```text
Rencana Fase 1 disetujui. Kerjakan langkah 1 saja:
- Buat proyek Next.js (App Router, TypeScript) dengan Tailwind dan shadcn/ui di repo ini.
- Siapkan docker-compose.yml hanya untuk PostgreSQL lokal.
- Pasang Prisma dan tulis schema.prisma untuk 10 tabel pada PRD bagian 8: enum, unique, index, dan partial unique index one_head_per_kk (lewat migrasi SQL).
- Buat .env.example berisi semua variabel yang dibutuhkan tanpa nilai.
- Buat seed: wilayah RW 03 dengan RT 01 sampai 05, referensi pendidikan dan pekerjaan beserta alias, dan 7 kategori usia dari PRD bagian 6.2.
Jalankan migrasi dan seed di lokal, lalu tunjukkan hasilnya. Jangan mengerjakan autentikasi dulu.
```

### Prompt 1.3: autentikasi dan peran

```text
Langkah 2: autentikasi dan otorisasi.
- Pasang Better Auth (email + kata sandi, verifikasi email, reset sandi). Baca dokumentasi resminya untuk versi terbaru; jangan menebak API.
- Tambahkan field role, wilayah_id, rw, warga_id, dan status pada pengguna sesuai tabel users di PRD.
- Buat lib/auth.ts: getSession dan requireRole(roles).
- Buat lib/scope.ts: scopeWhere(user, entity) untuk warga, kartu_keluarga, dan pengajuan. Super Admin: semua. Admin RW: sesuai rw. Ketua RT: sesuai wilayah_id. Warga: hanya KK dari warga_id.
- Pembatasan login: 5 kali gagal mengunci akun 15 menit (sederhana, di database).
- Halaman /masuk dan /lupa-sandi. Belum perlu /daftar.
- Seed 4 pengguna contoh (satu per peran) hanya untuk development; kata sandi dari variabel lingkungan, bukan di kode, dan tidak berjalan di produksi.
Tulis tes Vitest untuk scopeWhere dan requireRole. Tes harus membuktikan: Ketua RT A tidak mendapat data RT B, dan Warga tidak mendapat KK lain.
```

### Prompt 1.4: layout aplikasi

```text
Langkah 3: layout mengikuti docs/mockup/dashboard.png dan docs/mockup/beranda-warga.png.
- Route group (publik), (pengurus), dan (warga) sesuai PRD bagian 5.1.
- Sidebar gelap dengan menu per peran (PRD 5.2); navigasi bawah untuk warga di HP.
- Token warna dan font Plus Jakarta Sans di konfigurasi Tailwind.
- Setiap route berisi halaman kosong ber-judul, dilindungi requireRole.
- Komponen dasar: StatCard, DataTable (TanStack Table, pagination di server), StatusBadge, FilterChip.
Bandingkan hasilnya dengan screenshot dan sebutkan perbedaannya.
```

### Prompt 1.5: CI dan README

```text
Langkah 4: buat .github/workflows/ci.yml yang menjalankan install, lint, typecheck, dan test pada setiap pull request, dengan service PostgreSQL untuk tes. Tulis README bagian "Menjalankan secara lokal" yang bisa diikuti dari komputer bersih.
```

### Gerbang Fase 1

- [ ] Mengikuti README di folder bersih: `docker compose up`, migrasi, seed, lalu aplikasi berjalan.
- [ ] Login, logout, dan reset kata sandi berfungsi.
- [ ] Tes `scopeWhere` lulus. Uji manual: login sebagai Ketua RT lalu buka URL data RT lain, hasilnya ditolak (AC-04).
- [ ] Memasukkan dua Kepala Keluarga di KK yang sama lewat SQL ditolak database.
- [ ] CI hijau pada pull request, lalu merge ke `main`.
- [ ] Hubungkan proyek Vercel sekarang (bagian 10.1 dan 10.2) agar setiap pull request berikutnya punya Preview.
- [ ] Jalankan prompt pembaruan `CLAUDE.md` (bagian 4.3).

## 6. Fase 2: Data inti dan import Excel

Hasil fase ini: KK dan warga bisa dikelola, master data bisa diubah, dan data Excel lama masuk tanpa input manual. Mulai dengan prompt rencana yang sama seperti 1.1, hanya ganti isinya menjadi "Fase 2, PRD bagian 4.2, 4.3, 5.3, 5.4, 6, dan 7". Kerjakan di branch `fase-2-data-inti`.

### Prompt 2.1: Data KK

```text
Langkah 1: Data KK.
- /kk: tabel (No KK, kepala keluarga lewat view v_kk_ringkasan, alamat, RT/RW, jumlah anggota), pencarian, filter RT, pagination di server. Ikuti docs/mockup/data-kk.png.
- /kk/baru dan /kk/[id]/ubah: form halaman penuh dengan repeater anggota. Ikuti docs/mockup/form-kk.png dan PRD 5.4. React Hook Form + Zod; skema Zod yang sama dipakai di browser dan server.
- Simpan KK dan semua anggota dalam satu transaksi. Anggota pertama wajib Kepala Keluarga.
- /kk/[id]: detail KK, tabel anggota, tombol Tambah Anggota.
- Soft delete. Hapus KK ditolak jika masih ada anggota aktif.
Semua query lewat scopeWhere. Tulis tes untuk BR-01, BR-02, BR-03 (PRD 6.1) dan untuk atomisitas: jika satu anggota tidak valid, tidak ada data yang tersimpan.
```

### Prompt 2.2: Data Warga

```text
Langkah 2: Data Warga. Ikuti docs/mockup/data-warga.png, PRD 4.3 dan 5.3.
- Tabel dengan pencarian (nama, NIK, No KK) dan pagination di server.
- Modal Tambah dan Ubah Warga: field dan aturan sesuai PRD 5.3, combobox KK, NIK 16 digit unik, tanggal lahir tidak di masa depan. Jika digit tanggal di NIK tidak cocok dengan tanggal lahir (BR-10), tampilkan peringatan, bukan blokir.
- Ubah status kependudukan beserta tanggal_status.
- Masking NIK dan No KK di tabel lewat lib/mask.ts, lengkap dengan tes.
```

### Prompt 2.3: master data dan pengaturan

```text
Langkah 3: halaman Pengaturan sesuai docs/mockup/pengaturan.png. CRUD pendidikan (urutan dan alias), pekerjaan (alias), kategori usia, dan RT/RW. Hanya Admin RW dan Super Admin. Kategori usia dibaca dari tabel, tidak ditulis permanen di kode.
```

### Prompt 2.4: logika import (tanpa tampilan)

```text
Langkah 4: logika import Excel sebagai fungsi murni di lib/import/, belum ada tampilan. Ikuti PRD bagian 7.
- parse.ts: baca .xlsx dan .csv dengan SheetJS; sel NIK dan No KK dibaca sebagai teks.
- normalize.ts: tanggal (serial Excel, dd/mm/yyyy, yyyy-mm-dd), jenis kelamin, RT/RW menjadi 3 digit, trim, alias pendidikan dan pekerjaan.
- validate.ts: Error dan Peringatan sesuai tabel PRD 7.4, termasuk notasi ilmiah, NIK ganda dalam file, dan lebih dari satu Kepala Keluarga per No KK.
- group.ts: kelompokkan baris per No KK.
Tulis tes Vitest memakai docs/data-contoh/warga-contoh.xlsx dan fixture CSV kecil per kasus. Setiap aturan di PRD 7.3 dan 7.4 punya minimal satu tes.
```

### Prompt 2.5: wizard import

```text
Langkah 5: wizard import. Ikuti docs/mockup/import-excel.png dan PRD 7.1.
- Halaman /import untuk Admin RW dan Super Admin. Empat langkah: upload, mapping kolom (header terdeteksi otomatis, bisa diubah, mapping bisa disimpan), preview dan validasi (tab Valid, Peringatan, Error; pemetaan nilai tak dikenal; pilihan duplikat NIK), eksekusi dan laporan.
- File diparse di browser lalu dikirim per batch 200 baris ke Route Handler. Tiap batch satu transaksi dengan upsert berdasarkan NIK; KK dibuat jika belum ada.
- Catat ke import_batches dan activity_logs.
- Unduh template dan unduh daftar baris gagal.
- Jangan menyimpan file Excel di server.
Tulis tes integrasi: mengimpor file yang sama dua kali tidak menggandakan warga, dan batch yang gagal tidak meninggalkan data setengah jadi.
```

### Mengujinya dengan data nyata

Ini langkah kamu sendiri, bukan prompt.

1. Impor `warga-contoh.xlsx` (anonim) dan cek laporannya.
2. Impor salinan Excel asli di komputer lokal. Data asli tidak dikirim ke AI.
3. Catat **jenis** masalah yang muncul, bukan isi barisnya, lalu minta perbaikan dengan prompt berikut:

```text
Saat mengimpor Excel asli muncul pola masalah berikut (tanpa data asli): [CONTOH: tanggal ditulis "12-Mar-07"; pendidikan "Tamat SMA"; kolom RT berisi "RT 02"]. Tambahkan aturan normalisasi untuk pola ini beserta tesnya, dengan data fiktif.
```

### Gerbang Fase 2

- [ ] AC-02: tes warga tanpa KK dan dua Kepala Keluarga lulus.
- [ ] AC-03: file contoh dengan NIK notasi ilmiah ditandai Error, nol di depan utuh, impor dua kali tidak menggandakan.
- [ ] Excel asli berhasil diimpor secara lokal, dan baris error bisa diunduh, diperbaiki, lalu diimpor ulang.
- [ ] Form KK tersimpan atomik (coba dengan satu anggota yang sengaja salah).
- [ ] Lima layar (Data KK, Form KK, Data Warga, Pengaturan, Import) dibandingkan dengan mockup.
- [ ] `CLAUDE.md` diperbarui.

## 7. Fase 3: Statistik dan Cari Warga

Hasil fase ini: dashboard dan Cari Warga yang memakai satu logika filter, sehingga angka di dashboard selalu sama dengan daftar di Cari Warga. Kerjakan di branch `fase-3-statistik`. Mulai dengan prompt rencana seperti 1.1, dengan acuan PRD bagian 4.5, 4.6, dan 6.

### Prompt 3.1: logika filter (tanpa tampilan)

Buat logikanya dan buktikan benar sebelum ada layar, karena inilah inti sistem.

```text
Langkah 1 (tanpa tampilan): lib/filters.ts dan lib/data/stats.ts sesuai PRD bagian 6.
- Parser: query string URL (pendidikan, pekerjaan, jk, kategori, usia_min, usia_max, rt) menjadi objek filter yang divalidasi Zod. Nilai jamak dipisah koma.
- Satu fungsi buildWargaWhere(filter, user) dipakai untuk hitungan (COUNT) dan daftar. Antar filter AND; dalam satu filter OR. Kategori usia dibaca dari tabel kategori_usia, boleh tumpang tindih; kategori yang punya jenis_kelamin (usia subur) menambah kondisi jenis kelamin. Usia dihitung dari tanggal_lahir. Hanya warga AKTIF. Selalu melewati scopeWhere.
- Fungsi agregasi untuk dashboard: ringkasan, per pendidikan, per pekerjaan (10 teratas + Lainnya), piramida (kelompok 5 tahun x jenis kelamin), dan per RT. Tiap fungsi mengembalikan angka seluruh warga DAN angka hasil filter.
- Script db:seed:uji membuat 10.000 warga fiktif acak (bukan data asli) untuk uji performa.
Tulis tes: contoh kasus PRD 6.3 (SMA, Belum/Tidak Bekerja, Perempuan, Dewasa, 18-20) pada data uji buatan tes sendiri, dan jumlah COUNT harus sama dengan panjang daftar. Tes juga untuk kategori tumpang tindih dan batas usia 17, 18, 59, 60.
```

### Prompt 3.2: dashboard

```text
Langkah 2: halaman /dashboard sesuai docs/mockup/dashboard.png dan PRD 4.5.
- Kartu ringkasan, bar filter (multi pilih, rentang usia, RT), chip filter aktif yang bisa dihapus, kartu kualitas data, panel Hasil Filter (jumlah, persen, pratinjau empat nama pertama, tombol Lihat detail ke /cari-warga dengan query yang sama).
- Grafik Recharts: bar pendidikan dan pekerjaan (seluruh warga dibanding hasil filter), piramida penduduk, donut jenis kelamin, sebaran per RT.
- Filter tersimpan di URL. Ketua RT terkunci pada RT-nya (kontrol RT dinonaktifkan).
- Data diambil di Server Component; Client Component hanya untuk kontrol filter dan grafik.
Bandingkan hasilnya dengan screenshot dan sebutkan perbedaannya.
```

### Prompt 3.3: Cari Warga dan export

```text
Langkah 3: /cari-warga sesuai docs/mockup/cari-warga.png dan PRD 4.6.
- Pakai komponen filter yang sama dengan dashboard (ekstrak komponen bersama, jangan menyalin).
- Teks "N warga ditemukan", tabel dengan NIK dimasking, pagination di server, drawer detail dengan tombol "Tampilkan lengkap" yang mencatat ke activity_logs (AC-07).
- Export Excel dan CSV hasil filter (maksimal 5.000 baris) lewat Route Handler; kolom NIK dan No KK bertipe teks; catat di activity_logs; hanya untuk peran yang berhak.
- Tombol kembali ke dashboard membawa filter yang sama.
```

### Prompt 3.4: uji performa

```text
Jalankan db:seed:uji (10.000 warga). Ukur waktu query ringkasan dashboard dan daftar Cari Warga dengan EXPLAIN ANALYZE. Jika di atas 2 detik (NFR-01), usulkan index atau perubahan query dan tunjukkan hasil sebelum dan sesudah. Jangan menambah cache dulu.
```

### Gerbang Fase 3

- [ ] AC-01: tes contoh kasus lulus. Uji manual: atur filter di dashboard, klik Lihat detail, dan angkanya sama.
- [ ] AC-08: halaman tampil di bawah 2 detik pada 10.000 data uji.
- [ ] Ketua RT hanya melihat RT-nya di dashboard, Cari Warga, dan export.
- [ ] Buka hasil export di Excel: NIK dan No KK tampil 16 digit utuh, bukan notasi ilmiah.
- [ ] Dashboard dan Cari Warga dibandingkan dengan mockup.
- [ ] `CLAUDE.md` diperbarui.

## 8. Fase 4: Portal warga dan persetujuan

Hasil fase ini: warga mendaftar, menghubungkan akunnya ke data keluarganya, dan mengajukan perubahan yang harus disetujui pengurus. Fase ini paling rawan celah keamanan, jadi tes aksesnya paling penting. Kerjakan di branch `fase-4-portal-warga`, mulai dengan prompt rencana seperti 1.1 dengan acuan PRD bagian 3 dan 4.4.

### Prompt 4.1: daftar dan klaim akun

```text
Langkah 1: daftar akun dan klaim akun sesuai PRD 3.1 dan docs/mockup/daftar-warga.png.
- /daftar: email, kata sandi (min 10 karakter), NIK, No KK, tanggal lahir, persetujuan kebijakan privasi.
- Cocokkan ketiga data identitas dengan warga yang berstatus AKTIF dan belum diklaim, usia minimal 17 tahun.
- Jika tidak cocok: tampilkan SATU pesan error yang sama untuk semua kegagalan, tidak menyebut data mana yang salah, dan waktu responsnya tidak boleh membedakan kasusnya. Batasi 5 percobaan per jam per IP dan per NIK.
- Jika cocok: buat akun berstatus MENUNGGU_VERIFIKASI, tautkan warga_id (unique di database), kirim email verifikasi.
- Akun belum bisa masuk sebelum email terverifikasi dan Ketua RT menyetujui; login menampilkan pesan "menunggu verifikasi".
Tulis tes AC-09: semua kegagalan menghasilkan pesan yang sama persis, percobaan ke-6 diblokir, dan satu data warga tidak bisa diklaim dua akun.
```

### Prompt 4.2: pengguna dan antrean klaim

```text
Langkah 2: halaman /pengguna sesuai docs/mockup/pengguna.png dan PRD 4.8.
- Daftar akun pengurus: tambah, ubah peran dan RT, nonaktifkan, reset kata sandi. Admin RW hanya boleh mengelola akun Ketua RT.
- Antrean klaim akun: Ketua RT hanya melihat RT-nya. Setujui atau tolak, kirim email hasil, dan catat di activity_logs.
```

### Prompt 4.3: portal warga

```text
Langkah 3: portal warga sesuai docs/mockup/beranda-warga.png dan keluarga-saya.png. Rancang untuk HP dulu.
- /beranda, /keluarga, /pengajuan-saya.
- Warga hanya melihat KK dari warga_id-nya, termasuk semua anggota. NIK dan No KK milik KK sendiri boleh tampil penuh.
- Warga tidak punya akses ke /dashboard, /cari-warga, atau KK lain (AC-05), dicek di server.
```

### Prompt 4.4: pengajuan perubahan

```text
Langkah 4: pengajuan perubahan sesuai PRD 3.3 dan 4.4, docs/mockup/ajukan-perubahan.png dan docs/mockup/pengajuan.png.
- Jenis: ubah data warga, tambah anggota, lapor pindah, lapor meninggal. Simpan data_lama dan data_baru (hanya field yang berubah).
- Server menolak pengajuan untuk KK lain. Warga bisa membatalkan selama status MENUNGGU.
- Antrean /pengajuan untuk pengurus: tab status, detail dengan tabel Saat ini dan Usulan, tolak wajib disertai alasan minimal 10 karakter.
- Setujui = satu transaksi: terapkan ke data resmi, ubah status pengajuan, catat log.
- Jika data warga sudah berubah sejak pengajuan dibuat (bandingkan data_lama dengan data sekarang), tampilkan peringatan konflik dan minta konfirmasi (BR-08).
- Lapor pindah atau meninggal mengubah status_kependudukan. Jika yang dilaporkan Kepala Keluarga, tandai KK sebagai tanpa kepala keluarga (BR-06).
Tulis tes AC-06: data resmi tidak berubah sebelum disetujui, berubah setelah disetujui, ada log, dan konflik terdeteksi.
```

### Prompt 4.5: email

```text
Langkah 5: email lewat Resend untuk verifikasi akun, reset sandi, hasil klaim, pengajuan baru (ke Ketua RT), dan hasil pengajuan (ke warga). Satu modul lib/email.ts, teks Indonesia sederhana. Di development, email dicetak ke log, bukan dikirim. Jangan menyertakan NIK atau No KK di isi email.
```

### Gerbang Fase 4

- [ ] AC-05: tes lulus. Uji manual: login sebagai warga lalu buka `/dashboard`, `/cari-warga`, dan KK lain lewat URL, semuanya ditolak.
- [ ] AC-06: alur ujung ke ujung berjalan, termasuk skenario konflik.
- [ ] AC-09: pesan gagal klaim selalu sama, dan percobaan berlebih diblokir.
- [ ] Coba di HP sungguhan (AC-10): daftar, login, lalu ajukan perubahan.
- [ ] Email tidak memuat NIK.
- [ ] Enam layar (daftar, beranda, keluarga, ajukan, pengajuan, pengguna) dibandingkan dengan mockup.
- [ ] `CLAUDE.md` diperbarui.

## 9. Fase 5: Pengamanan dan rilis

Hasil fase ini: sistem yang aman, teruji, terdokumentasi, dan siap dipasang ke produksi. Jangan melewati fase ini; di sinilah celah yang tidak terlihat dari tampilan ditemukan. Kerjakan di branch `fase-5-rilis`.

### Prompt 5.1: log aktivitas

```text
Langkah 1: halaman Log Aktivitas sesuai docs/mockup/log-aktivitas.png, PRD 4.9 dan 10.4.
Pastikan semua aksi pada FR-LOG-01 tercatat lewat satu helper logActivity(). Cari tempat yang belum memakainya dan perbaiki. Log tidak boleh memuat NIK penuh. Halaman hanya untuk Super Admin (kelola) dan Admin RW (lihat).
```

### Prompt 5.2: audit keamanan

Jalankan ini sebagai prompt tersendiri, tanpa izin mengubah kode.

```text
Lakukan audit keamanan terhadap seluruh kode. JANGAN mengubah apa pun dulu. Laporkan temuan menurut tingkat risiko:
1. Setiap Server Action dan Route Handler: apakah memakai requireRole, validasi Zod, dan scopeWhere?
2. Query prisma langsung ke warga, kartu_keluarga, atau pengajuan di luar lib/data/.
3. Tempat yang mencatat NIK, No KK, atau tanggal lahir ke log atau console, atau menaruhnya di URL.
4. IDOR: untuk setiap route dengan [id], bisakah pengguna membuka id milik RT atau KK lain?
5. Header keamanan, cookie sesi, perlindungan CSRF, dan noindex di halaman data.
6. Pembatasan percobaan di login, klaim akun, dan reset sandi.
7. Rahasia di repositori atau di kode yang dikirim ke browser.
Untuk tiap temuan tulis: berkas dan baris, skenario serangan, dan perbaikan yang disarankan. Tunggu persetujuan saya sebelum memperbaiki.
```

Setelah membaca laporannya, setujui perbaikan satu per satu dengan prompt "Perbaiki temuan nomor \[N\] saja, tulis tes yang gagal dulu, lalu perbaiki."

### Prompt 5.3: tes matriks hak akses

```text
Tulis tes otomatis dari matriks hak akses PRD bagian 2.2: untuk setiap peran dan setiap route atau aksi, tes mengharapkan izinkan atau tolak, termasuk cakupan data (RT A dibanding RT B, KK A dibanding KK B). Tes harus gagal jika ada route baru yang belum punya entri di matriks.
```

### Prompt 5.4: kondisi kosong, memuat, dan error

```text
Tambahkan kondisi kosong, memuat, dan error pada semua tabel dan halaman (belum digambar di mockup), halaman 403 dan 404 berbahasa Indonesia, dan pesan error server yang tidak membocorkan detail teknis.
```

### Prompt 5.5: aksesibilitas, responsif, dan E2E

```text
Periksa semua layar pada lebar 360 px dan 1366 px: tidak ada geser horizontal pada halaman (AC-10), target sentuh minimal 44 px, semua field punya label, kontras teks 4.5:1, urutan Tab masuk akal. Perbaiki temuan, lalu tulis tes E2E Playwright untuk tiga alur: (1) pengurus filter, Cari Warga, export; (2) warga klaim akun, RT setujui, warga ajukan perubahan, RT setujui; (3) admin impor Excel contoh. Jalankan di CI.
```

### Prompt 5.6: Super Admin pertama dan dokumentasi

```text
Buat scripts/buat-super-admin.ts yang menerima email dan membaca kata sandi lewat input interaktif; tidak menulis kata sandi ke berkas atau log; menolak berjalan jika Super Admin sudah ada.
Lengkapi README: menjalankan lokal, variabel lingkungan, cara deploy, membuat Super Admin pertama, backup dan pemulihan database, dan prosedur jika terjadi kebocoran data (siapa dihubungi dan langkah awal). Jangan menulis rahasia apa pun.
```

### Gerbang Fase 5

- [ ] AC-07: pembukaan NIK penuh dan export tercatat di log; NIK dimasking di semua tabel.
- [ ] AC-10: semua layar bisa dipakai di 360 px.
- [ ] Semua temuan audit berisiko tinggi dan sedang sudah diperbaiki dan diuji.
- [ ] Tes matriks hak akses dan tiga tes E2E hijau di CI.
- [ ] Kamu sudah membaca sendiri diff pull request terakhir, bukan hanya ringkasan dari AI.
- [ ] Lanjut ke bagian 10 (deploy produksi), lalu bagian 12 (checklist rilis).

## 10. Deploy ke Vercel

Proyek Vercel dan database sebaiknya dihubungkan sejak akhir Fase 1, supaya setiap pull request otomatis punya Preview. Produksi baru dinyalakan setelah gerbang Fase 5 lulus. Nama menu di Vercel dan Neon bisa berubah, jadi bila tampilannya berbeda, ikuti dokumentasi resmi keduanya.

### 10.1 Buat proyek Vercel dari repositori

1. Pastikan CI di branch `main` hijau.
2. Di Vercel pilih Add New, lalu Project, dan pilih repositori. Next.js terdeteksi otomatis sebagai framework.
3. Pada pengaturan Git, pastikan Production Branch adalah `main`. Setiap pull request akan membuat Preview.
4. Pada pengaturan Functions, pilih region yang dekat dengan database (Singapura jika Neon juga di Singapura).
5. Build pertama boleh gagal karena variabel lingkungan belum ada; itu wajar dan diperbaiki di langkah 10.2.

### 10.2 Hubungkan database dan variabel lingkungan

1. Buat database Neon di region Singapura, lewat Vercel Marketplace (tab Storage) atau langsung di Neon.
2. Pisahkan **dua database**: satu untuk Production, satu untuk Preview dan development. Jangan pernah mengarahkan Preview ke database produksi.
3. Ambil dua alamat koneksi per database: **pooled** (untuk aplikasi saat berjalan) dan **direct** (untuk migrasi).
4. Isi variabel di Vercel pada Project Settings, Environment Variables, dan pilih lingkungan yang tepat untuk tiap variabel.

| Variabel | Production | Preview | Catatan |
| --- | --- | --- | --- |
| Alamat koneksi pooled | Database produksi | Database preview | Dipakai aplikasi saat berjalan |
| Alamat koneksi direct | Database produksi | Database preview | Dipakai Prisma untuk migrasi |
| Kunci rahasia autentikasi | Nilai acak panjang, unik | Nilai acak lain | Buat dengan pembangkit acak; jangan dipakai ulang |
| URL aplikasi | Alamat produksi | Alamat Preview | Dipakai untuk tautan di email |
| Kunci API email | Kunci produksi | Kunci uji | Dari Resend |
| Alamat pengirim email | Alamat terverifikasi | Alamat uji | Harus sesuai domain di Resend |

Nama persis tiap variabel mengikuti `.env.example` yang dibuat Claude. Jangan menempelkan nilai rahasia ke chat atau ke repositori.

### 10.3 Siapkan kode untuk produksi

```text
Siapkan konfigurasi produksi untuk Vercel + Neon:
1. package.json: postinstall menjalankan prisma generate. Skrip build menjalankan prisma migrate deploy hanya jika variabel sistem VERCEL_ENV bernilai production, lalu next build. Preview tidak boleh menjalankan migrate ke database produksi.
2. schema.prisma: pakai alamat koneksi pooled untuk url dan alamat direct untuk directUrl, keduanya dari variabel lingkungan.
3. Pisahkan seed: db:seed:ref (wilayah, pendidikan, pekerjaan, kategori usia; aman untuk produksi) dan db:seed:dev (pengguna contoh dan data uji; menolak berjalan jika NODE_ENV=production).
4. Perbarui .env.example dan README bagian Deploy: daftar variabel dan fungsinya.
5. Tambahkan header keamanan dan robots noindex untuk semua halaman data.
Jangan menjalankan apa pun terhadap database produksi.
```

PRD bagian 9.2 menyebut migrasi lewat GitHub Actions. Untuk satu pengembang, menjalankannya di skrip build seperti di atas lebih sederhana dan urutannya terjamin. Pilih salah satu cara, jangan keduanya.

### 10.4 Migrasi, Super Admin, dan seed produksi

1. Gabungkan pull request terakhir ke `main`. Build Production menjalankan migrasi ke database produksi.
2. Jalankan seed referensi ke produksi dari komputermu: `db:seed:ref`, dengan alamat koneksi produksi hanya untuk sesi terminal itu (jangan menyimpannya di berkas).
3. Buat Super Admin pertama dengan `scripts/buat-super-admin.ts` dengan cara yang sama. Kata sandi diketik interaktif.
4. Verifikasi domain atau alamat pengirim di Resend, lalu uji kirim email verifikasi dari produksi.

### 10.5 Uji setelah deploy pertama

- [ ] Halaman terbuka lewat HTTPS dan login Super Admin berhasil.
- [ ] Email verifikasi dan reset kata sandi sampai ke inbox sungguhan.
- [ ] Tambah satu KK dan satu warga lewat form, lalu hapus (soft delete).
- [ ] Lihat sumber halaman data: ada `noindex`. Cek juga bahwa halaman data tidak bisa dibuka tanpa login.
- [ ] Aktifkan backup otomatis di Neon, lalu **uji pemulihan sekali** ke database lain.
- [ ] Cek Vercel Logs: tidak ada NIK, No KK, atau kata sandi di dalamnya.

### 10.6 Memasukkan data asli secara bertahap

1. Ambil backup database produksi (masih kosong) sebagai titik awal.
2. Impor file kecil (sekitar 50 baris) dari Excel asli lewat wizard, lalu periksa hasilnya di Data Warga dan Dashboard.
3. Impor file penuh. Perbaiki baris error di Excel, lalu impor ulang.
4. Buat akun Ketua RT dan Admin RW. Minta dua sampai tiga warga sebagai pilot untuk mencoba klaim akun dan pengajuan sebelum diumumkan ke semua warga.
5. Setelah pilot lancar, umumkan ke warga lewat RT. Sertakan penjelasan singkat tentang data apa yang dikumpulkan dan siapa yang bisa melihatnya.

### 10.7 Setelah rilis

- Pantau Vercel Logs dan penggunaan database setiap minggu pada bulan pertama.
- Tinjau Log Aktivitas: pembukaan NIK penuh dan export yang tidak wajar.
- Setiap perubahan baru tetap lewat siklus yang sama: rencana, implementasi kecil, tes, pull request, Preview, lalu merge.

## 11. Prompt utilitas

Prompt di bagian ini dipakai kapan saja di antara fase: saat ada bug, saat hasil AI meragukan, atau saat kamu membuka sesi baru.

### 11.1 Kerangka prompt yang baik

Prompt yang gagal biasanya terlalu besar atau tanpa cara memeriksa hasilnya. Pakai empat bagian ini untuk tugas apa pun di luar playbook:

```text
Konteks: [bagian PRD, nama layar mockup, atau berkas terkait]
Tugas: [satu hal saja]
Batasan: [apa yang tidak boleh diubah atau ditambah]
Selesai jika: [tes yang lulus atau perilaku yang bisa saya cek sendiri]
```

### 11.2 Debug

```text
Ada masalah: [apa yang terjadi]. Seharusnya: [apa yang diharapkan].
Langkah mengulang: [1, 2, 3].
Pesan error lengkap: [tempel; pastikan tidak memuat NIK, kata sandi, atau rahasia].
Perubahan terakhir: [commit atau pull request].
Cari akar masalah dulu. Tulis tes yang gagal untuk mereproduksinya, jelaskan penyebabnya dengan bukti dari kode, baru perbaiki dengan perubahan sekecil mungkin. Jangan mengubah hal lain.
```

### 11.3 Tinjau perubahan sebelum merge

```text
Tinjau perubahan di branch ini terhadap main. Jelaskan dengan bahasa sederhana: apa yang berubah, apa yang bisa rusak, dan apa yang belum dites. Periksa khusus: pelanggaran aturan di CLAUDE.md, query tanpa scopeWhere, input tanpa validasi, data sensitif di log, dan kode yang tidak saya minta. Akhiri dengan daftar tindakan.
```

### 11.4 Saat AI melenceng

Tanda-tandanya: mengubah banyak berkas yang tidak diminta, menambah library baru tanpa alasan, atau menyederhanakan aturan bisnis agar tes lulus. Hentikan dengan prompt ini:

```text
Berhenti. Jangan mengubah apa pun lagi. Kembali ke [bagian PRD atau langkah N]. Daftarkan perubahan yang kamu buat di luar permintaan, lalu usulkan cara mengembalikannya. Tunggu persetujuan saya.
```

Git adalah jaring pengamanmu: kerjakan tiap langkah di branch sendiri, commit setelah tiap hasil yang berfungsi, dan gunakan `git diff` serta `git restore` untuk membatalkan perubahan yang tidak diinginkan.

### 11.5 Membuka sesi baru

Claude tidak mengingat sesi sebelumnya. Mulai tiap sesi dengan:

```text
Sesi baru. Baca CLAUDE.md dan docs/PRD.md bagian [X]. Lihat git log 10 commit terakhir dan git status. Ringkas: apa yang sudah selesai, apa yang sedang dikerjakan, dan langkah berikutnya menurut Fase [N]. Jangan mengubah kode sebelum saya setuju.
```

### 11.6 Tes dulu, kode kemudian

```text
Tulis dulu tes untuk [ID aturan bisnis atau kriteria penerimaan PRD]. Jalankan dan tunjukkan bahwa tes itu gagal. Baru implementasikan sampai tes lulus.
```

### 11.7 Memahami kode yang ditulis AI

```text
Jelaskan berkas [path] seolah saya pemula: tujuannya, alur data dari input sampai database, dan bagian yang paling berisiko jika diubah.
```

### 11.8 Kebutuhan berubah

```text
Kebutuhan berubah: [jelaskan]. Sebelum mengubah kode, tunjukkan bagian PRD, layar mockup, skema, dan tes yang terdampak. Usulkan perubahan minimal, perbarui docs/PRD.md, lalu tunggu persetujuan saya.
```

### 11.9 Build di Vercel gagal

```text
Build di Vercel gagal. Log (data sensitif sudah dihapus): [tempel]. Jelaskan penyebabnya dan periksa kemungkinan umum: variabel lingkungan belum ada, prisma generate tidak berjalan, versi Node berbeda, galat tipe, atau kode server yang terimpor ke komponen klien. Usulkan perbaikan minimal dan cara memverifikasinya lokal dengan next build.
```

## 12. Checklist rilis dan kesalahan umum

### 12.1 Checklist sebelum mengumumkan ke warga

**Fungsi**

- [ ] Kesepuluh kriteria penerimaan di PRD bagian 12.2 (AC-01 sampai AC-10) lulus.
- [ ] Alur utama dicoba dari awal sampai akhir di HP sungguhan dan di desktop.

**Keamanan dan privasi**

- [ ] Audit keamanan (prompt 5.2) selesai dan tes matriks hak akses hijau.
- [ ] Tidak ada rahasia di repositori, di riwayat Git, atau di log Vercel.
- [ ] Preview dan Production memakai database dan kunci yang berbeda.
- [ ] Kebijakan privasi sudah ditulis dan disetujui pengurus; penanggung jawab data sudah ditunjuk.

**Data**

- [ ] Backup otomatis aktif dan pemulihan sudah diuji sekali.
- [ ] Data Excel asli sudah diimpor, dan baris error sudah dibereskan.
- [ ] Statistik dashboard dibandingkan dengan hitungan manual di Excel untuk satu filter yang kamu kenal.

**Operasional**

- [ ] Super Admin pertama dibuat, dan akun pengurus (Admin RW, Ketua RT) aktif.
- [ ] Email verifikasi dan notifikasi sampai ke inbox sungguhan.
- [ ] README dan prosedur insiden kebocoran data tersedia dan bisa diikuti orang lain.
- [ ] Pilot dengan dua sampai tiga warga selesai tanpa masalah besar.

### 12.2 Kesalahan umum dalam vibe coding

| Kesalahan | Akibat | Pencegahan |
| --- | --- | --- |
| Meminta seluruh sistem dalam satu prompt | Kode besar yang tidak terperiksa dan bug yang tersembunyi | Satu langkah per prompt, satu commit per hasil yang berfungsi |
| Menempelkan data warga asli ke chat | Pelanggaran privasi warga | Pakai data anonim; ceritakan pola masalahnya, bukan isi barisnya |
| Menerima hasil tanpa menjalankannya | Fitur tampak jadi tetapi rusak | Jalankan aplikasi dan tes, lalu bandingkan dengan mockup |
| Tes dilemahkan agar lulus | Bug lolos ke produksi | Baca diff tes; aturan bisnis tidak diubah tanpa perubahan di PRD |
| Cakupan data hanya disembunyikan di tampilan | Warga atau RT melihat data milik orang lain | `scopeWhere` di server dan tes matriks hak akses |
| Preview memakai database produksi | Data produksi rusak saat uji | Database terpisah per lingkungan |
| Rahasia masuk ke repositori atau prompt | Kebocoran akses | `.env*` di `.gitignore`, rahasia di Vercel; jika terlanjur bocor, ganti (rotasi) kuncinya segera |
| `CLAUDE.md` tidak diperbarui | Hasil tidak konsisten antar sesi | Perbarui setelah tiap fase |
| Menambah fitur sebelum gerbang lulus | Utang teknis menumpuk | Ikuti gerbang kelulusan tiap fase |
| Mengandalkan ingatan AI tentang library | API usang atau salah | Minta Claude membaca dokumentasi resmi versi yang terpasang dan menyebut versinya |
| NIK rusak saat impor atau export Excel | Digit hilang atau berubah jadi notasi ilmiah | Kolom bertipe teks dan tes dengan fixture |

Jika ragu di tengah jalan, kembali ke empat kebiasaan: minta rencana dulu, kerjakan langkah kecil, jalankan tes, dan baca diff sebelum menerima.
