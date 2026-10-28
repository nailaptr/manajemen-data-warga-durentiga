# PRD/SRS Sistem Pendataan Warga RT/RW

Oct 28, 2026 · @Krisna

## 1. Pendahuluan

Sistem ini mengganti pendataan warga di Excel dengan aplikasi web yang dipakai bersama oleh pengurus RT/RW dan warga, sehingga data kependudukan lokal tersimpan terpusat, tervalidasi, dan bisa dianalisis lewat statistik yang dapat difilter.

### 1.1 Latar belakang dan masalah

- Data warga tersebar di file Excel dengan banyak versi, tanpa validasi (NIK berubah menjadi notasi ilmiah, format tanggal campur, penulisan pendidikan/pekerjaan tidak seragam).
- Pembaruan data (kelahiran, pindah, ganti pekerjaan, lulus sekolah) bergantung pada pengurus yang mengetik ulang secara manual.
- Statistik untuk laporan, penyaluran bantuan, dan program kerja (misalnya jumlah perempuan usia 18–20 tahun, lulusan SMA, belum bekerja) harus dihitung manual.

### 1.2 Tujuan dan ukuran keberhasilan

Angka di bawah adalah target awal yang perlu disepakati dengan pengurus.

| Tujuan | Ukuran keberhasilan |
| --- | --- |
| Memindahkan data Excel tanpa input manual satu per satu | ≥ 95% baris Excel yang valid ter-import otomatis pada percobaan pertama setelah pemetaan kolom |
| Warga ikut menjaga data tetap terbaru | ≥ 50% KK memiliki minimal satu akun warga aktif dalam 3 bulan setelah peluncuran |
| Statistik dan pencarian cepat | Hasil filter tampil < 2 detik untuk 10.000 warga |
| Data lengkap dan benar | ≥ 90% warga memiliki pendidikan dan pekerjaan terisi; 0 NIK atau No KK ganda |
| Pengurus tidak kewalahan memverifikasi | Pengajuan perubahan warga diproses Ketua RT rata-rata < 3 hari |

### 1.3 Ruang lingkup

**Termasuk (versi 1):**

- Login dan manajemen pengguna dengan empat peran: Super Admin, Admin RW, Ketua RT, Warga.
- Pendataan Kartu Keluarga dan warga (CRUD, relasi 1 KK : N warga).
- Portal warga: lihat data KK sendiri, ajukan perubahan data, tambah anggota keluarga baru.
- Alur verifikasi dan persetujuan oleh Ketua RT.
- Dashboard statistik dengan filter dan fitur Cari Warga (hasil detail + export).
- Import data dari file Excel yang sudah ada.
- Log aktivitas dan masking data sensitif.

**Tidak termasuk (versi 1):**

- Layanan surat-menyurat (surat pengantar, domisili), iuran, dan agenda kegiatan.
- Integrasi langsung dengan Dukcapil atau sistem pemerintah lain.
- Aplikasi mobile native (cukup web responsif, bisa dipasang sebagai PWA).
- Notifikasi WhatsApp/SMS (email saja pada versi 1).

### 1.4 Asumsi

- Satu instalasi melayani satu RW yang terdiri dari beberapa RT. Model data tetap menyimpan RW dan RT sebagai atribut KK sehingga bisa dikembangkan ke beberapa RW.
- Warga yang memakai portal adalah kepala keluarga atau anggota dewasa (usia ≥ 17 tahun) yang punya email atau nomor HP aktif.
- Data yang sudah ada di Excel memuat minimal NIK, No KK, dan nama.

### 1.5 Istilah

| Istilah | Arti |
| --- | --- |
| KK | Kartu Keluarga, 16 digit, satu KK berisi satu keluarga |
| NIK | Nomor Induk Kependudukan, 16 digit, unik per orang |
| Klaim akun | Proses warga menghubungkan akun login dengan data warga miliknya |
| Pengajuan perubahan | Usulan warga untuk mengubah atau menambah data, menunggu persetujuan Ketua RT |
| Status kependudukan | Aktif, Pindah, atau Meninggal; hanya warga Aktif yang dihitung dalam statistik |

## 2. Pengguna dan peran

Sistem punya empat peran. Yang membedakan bukan hanya menu yang terlihat, tetapi **cakupan data** yang boleh diakses: seluruh RW, satu RT, atau satu KK.

### 2.1 Persona

| Peran | Contoh pengguna | Kebutuhan utama | Kekhawatiran |
| --- | --- | --- | --- |
| Super Admin | Pengembang atau ketua pengurus RW | Menyiapkan sistem, mengelola akun, memantau log | Data bocor atau salah kelola |
| Admin RW | Sekretaris RW | Import data Excel, melihat statistik seluruh RW, menyusun laporan | Data antar-RT tidak seragam |
| Ketua RT | Ketua atau sekretaris RT | Mengelola warga RT-nya, menyetujui pengajuan warga, mencari warga menurut kriteria | Terlalu banyak pekerjaan verifikasi; data warga lain RT terlihat |
| Warga | Kepala keluarga atau anggota dewasa | Memastikan data keluarga benar, memperbarui sendiri tanpa datang ke pengurus | Data pribadi disalahgunakan; aplikasi sulit dipakai di HP |

### 2.2 Matriks hak akses

| Kemampuan | Super Admin | Admin RW | Ketua RT | Warga |
| --- | --- | --- | --- | --- |
| Dashboard statistik dan filter | Semua | Seluruh RW | RT sendiri | Tidak (hanya ringkasan KK sendiri) |
| Cari Warga (daftar detail) | Semua | Seluruh RW | RT sendiri | Tidak |
| Export hasil ke Excel/CSV | Ya | Ya | RT sendiri | Tidak |
| Lihat data KK dan warga | Semua | Seluruh RW | RT sendiri | KK sendiri |
| Lihat NIK/No KK lengkap | Ya | Ya | Ya, tercatat di log | Hanya milik KK sendiri |
| Tambah, ubah, hapus KK dan warga langsung | Ya | Ya | RT sendiri | Tidak |
| Ajukan perubahan atau tambah anggota | Tidak perlu | Tidak perlu | Tidak perlu | Ya, KK sendiri |
| Setujui atau tolak pengajuan | Ya | Ya | RT sendiri | Tidak |
| Import Excel | Ya | Ya | Tidak | Tidak |
| Setujui klaim akun warga | Ya | Ya | RT sendiri | Tidak |
| Kelola akun pengurus (Admin RW, Ketua RT) | Ya | Ketua RT saja | Tidak | Tidak |
| Master data dan kategori usia | Ya | Ya | Tidak | Tidak |
| Log aktivitas | Kelola | Lihat | Tidak | Tidak |

### 2.3 Prinsip cakupan data

- Cakupan ditegakkan di **server** pada setiap query, bukan hanya disembunyikan di tampilan. Akun Ketua RT menyimpan `rt_id`, Admin RW menyimpan `rw`, dan akun Warga menyimpan `warga_id`.
- Warga yang akunnya sudah terklaim bisa melihat dan mengajukan perubahan untuk **semua anggota di KK yang sama**, tidak untuk KK lain.
- Warga tidak punya akses ke statistik detail. Angka kecil (misalnya 4 orang dengan kriteria tertentu) dapat mengungkap identitas seseorang.

## 3. Alur pengguna dan user stories

Dua alur menentukan desain sistem: warga **mengklaim akun** supaya terhubung dengan datanya, dan warga **mengajukan perubahan** yang harus disetujui Ketua RT sebelum data resmi berubah.

### 3.1 Klaim akun warga (onboarding)

1. Warga membuka halaman daftar dan mengisi email atau nomor HP, kata sandi, serta data verifikasi: NIK, No KK, dan tanggal lahir.
2. Sistem mencocokkan ketiganya dengan data warga. Jika tidak cocok, pesan error dibuat umum (tidak menyebut data mana yang salah) dan percobaan dibatasi 5 kali per jam.
3. Jika cocok, akun berstatus **Menunggu verifikasi** dan Ketua RT menerima antrean klaim.
4. Ketua RT memastikan orangnya benar-benar warga RT tersebut, lalu menyetujui atau menolak.
5. Setelah disetujui, akun aktif dan warga bisa masuk ke portal.

Satu data warga hanya bisa diklaim oleh satu akun.

### 3.2 User stories

| ID | Sebagai | Saya ingin | Agar | Prioritas |
| --- | --- | --- | --- | --- |
| US-01 | Warga | mendaftar dan menghubungkan akun ke data saya dengan NIK, No KK, dan tanggal lahir | tidak perlu mengisi data dari nol | Must |
| US-02 | Warga | melihat data KK dan semua anggota keluarga saya | tahu data apa yang tercatat | Must |
| US-03 | Warga | mengajukan perubahan data anggota keluarga (pekerjaan, pendidikan, status kawin) | data saya selalu terbaru tanpa datang ke pengurus | Must |
| US-04 | Warga | mengajukan penambahan anggota (kelahiran) atau pelaporan pindah/meninggal | perubahan keluarga tercatat | Must |
| US-05 | Warga | melihat status pengajuan (menunggu, disetujui, ditolak + alasan) | tahu perkembangannya | Should |
| US-06 | Ketua RT | menyetujui atau menolak pengajuan dengan alasan | hanya data yang benar yang masuk | Must |
| US-07 | Ketua RT | menambah atau mengubah data warga RT saya langsung | warga yang tidak memakai aplikasi tetap terdata | Must |
| US-08 | Ketua RT | memfilter statistik RT saya dan melihat daftar warganya | menentukan sasaran program (misal perempuan 18–20 th, lulusan SMA, belum bekerja) | Must |
| US-09 | Admin RW | meng-import file Excel yang sudah ada | tidak input manual satu per satu | Must |
| US-10 | Admin RW | melihat statistik seluruh RW dan mengekspor hasil filter | menyusun laporan | Must |
| US-11 | Admin RW | membuat dan menonaktifkan akun Ketua RT | pergantian pengurus tertangani | Should |
| US-12 | Super Admin | melihat log siapa mengubah, melihat, dan mengekspor data | bisa menelusuri penyalahgunaan | Should |

### 3.3 Alur pengajuan perubahan data

&#91;embedded content: alur pengajuan perubahan · 3 pelaku, 1 keputusan\]

Warga hanya mengusulkan. Sistem menyimpan nilai lama dan baru, Ketua RT memutuskan, dan hanya persetujuan yang mengubah data resmi dan masuk ke log. Penolakan wajib disertai alasan yang dikirim ke warga.

## 4. Kebutuhan fungsional

Sistem terbagi menjadi sembilan modul. Prioritas memakai MoSCoW: **Must** wajib ada di rilis pertama, **Should** penting tetapi boleh menyusul, **Could** opsional.

### 4.1 Autentikasi dan akun (AUTH)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-AUTH-01 | Login dengan email atau nomor HP dan kata sandi | Must |
| FR-AUTH-02 | Registrasi warga dengan klaim akun (bagian 3.1) | Must |
| FR-AUTH-03 | Verifikasi email dan reset kata sandi lewat tautan | Must |
| FR-AUTH-04 | Sesi berakhir setelah 30 menit tidak aktif; akun terkunci 15 menit setelah 5 kali gagal login | Must |
| FR-AUTH-05 | Autentikasi dua langkah untuk Super Admin dan Admin RW | Could |

### 4.2 Data Kartu Keluarga (KK)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-KK-01 | Tabel KK: No KK, kepala keluarga, alamat, RT/RW, jumlah anggota, aksi; pencarian, filter RT/RW, pagination di server | Must |
| FR-KK-02 | Tambah KK lewat halaman penuh: data KK dan daftar anggota (repeater), disimpan dalam satu transaksi | Must |
| FR-KK-03 | Halaman detail KK: info KK, tabel anggota, tombol Tambah Anggota | Must |
| FR-KK-04 | Ubah KK; hapus KK bersifat *soft delete* dan diblokir selama masih ada anggota aktif | Must |
| FR-KK-05 | Pindah warga ke KK lain (misal karena menikah) dengan riwayat | Should |
| FR-KK-06 | Cetak ringkasan KK ke PDF | Could |

### 4.3 Data Warga (WRG)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-WRG-01 | Tabel ringkasan warga dengan pencarian (nama, NIK, No KK), filter cepat, dan pagination di server | Must |
| FR-WRG-02 | Tombol Tambah Warga membuka modal form; warga wajib dipilihkan KK | Must |
| FR-WRG-03 | Lihat detail (drawer), ubah, dan hapus (soft delete dengan konfirmasi) | Must |
| FR-WRG-04 | Ubah status kependudukan (Aktif, Pindah, Meninggal) beserta tanggal kejadian | Must |
| FR-WRG-05 | Validasi: NIK 16 digit dan unik, tanggal lahir tidak di masa depan, satu KK hanya punya satu kepala keluarga | Must |
| FR-WRG-06 | NIK dan No KK dimasking di tabel; tampil penuh hanya di detail untuk yang berhak | Must |

### 4.4 Pengajuan perubahan (PGJ)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-PGJ-01 | Warga membuat pengajuan: ubah data anggota, tambah anggota, lapor pindah atau meninggal | Must |
| FR-PGJ-02 | Pengajuan menyimpan nilai lama dan nilai baru per field sehingga RT melihat perbedaannya | Must |
| FR-PGJ-03 | Ketua RT melihat antrean pengajuan RT-nya, lalu menyetujui atau menolak; alasan wajib saat menolak | Must |
| FR-PGJ-04 | Persetujuan menerapkan perubahan ke data utama dalam satu transaksi dan tercatat di log | Must |
| FR-PGJ-05 | Warga dapat membatalkan pengajuan yang belum diproses dan melihat statusnya | Should |
| FR-PGJ-06 | Notifikasi email ke Ketua RT saat ada pengajuan baru dan ke warga saat statusnya berubah | Should |
| FR-PGJ-07 | Lampiran bukti (foto KK/KTP) untuk perubahan NIK, nama, atau tanggal lahir | Could |

### 4.5 Dashboard statistik (DSB)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-DSB-01 | Kartu ringkasan: total warga aktif, total KK, laki-laki, perempuan, rata-rata anggota per KK | Must |
| FR-DSB-02 | Filter: pendidikan terakhir, pekerjaan, jenis kelamin, kategori usia (batita, balita, remaja, dewasa, usia subur, lansia), rentang usia manual, dan RT | Must |
| FR-DSB-03 | Grafik mengikuti filter: donut jenis kelamin, bar pendidikan, bar pekerjaan (10 teratas + Lainnya), piramida penduduk, sebaran per RT | Must |
| FR-DSB-04 | Panel Hasil Filter: jumlah warga, ringkasan filter aktif, pratinjau beberapa nama, tombol Lihat Detail ke Cari Warga dengan filter yang sama | Must |
| FR-DSB-05 | Filter tersimpan di URL query agar bisa dibagikan dan tombol back berfungsi | Must |
| FR-DSB-06 | Ketua RT otomatis terkunci pada RT-nya | Must |
| FR-DSB-07 | Kartu kualitas data (misal "12 warga belum ada pekerjaan", "3 KK tanpa kepala keluarga") | Should |

### 4.6 Cari Warga (CRW)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-CRW-01 | Halaman tersendiri yang memakai komponen filter yang sama dengan dashboard | Must |
| FR-CRW-02 | Chip filter aktif yang bisa dihapus satu per satu, teks jumlah ("4 warga ditemukan") | Must |
| FR-CRW-03 | Tabel hasil: nama, NIK (masking), JK, usia, pendidikan, pekerjaan, No KK, RT/RW | Must |
| FR-CRW-04 | Klik baris membuka drawer detail warga dengan tautan ke KK-nya | Must |
| FR-CRW-05 | Export hasil filter ke Excel/CSV, tercatat di log | Must |
| FR-CRW-06 | Angka di dashboard dan daftar di Cari Warga berasal dari satu query yang sama sehingga selalu konsisten | Must |

### 4.7 Import Excel (IMP)

Rincian ada di bagian 7.

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-IMP-01 | Wizard 4 langkah: upload, mapping kolom, preview dan validasi, eksekusi dan laporan | Must |
| FR-IMP-02 | Template Excel yang bisa diunduh | Must |
| FR-IMP-03 | Pengelompokan baris per No KK: KK dibuat jika belum ada, warga ditambahkan ke KK tersebut | Must |
| FR-IMP-04 | Opsi duplikat NIK: lewati atau perbarui | Must |
| FR-IMP-05 | Simpan mapping untuk import berikutnya dan unduh file baris yang gagal | Should |

### 4.8 Pengguna dan master data (USR, MST)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-USR-01 | Daftar pengguna: tambah, ubah peran dan RT, nonaktifkan, reset kata sandi | Must |
| FR-USR-02 | Antrean klaim akun warga: setujui atau tolak, sesuai cakupan RT | Must |
| FR-MST-01 | Kelola referensi pendidikan (urutan, alias) dan pekerjaan (alias) | Must |
| FR-MST-02 | Kelola kategori usia (nama, usia min, usia maks, jenis kelamin opsional) tanpa deploy ulang | Must |
| FR-MST-03 | Kelola daftar RT dan RW | Should |

### 4.9 Log aktivitas (LOG)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-LOG-01 | Catat login, melihat NIK penuh, tambah, ubah, hapus, export, import, persetujuan dan penolakan | Must |
| FR-LOG-02 | Filter log menurut pengguna, aksi, dan tanggal | Should |

## 5. Halaman, navigasi, dan form

Ada 20 halaman yang terbagi dalam tiga area: publik (belum login), area pengurus (Super Admin, Admin RW, Ketua RT), dan portal warga.

### 5.1 Daftar halaman

| Area | Halaman | Route | Peran |
| --- | --- | --- | --- |
| Publik | Masuk | `/masuk` | Semua |
| Publik | Daftar akun warga (klaim akun) | `/daftar` | Warga |
| Publik | Lupa dan reset kata sandi | `/lupa-sandi` | Semua |
| Pengurus | Dashboard statistik + filter | `/dashboard` | Pengurus |
| Pengurus | Cari Warga | `/cari-warga` | Pengurus |
| Pengurus | Data Warga (tabel + modal form) | `/warga` | Pengurus |
| Pengurus | Data KK | `/kk` | Pengurus |
| Pengurus | Form KK (tambah dan ubah) | `/kk/baru`, `/kk/[id]/ubah` | Pengurus |
| Pengurus | Detail KK + anggota | `/kk/[id]` | Pengurus |
| Pengurus | Antrean pengajuan perubahan | `/pengajuan` | Pengurus |
| Pengurus | Antrean klaim akun warga | `/pengguna/klaim` | Pengurus |
| Pengurus | Import Excel (wizard) | `/import` | Admin RW, Super Admin |
| Pengurus | Manajemen pengguna | `/pengguna` | Admin RW, Super Admin |
| Pengurus | Master data (pendidikan, pekerjaan, RT/RW) | `/pengaturan/master` | Admin RW, Super Admin |
| Pengurus | Kategori usia | `/pengaturan/kategori-usia` | Admin RW, Super Admin |
| Pengurus | Log aktivitas | `/log` | Super Admin, Admin RW (lihat) |
| Warga | Beranda (ringkasan KK sendiri) | `/beranda` | Warga |
| Warga | Keluarga saya (anggota KK) | `/keluarga` | Warga |
| Warga | Pengajuan saya + buat pengajuan | `/pengajuan-saya`, `/pengajuan-saya/baru` | Warga |
| Semua | Profil dan ganti kata sandi | `/profil` | Semua |

### 5.2 Menu sidebar per peran

Sidebar gelap di kiri, dikelompokkan seperti referensi desain Portal Admin SDGs UNJ.

| Peran | Menu |
| --- | --- |
| Super Admin dan Admin RW | **Dashboard:** Dashboard, Cari Warga · **Data:** Data Warga, Data KK, Pengajuan · **Admin:** Import, Pengguna, Pengaturan, Log |
| Ketua RT | **Dashboard:** Dashboard, Cari Warga · **Data:** Data Warga, Data KK, Pengajuan, Klaim Akun |
| Warga | Beranda, Keluarga Saya, Pengajuan Saya, Profil (navigasi bawah di HP) |

### 5.3 Form Warga (modal, dari halaman Data Warga)

| Grup | Field | Tipe | Wajib | Aturan |
| --- | --- | --- | --- | --- |
| Kartu Keluarga | KK | Combobox pencarian | Ya | Cari No KK atau nama kepala; ada tautan "+ Buat KK baru" |
| Kartu Keluarga | Hubungan dalam keluarga | Dropdown | Ya | Kepala Keluarga, Istri, Suami, Anak, Menantu, Cucu, Orang Tua, Mertua, Famili Lain, Lainnya; maksimal satu Kepala Keluarga per KK |
| Identitas | NIK | Teks angka | Ya | Tepat 16 digit, unik |
| Identitas | Nama lengkap | Teks | Ya | Maks 100 karakter, spasi berlebih dipangkas |
| Identitas | Jenis kelamin | Radio | Ya | Laki-laki / Perempuan |
| Identitas | Tempat lahir | Teks | Ya |  |
| Identitas | Tanggal lahir | Date picker | Ya | Tidak boleh di masa depan |
| Data diri | Agama | Dropdown | Ya | Islam, Kristen, Katolik, Hindu, Buddha, Konghucu, Lainnya |
| Data diri | Pendidikan terakhir | Dropdown | Ya | Dari master: Tidak/Belum Sekolah, SD, SMP, SMA, D1–D3, D4/S1, S2, S3 |
| Data diri | Pekerjaan | Dropdown | Ya | Dari master, termasuk Belum/Tidak Bekerja, Pelajar/Mahasiswa, Ibu Rumah Tangga |
| Data diri | Golongan darah | Dropdown | Tidak | A, B, AB, O, Tidak Tahu |
| Tambahan | Status perkawinan | Dropdown | Tidak | Belum Kawin, Kawin, Cerai Hidup, Cerai Mati |
| Tambahan | Status kependudukan | Dropdown | Ya | Aktif (default), Pindah, Meninggal; hanya bisa diubah pengurus |

### 5.4 Form KK (halaman penuh)

Polanya sama dengan form "Tulis Berita" pada referensi: satu card per bagian, tombol putus-putus untuk menambah baris, tombol Batal dan Simpan di bawah.

| Bagian | Field | Wajib | Aturan |
| --- | --- | --- | --- |
| Data Kartu Keluarga | No KK | Ya | 16 digit, unik |
| Data Kartu Keluarga | Alamat lengkap | Ya |  |
| Data Kartu Keluarga | RT, RW | Ya | Dari master RT/RW |
| Data Kartu Keluarga | Desa/Kelurahan, Kecamatan, Kab/Kota, Provinsi, Kode pos | Tidak | Terisi default sesuai wilayah RW |
| Anggota Keluarga | Baris pertama otomatis Kepala Keluarga | Ya | Berisi field identitas dan data diri seperti form Warga |
| Anggota Keluarga | Tombol "+ Tambah Anggota" | Tidak | Tidak ada batas jumlah anggota |

Simpan bersifat atomik: jika satu anggota gagal validasi, KK dan anggota lain tidak tersimpan.

### 5.5 Form lain

| Form | Field | Aturan |
| --- | --- | --- |
| Daftar akun warga | Nama, email atau nomor HP, kata sandi (min 10 karakter), NIK, No KK, tanggal lahir, persetujuan kebijakan privasi | Verifikasi tiga data identitas sesuai bagian 3.1; pesan error generik |
| Pengajuan perubahan | Jenis pengajuan, warga yang diubah, field dan nilai baru (nilai lama tampil read-only), catatan, lampiran (Could) | Minimal satu field berubah; tidak boleh mengajukan untuk KK lain |
| Tolak pengajuan | Alasan penolakan | Wajib, min 10 karakter |
| Pengguna | Nama, email, peran, RT atau RW cakupan, status aktif | Ketua RT wajib punya RT; email unik |
| Kategori usia | Nama, usia min, usia maks, jenis kelamin (opsional), urutan | Min ≤ maks |
| Import Excel | File .xlsx atau .csv, pilihan duplikat (lewati atau perbarui) | Maks 5 MB, 5.000 baris per file |

### 5.6 Prinsip UX

- Validasi inline dengan pesan Bahasa Indonesia; tanda bintang merah untuk field wajib.
- Konfirmasi sebelum hapus; data tidak benar-benar hilang (soft delete).
- Tabel besar memakai pagination dan filter di server.
- Portal warga dirancang mobile-first (kebanyakan warga membuka dari HP); area pengurus dioptimalkan untuk desktop tetapi tetap bisa dipakai di tablet.
- Ukuran huruf dasar 16 px dan kontras tinggi agar mudah dibaca warga lanjut usia.

## 6. Aturan bisnis dan logika filter

Semua filter statistik memakai satu aturan: **AND antar filter, OR di dalam satu filter multi-pilih**. Aturan ini dipakai sama persis oleh Dashboard dan Cari Warga.

### 6.1 Aturan bisnis

| ID | Aturan |
| --- | --- |
| BR-01 | Setiap warga wajib berada tepat di satu KK. Sistem menolak warga tanpa KK. |
| BR-02 | Satu KK boleh memiliki banyak warga, tetapi hanya satu Kepala Keluarga aktif. |
| BR-03 | NIK dan No KK harus 16 digit, unik, dan disimpan sebagai teks (bukan angka) agar nol di depan tidak hilang. |
| BR-04 | Usia tidak disimpan; dihitung dari tanggal lahir setiap kali query dijalankan. |
| BR-05 | Statistik dan Cari Warga hanya menghitung warga berstatus Aktif, kecuali pengurus memilih menampilkan semua status. |
| BR-06 | Jika Kepala Keluarga berstatus Pindah atau Meninggal, KK tersebut ditandai "tanpa kepala keluarga" di kartu kualitas data sampai ditunjuk pengganti. |
| BR-07 | Pengajuan warga tidak mengubah data resmi sampai disetujui pengurus. |
| BR-08 | Pengajuan hanya diproses sekali. Jika data warga sudah berubah sejak pengajuan dibuat, pengurus melihat peringatan konflik sebelum menyetujui. |
| BR-09 | Penghapusan KK atau warga adalah soft delete dan bisa dipulihkan Super Admin. |
| BR-10 | Digit ke-7 sampai ke-12 NIK memuat tanggal lahir (tanggal + 40 untuk perempuan). Jika tidak cocok dengan tanggal lahir yang diinput, tampilkan **peringatan** (bukan blokir). |

### 6.2 Kategori usia

Kategori disimpan di tabel sehingga rentangnya bisa diubah tanpa deploy ulang. Kategori boleh tumpang tindih (usia subur beririsan dengan remaja dan dewasa), maka filternya multi-pilih. Nilai awal berikut hanya usulan dan perlu disepakati dengan pengurus:

| Kategori | Rentang usia (tahun) | Jenis kelamin |
| --- | --- | --- |
| Batita | 0–3 | Semua |
| Balita | 0–5 | Semua |
| Anak | 6–11 | Semua |
| Remaja | 12–17 | Semua |
| Dewasa | 18–59 | Semua |
| Usia subur | 15–49 | Perempuan |
| Lansia | ≥ 60 | Semua |

Rentang usia manual (min–maks) bisa dipakai bersamaan dengan kategori untuk mempersempit hasil, seperti pada contoh "Dewasa, 18–20 tahun".

### 6.3 Contoh kasus dan query

Filter: pendidikan SMA, pekerjaan Belum Bekerja, jenis kelamin Perempuan, kategori Dewasa, rentang usia 18–20. Sistem menjalankan satu query yang sama untuk angka (misal 4 warga) dan untuk daftar detail beserta namanya. Untuk Ketua RT, ditambahkan `AND k.rt = :rt_akun`.

```sql
SELECT w.id, w.nama_lengkap, w.nik, k.no_kk, k.rt, k.rw
FROM warga w
JOIN kartu_keluarga k ON k.id = w.kartu_keluarga_id
WHERE w.deleted_at IS NULL
  AND w.status_kependudukan = 'AKTIF'
  AND w.pendidikan_id = :sma
  AND w.pekerjaan_id = :belum_bekerja
  AND w.jenis_kelamin = 'P'
  AND date_part('year', age(CURRENT_DATE, w.tanggal_lahir)) BETWEEN 18 AND 59 -- kategori Dewasa
  AND date_part('year', age(CURRENT_DATE, w.tanggal_lahir)) BETWEEN 18 AND 20 -- rentang manual
```

Angka dihitung dengan `COUNT(*)` pada kondisi yang sama.

## 7. Spesifikasi import Excel

Import memungkinkan data Excel yang sudah ada masuk ke sistem tanpa input manual. Satu baris Excel mewakili satu warga, dan sistem mengelompokkan baris menurut No KK.

### 7.1 Alur wizard

1. **Upload.** Admin mengunggah file `.xlsx` atau `.csv` (maks 5 MB, 5.000 baris) dan bisa mengunduh template.
2. **Mapping kolom.** Header terdeteksi otomatis dan dicocokkan ke field sistem; admin bisa mengubah manual. Mapping dapat disimpan untuk import berikutnya.
3. **Preview dan validasi.** Tab *Valid*, *Peringatan*, dan *Error* menampilkan jumlah dan alasan per baris (contoh: "Baris 14: NIK bukan 16 digit"). Admin memilih tindakan untuk NIK yang sudah ada: **lewati** atau **perbarui**.
4. **Eksekusi dan laporan.** Progress bar per batch, lalu ringkasan "480 berhasil, 12 dilewati, 3 gagal" dan unduhan file berisi baris yang gagal beserta alasannya.

### 7.2 Kolom template

Kolom wajib hanya yang diperlukan untuk membentuk KK dan identitas warga. Kolom lain boleh kosong saat import supaya data lama tetap masuk; baris yang belum lengkap masuk ke kartu kualitas data di dashboard.

| Kolom Excel | Field sistem | Wajib saat import | Catatan |
| --- | --- | --- | --- |
| No KK | `kartu_keluarga.no_kk` | Ya | Teks 16 digit |
| NIK | `warga.nik` | Ya | Teks 16 digit |
| Nama lengkap | `warga.nama_lengkap` | Ya |  |
| Jenis kelamin | `warga.jenis_kelamin` | Ya | L/P, "Laki-laki", "Perempuan" |
| Tanggal lahir | `warga.tanggal_lahir` | Ya | Beberapa format diterima |
| Hubungan keluarga | `warga.hubungan_keluarga` | Ya\* | \*Jika kolom tidak ada, admin bisa memilih "anggota pertama tiap No KK = Kepala Keluarga" dan memeriksanya di preview |
| Tempat lahir | `warga.tempat_lahir` | Tidak |  |
| Agama | `warga.agama` | Tidak |  |
| Pendidikan | `warga.pendidikan_id` | Tidak | Dipetakan lewat alias |
| Pekerjaan | `warga.pekerjaan_id` | Tidak | Dipetakan lewat alias |
| Golongan darah | `warga.golongan_darah` | Tidak |  |
| Status perkawinan | `warga.status_perkawinan` | Tidak |  |
| Alamat, RT, RW | `kartu_keluarga.*` | RT dan RW: Ya | Alamat diambil dari baris pertama tiap No KK |
| Desa, Kecamatan, Kab/Kota, Provinsi, Kode pos | `kartu_keluarga.*` | Tidak | Default wilayah dipakai jika kosong |

Nama kolom di Excel milik pengurus bisa berbeda. Wizard mapping menjembatani perbedaan itu, jadi file tidak perlu diubah dulu.

### 7.3 Masalah umum data Excel dan penanganannya

| Masalah | Penanganan |
| --- | --- |
| NIK atau No KK berubah menjadi notasi ilmiah (`3.17E+15`) dan digit akhirnya hilang | Dibaca sebagai teks. Jika terdeteksi bentuk angka ilmiah, baris ditandai **Error** karena digit yang hilang tidak bisa dipulihkan; admin memperbaiki di Excel (format kolom Teks) |
| Nol di depan hilang | NIK, No KK, RT, RW selalu diproses sebagai string; RT/RW dinormalisasi menjadi 3 digit |
| Format tanggal campur (serial Excel, `dd/mm/yyyy`, `yyyy-mm-dd`) | Semua dinormalisasi ke tanggal; yang tidak terbaca menjadi Error |
| Penulisan tidak seragam ("SMA", "SMA/Sederajat", "sma", "S1", "Sarjana") | Dicocokkan lewat tabel alias di master data; nilai yang tak dikenali ditampilkan di preview agar dipetakan manual sekali untuk semua baris |
| Spasi berlebih dan baris kosong | Dipangkas otomatis |
| Jenis kelamin ditulis bermacam-macam ("L", "Pria", "Laki laki") | Dinormalisasi ke L atau P |

### 7.4 Error dan peringatan

| Level | Kondisi | Tindakan sistem |
| --- | --- | --- |
| Error | NIK atau No KK bukan 16 digit; nama kosong; tanggal lahir tidak terbaca atau di masa depan; jenis kelamin tak dikenali; NIK ganda di dalam file; lebih dari satu Kepala Keluarga dalam satu No KK | Baris tidak diimpor, masuk laporan |
| Peringatan | NIK tidak cocok dengan tanggal lahir; pendidikan atau pekerjaan tidak dikenali atau kosong; KK tanpa Kepala Keluarga; RT/RW belum ada di master | Baris tetap diimpor dan ditandai untuk ditinjau |

### 7.5 Ketentuan teknis

- **File diparse di browser**, lalu dikirim ke server per batch 200 baris. Ini menghindari batas ukuran request dan durasi function di Vercel (sekitar 4,5 MB per request), dan membuat Redis atau queue tidak diperlukan.
- Setiap batch berjalan dalam satu transaksi dengan `upsert` berdasarkan NIK. Mengimpor file yang sama dua kali tidak menggandakan data.
- KK dibuat jika No KK belum ada; jika sudah ada, warga ditambahkan ke KK tersebut.
- Setiap import dicatat di tabel `import_batches` (file, pemetaan, jumlah berhasil/gagal, daftar error) dan di log aktivitas.
- File Excel tidak disimpan di server, hanya hasil parsing yang dikirim. Ini mengurangi risiko kebocoran data.

## 8. Model data

Database PostgreSQL memakai 10 tabel aplikasi (ditambah tabel sesi bawaan library autentikasi). Inti modelnya: satu KK memiliki banyak warga, dan warga wajib memiliki KK karena `kartu_keluarga_id` bersifat NOT NULL.

&#91;embedded content: ERD · 9 tabel dan kunci asingnya\]

Satu KK dirujuk banyak warga, dan satu data warga hanya bisa dihubungkan ke satu akun. Tabel `kategori_usia` berdiri sendiri karena hanya dibaca saat query filter usia, jadi tidak digambar.

### 8.1 Tabel inti

**`kartu_keluarga`**

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | uuid, PK |  |
| no\_kk | char(16) | unique |
| alamat | text |  |
| wilayah\_id | FK `wilayah` | RT dan RW; di-index |
| desa\_kelurahan, kecamatan, kabupaten\_kota, provinsi | varchar | default wilayah |
| kode\_pos | varchar(5) | nullable |
| created\_by | FK `users` |  |
| created\_at, updated\_at, deleted\_at | timestamptz | soft delete |

**`warga`**

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | uuid, PK |  |
| kartu\_keluarga\_id | FK, NOT NULL | menjamin setiap warga punya KK |
| nik | char(16) | unique |
| nama\_lengkap | varchar(100) |  |
| jenis\_kelamin | enum (L, P) | di-index |
| tempat\_lahir | varchar |  |
| tanggal\_lahir | date | di-index (dasar hitung usia) |
| agama | enum | nullable agar data Excel lama bisa masuk; form tetap mewajibkan |
| pendidikan\_id | FK `ref_pendidikan` | nullable (alasan sama); di-index |
| pekerjaan\_id | FK `ref_pekerjaan` | nullable (alasan sama); di-index |
| golongan\_darah | enum (A, B, AB, O, TIDAK\_TAHU) | nullable |
| hubungan\_keluarga | enum | Kepala Keluarga, Istri, Suami, Anak, dan seterusnya |
| status\_perkawinan | enum | nullable |
| status\_kependudukan | enum (AKTIF, PINDAH, MENINGGAL) | default AKTIF |
| tanggal\_status | date | nullable, tanggal pindah atau meninggal |
| created\_at, updated\_at, deleted\_at | timestamptz | soft delete |

**`wilayah`**: id, rw, rt, keterangan; unique (rw, rt). Dipakai sebagai cakupan data Ketua RT dan Admin RW.

**`ref_pendidikan`**: id, nama, urutan (agar grafik terurut SD ke S3), alias (jsonb).

**`ref_pekerjaan`**: id, nama, alias (jsonb).

**`kategori_usia`**: id, nama, usia\_min, usia\_maks (nullable untuk lansia), jenis\_kelamin (nullable), urutan.

**`users`**

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | uuid, PK |  |
| nama, email (unique), no\_hp, password\_hash |  |  |
| role | enum (SUPER\_ADMIN, ADMIN\_RW, KETUA\_RT, WARGA) |  |
| wilayah\_id | FK nullable | cakupan RT (Ketua RT); Admin RW memakai `rw` |
| rw | varchar(3), nullable | cakupan Admin RW |
| warga\_id | FK `warga`, unique, nullable | tautan akun warga ke datanya; satu data hanya bisa diklaim satu akun |
| status | enum (MENUNGGU\_VERIFIKASI, AKTIF, DITOLAK, NONAKTIF) |  |
| email\_verified\_at, created\_at, updated\_at | timestamptz |  |

**`pengajuan`**

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | uuid, PK |  |
| kartu\_keluarga\_id | FK | dipakai untuk cakupan data |
| diajukan\_oleh | FK `users` |  |
| jenis | enum (UBAH\_WARGA, TAMBAH\_ANGGOTA, LAPOR\_PINDAH, LAPOR\_MENINGGAL) |  |
| warga\_id | FK nullable | kosong untuk TAMBAH\_ANGGOTA |
| data\_lama, data\_baru | jsonb | untuk tampilan perbedaan; `data_lama` juga dasar deteksi konflik (BR-08) |
| catatan | text |  |
| status | enum (MENUNGGU, DISETUJUI, DITOLAK, DIBATALKAN) | di-index |
| diproses\_oleh | FK `users`, nullable |  |
| alasan\_penolakan | text, nullable |  |
| diproses\_at, created\_at | timestamptz |  |

**`import_batches`**: id, user\_id, nama\_file, status, total\_baris, baris\_berhasil, baris\_gagal, mapping (jsonb), errors (jsonb), created\_at.

**`activity_logs`**: id, user\_id, aksi, entitas, entitas\_id, perubahan (jsonb), ip, created\_at.

### 8.2 Constraint dan index penting

Satu KK hanya boleh punya satu Kepala Keluarga aktif, dijamin di level database dengan *partial unique index*:

```sql
CREATE UNIQUE INDEX one_head_per_kk
ON warga (kartu_keluarga_id)
WHERE hubungan_keluarga = 'KEPALA_KELUARGA' AND deleted_at IS NULL;
```

- **Unique:** `kartu_keluarga.no_kk`, `warga.nik`, `users.email`, `users.warga_id`, `wilayah (rw, rt)`.
- **Index untuk filter statistik:** `warga (tanggal_lahir)`, `warga (pendidikan_id)`, `warga (pekerjaan_id)`, `warga (jenis_kelamin)`, `warga (kartu_keluarga_id)`, `kartu_keluarga (wilayah_id)`, `pengajuan (status, kartu_keluarga_id)`.
- **Nama kepala keluarga tidak disimpan di `kartu_keluarga`.** Menyimpannya (kolom atau FK ke `warga`) menciptakan dependensi melingkar dan data yang bisa tidak sinkron. Nama diambil lewat join ke warga berhubungan KEPALA\_KELUARGA, dan tabel Data KK memakai *database view* `v_kk_ringkasan` (kepala keluarga, jumlah anggota aktif).
- **Usia tidak disimpan**, dihitung dari `tanggal_lahir` (BR-04).
- Tabel `warga`, `kartu_keluarga` memakai `deleted_at` untuk soft delete; semua query default memfilter `deleted_at IS NULL`.

## 9. Arsitektur dan tech stack

Aplikasi dibangun sebagai satu proyek **Next.js full-stack** di Vercel dengan PostgreSQL terkelola, karena Vercel tidak menjalankan Laravel, Docker, atau Nginx secara native. Jika kamu tetap memilih Laravel + Inertia + React, bagian 1 sampai 8 dan 10 sampai 12 tetap berlaku; hanya bagian ini yang diganti dan deploy dipindah ke Railway, Render, atau VPS dengan Docker.

&#91;embedded content: arsitektur · 4 layanan di sekitar aplikasi\]

Pengurus dan warga memakai aplikasi yang sama, dan hak akses serta cakupan data ditegakkan di server. File Excel dibaca di peramban lalu dikirim per batch agar tidak melewati batas request Vercel. Garis putus-putus ke Vercel Blob hanya berlaku jika lampiran bukti (FR-PGJ-07) diambil.

### 9.1 Tech stack

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Server Actions dan Route Handlers menggantikan controller; deploy Vercel tanpa konfigurasi |
| UI | React + Tailwind CSS + shadcn/ui | Konsep React dan Tailwind sama dengan stack lama; komponen tabel, dialog, combobox, form siap pakai |
| Tabel dan chart | TanStack Table, Recharts | Pagination dan sorting di server; chart bawaan shadcn |
| Form dan validasi | React Hook Form + Zod | Skema validasi yang sama dipakai di browser dan server |
| ORM dan migrasi | Prisma (atau Drizzle) | Skema bertipe, migrasi terversi, query SQL mentah tetap bisa dipakai untuk filter usia |
| Database | PostgreSQL di Neon (atau Supabase) | Tersedia lewat Vercel Marketplace; gunakan connection string *pooled* agar koneksi serverless tidak habis |
| Autentikasi | Better Auth (atau Auth.js) | Email + kata sandi, verifikasi email, reset sandi; field `role` dan cakupan pada tabel `users` |
| Otorisasi | Fungsi `requireRole()` dan `scopeWhere(user)` di server | Cukup untuk empat peran; cakupan RT/RW/KK diterapkan pada setiap query |
| Email | Resend (atau SMTP) | Verifikasi akun, reset sandi, notifikasi pengajuan |
| Baca dan tulis Excel | SheetJS atau ExcelJS | Parse di browser untuk import; export di server |
| Lampiran (Could) | Vercel Blob | Filesystem Vercel tidak permanen |
| Rate limiting | Tabel DB sederhana pada v1; Upstash Ratelimit jika dibutuhkan | Membatasi klaim akun dan login |
| Pengujian | Vitest (unit), Playwright (E2E) | Pengganti Pest/PHPUnit |
| CI/CD | GitHub Actions + integrasi Git Vercel | Lint, typecheck, test, lalu `prisma migrate deploy` ke produksi |
| Docker | Docker Compose hanya untuk PostgreSQL lokal | Tidak dipakai di produksi Vercel |

### 9.2 Lingkungan dan deployment

- **Tiga lingkungan:** lokal (Postgres di Docker), preview (otomatis per pull request, dengan branch database Neon), dan produksi (branch `main`).
- **Region:** pilih region Vercel Function dan database yang berdekatan (misalnya Singapura untuk keduanya) agar latensi query rendah.
- **Rahasia** (connection string, kunci auth, kunci email) disimpan di Environment Variables Vercel, tidak pernah di repositori.
- **Migrasi database** dijalankan di GitHub Actions sebelum deploy produksi, bukan saat aplikasi berjalan.
- **Backup:** aktifkan backup otomatis dan point-in-time recovery di penyedia database; uji pemulihan minimal sekali sebelum peluncuran.
- **Batas serverless:** request maksimal sekitar 4,5 MB dan durasi function terbatas, sehingga import dibagi per batch dan export dibatasi 5.000 baris per file. Periksa batas paket Vercel dan Neon yang berlaku saat ini sebelum memilih paket.

### 9.3 Struktur proyek (ringkas)

```text
app/
  (publik)/masuk, daftar, lupa-sandi
  (pengurus)/dashboard, cari-warga, warga, kk, pengajuan, import, pengguna, pengaturan, log
  (warga)/beranda, keluarga, pengajuan-saya, profil
  api/export, api/import-batch
lib/
  auth.ts          # sesi, requireRole
  scope.ts         # filter cakupan RT/RW/KK
  filters.ts       # parser filter URL -> SQL (dipakai dashboard + cari warga)
  import/          # parse, normalisasi, validasi
prisma/schema.prisma
```

## 10. Kebutuhan non-fungsional, keamanan, dan privasi

NIK, No KK, data anak, dan golongan darah adalah data pribadi, dan pada sistem ini warga ikut mengaksesnya. Karena itu keamanan dan privasi diperlakukan sebagai kebutuhan utama, bukan tambahan.

### 10.1 Kebutuhan non-fungsional

| ID | Kategori | Kebutuhan |
| --- | --- | --- |
| NFR-01 | Performa | Halaman tabel dan hasil filter tampil < 2 detik (persentil 95) untuk 10.000 warga |
| NFR-02 | Kapasitas | Mendukung 20.000 warga, 50 akun pengurus, dan 2.000 akun warga tanpa perubahan arsitektur |
| NFR-03 | Kompatibilitas | Dua versi terbaru Chrome, Safari, Firefox, dan Edge; layar mulai 360 px |
| NFR-04 | Aksesibilitas | Mengacu WCAG 2.1 AA: kontras warna, fokus keyboard, label pada semua field, huruf dasar 16 px |
| NFR-05 | Lokalisasi | Bahasa Indonesia, tanggal dd/mm/yyyy, zona waktu Asia/Jakarta |
| NFR-06 | Keandalan | Backup otomatis harian dan pemulihan point-in-time; uji pemulihan sebelum peluncuran |
| NFR-07 | Kualitas kode | Aturan bisnis dan logika filter punya unit test; CI (lint, typecheck, test) wajib lulus sebelum merge |
| NFR-08 | Retensi | Log aktivitas disimpan 12 bulan; data warga berstatus Pindah atau Meninggal tetap tersimpan untuk riwayat dan hanya terlihat oleh pengurus |

### 10.2 Keamanan

| ID | Kebutuhan |
| --- | --- |
| SEC-01 | Semua lalu lintas lewat HTTPS; cookie sesi `HttpOnly`, `Secure`, `SameSite=Lax`; perlindungan CSRF aktif |
| SEC-02 | Kata sandi di-hash dengan algoritma modern (argon2 atau bcrypt) oleh library autentikasi; minimal 10 karakter |
| SEC-03 | Otorisasi dan cakupan data dicek di server pada setiap Server Action dan Route Handler, bukan hanya di UI |
| SEC-04 | Ada tes otomatis yang membuktikan: Ketua RT A tidak bisa membaca data RT B, dan warga tidak bisa membaca KK lain |
| SEC-05 | Rate limiting pada login, klaim akun, dan reset sandi; pesan error klaim akun tidak membocorkan data mana yang salah |
| SEC-06 | Semua input divalidasi dengan Zod di server; query memakai parameter (tanpa string SQL gabungan) |
| SEC-07 | Tidak ada halaman publik yang menampilkan data warga; semua halaman data memakai `noindex` |
| SEC-08 | Rahasia hanya di Environment Variables; akses langsung ke database dibatasi dan dipisahkan antara preview dan produksi |
| SEC-09 | Enkripsi kolom NIK di level aplikasi (Could; evaluasi setelah rilis pertama) |

### 10.3 Privasi dan kepatuhan

Bagian ini bukan nasihat hukum. Rujukannya adalah UU Pelindungan Data Pribadi (UU No. 27 Tahun 2022); konsultasikan dengan pihak yang memahami hukum sebelum peluncuran. Data anak dan golongan darah berpotensi termasuk data pribadi yang bersifat spesifik.

- **Masking:** NIK dan No KK tampil seperti `3171••••••••0001` di tabel; tampil penuh hanya di halaman detail bagi yang berhak, dan setiap pembukaan tercatat di log.
- **Persetujuan dan transparansi:** warga menyetujui kebijakan privasi saat mendaftar; kebijakan menjelaskan data apa yang dikumpulkan, tujuan, siapa yang bisa melihat, dan berapa lama disimpan.
- **Hak warga:** warga dapat melihat dan mengoreksi data keluarganya lewat portal (pengajuan perubahan) dan meminta penghapusan akun lewat pengurus.
- **Pembatasan tujuan:** data hanya dipakai untuk pendataan dan program warga; export dibatasi pada peran tertentu dan setiap export dicatat.
- **Penanggung jawab data:** tunjuk satu orang (Super Admin) yang bertanggung jawab atas akses, backup, dan penanganan insiden kebocoran data.

### 10.4 Audit

Log aktivitas mencatat siapa, kapan, apa, dan perubahan apa (nilai sebelum dan sesudah) untuk: login, pembukaan NIK penuh, tambah, ubah, hapus, export, import, serta persetujuan atau penolakan pengajuan dan klaim akun.

## 11. Mockup UI

Mockup berisi 14 layar (10 untuk pengurus di desktop, 4 untuk warga di HP) dan bisa dibuka, diedit, dan diberi komentar di kanvas desain: [Mockup Sistem Pendataan Warga RT/RW](https://claude.ai/artifact/3micjnZZZNqap9Um2Vyu8D). Tombol dan menu antar layar sudah tersambung, jadi alurnya bisa dicoba lewat tombol Play.

### 11.1 Daftar layar

| Layar | Peran | Kebutuhan yang diwakili | Isi utama |
| --- | --- | --- | --- |
| Dashboard | Pengurus | FR-DSB-01 sampai 07 | Kartu ringkasan, filter, panel Hasil Filter, grafik pendidikan, pekerjaan, piramida penduduk, jenis kelamin, sebaran RT |
| Cari Warga | Pengurus | FR-CRW-01 sampai 06 | Chip filter aktif, tabel hasil dengan NIK dimasking, drawer detail, export Excel |
| Data Warga + form | Pengurus | FR-WRG-01 sampai 06 | Tabel warga, modal Tambah Warga dengan contoh error validasi NIK |
| Data KK | Pengurus | FR-KK-01 | Tabel KK, jumlah anggota, penanda KK tanpa kepala keluarga |
| Form KK | Pengurus | FR-KK-02 | Halaman penuh: data KK dan daftar anggota (repeater), simpan atomik |
| Pengajuan | Pengurus | FR-PGJ-03, 04 | Antrean per status, perbandingan nilai lama dan baru, setujui atau tolak dengan alasan |
| Import Excel | Admin | FR-IMP-01, 03, 04 | Langkah 3: ringkasan valid, peringatan, error, pemetaan nilai tak dikenal, opsi duplikat NIK |
| Pengguna | Admin | FR-USR-01, 02 | Akun pengurus dan antrean klaim akun warga |
| Pengaturan | Admin | FR-MST-01, 02 | Kategori usia yang bisa diubah, pendidikan beserta alias |
| Log Aktivitas | Admin | FR-LOG-01, 02 | Filter pengguna, aksi, tanggal; tabel kejadian |
| Daftar akun warga | Warga | FR-AUTH-02 | Verifikasi dengan NIK, No KK, tanggal lahir; persetujuan privasi |
| Beranda warga | Warga | US-02, US-05 | Ringkasan KK, pengajuan terbaru, pintasan ajukan perubahan |
| Keluarga saya | Warga | US-02 | Daftar anggota KK, tanda pengajuan menunggu |
| Ajukan perubahan | Warga | FR-PGJ-01, 02 | Pilih jenis pengajuan dan anggota, nilai saat ini dan usulan, catatan |

### 11.2 Panduan tampilan

| Elemen | Ketentuan di mockup |
| --- | --- |
| Tata letak pengurus | Sidebar gelap di kiri (profil, menu berkelompok), konten di kanan dengan latar abu muda dan kartu putih, mengikuti referensi Portal Admin SDGs UNJ |
| Tata letak warga | Satu kolom, header teal, navigasi bawah (Beranda, Keluarga, Pengajuan, Profil) |
| Warna | Primer teal `#0B6E7F`, sidebar `#25303B`, latar `#EEF2F4`, teks `#1C2630`, teks sekunder `#566370`; status: hijau (aktif, disetujui), kuning (menunggu), merah (error, ditolak), abu (nonaktif) |
| Huruf | Plus Jakarta Sans; tabel dan form memakai gaya yang sama di seluruh layar |
| Komponen | Kartu statistik dengan ikon, tabel berheader teal, badge status, chip filter yang bisa dihapus, drawer, modal, tombol putus-putus untuk menambah baris |
| Aksesibilitas | Target sentuh minimal 44 px, label pada semua field, ikon tanpa teks memakai `aria-label` |

Mockup memakai huruf 14 px (pengurus) dan 15 px (warga). NFR-04 meminta 16 px untuk portal warga, jadi ukuran itu dinaikkan saat implementasi.

### 11.3 Batasan mockup

- Nama, NIK, angka, dan "RW 03" adalah data contoh, bukan data nyata.
- Menu sidebar menampilkan versi Admin RW. Ketua RT melihat menu lebih sedikit (bagian 5.2).
- Belum digambar: halaman Masuk dan Lupa sandi, Detail KK, Profil, Import langkah 1, 2, dan 4, serta kondisi kosong, memuat, dan error.
- Mockup belum diuji tampilannya di berbagai ukuran layar, jadi tinggi beberapa layar bisa perlu disesuaikan.

## 12. Rilis, kriteria penerimaan, dan risiko

### 12.1 Roadmap rilis

Pengerjaan dibagi lima fase, dan tiap fase ditutup oleh gerbang yang bisa diuji. Import Excel ada di fase 2 supaya data lama langsung bisa dipakai untuk menguji fase berikutnya.

&#91;embedded content: roadmap · 5 fase, 5 gerbang\]

Kriteria tiap gerbang merujuk ke bagian 12.2: gerbang 1 ke AC-04, gerbang 2 ke AC-03, gerbang 3 ke AC-01, gerbang 4 ke AC-06, dan gerbang 5 ke seluruh kriteria.

### 12.2 Kriteria penerimaan

| ID | Kriteria | Cara uji |
| --- | --- | --- |
| AC-01 | Contoh kasus (SMA, Belum/Tidak Bekerja, Perempuan, Dewasa, 18–20 tahun) menghasilkan angka di Dashboard yang sama dengan jumlah baris di Cari Warga | Tes otomatis dengan data uji |
| AC-02 | Warga tanpa KK ditolak; KK dengan dua Kepala Keluarga aktif ditolak (BR-01, BR-02) | Tes otomatis |
| AC-03 | Import: NIK berbentuk notasi ilmiah ditandai Error; nol di depan tetap utuh; mengimpor file yang sama dua kali tidak menggandakan warga | Uji dengan file Excel nyata |
| AC-04 | Ketua RT tidak bisa membaca atau mengubah data RT lain lewat tampilan, URL langsung, maupun export | Tes otomatis (SEC-04) |
| AC-05 | Warga hanya melihat dan mengajukan perubahan untuk KK sendiri, dan tidak bisa membuka Dashboard atau Cari Warga | Tes otomatis |
| AC-06 | Data resmi tidak berubah sebelum pengajuan disetujui; setelah disetujui data berubah dan tercatat di log; konflik data terdeteksi (BR-08) | Uji alur ujung ke ujung |
| AC-07 | NIK dimasking di semua tabel; setiap pembukaan NIK penuh dan setiap export tercatat di log | Uji manual + cek log |
| AC-08 | Hasil filter tampil < 2 detik untuk 10.000 warga uji (NFR-01) | Uji performa |
| AC-09 | Klaim akun dengan data tidak cocok menampilkan pesan generik, dan dibatasi 5 percobaan per jam | Uji manual + tes otomatis |
| AC-10 | Semua halaman dapat dipakai di layar 360 px tanpa geser horizontal pada halaman | Uji manual di HP |

### 12.3 Risiko

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Kualitas data Excel rendah (NIK rusak, tanggal campur) | Banyak baris gagal diimpor | Wizard memberi laporan per baris; perbaikan di Excel lalu impor ulang; uji dengan file nyata lebih awal |
| Warga enggan memakai portal | Data tidak ikut diperbarui | Pengurus tetap bisa mengisi langsung; tampilan HP dibuat sederhana; sosialisasi lewat RT |
| Antrean verifikasi menumpuk di Ketua RT | Pengajuan dan klaim tertunda | Notifikasi email; Admin RW bisa menyetujui menggantikan; antrean dipisah per RT |
| Kebocoran data pribadi | Kerugian warga dan reputasi pengurus | Masking, cakupan data di server, log, backup, 2FA untuk admin (Could) |
| Klaim akun oleh orang yang mengetahui NIK, No KK, dan tanggal lahir warga lain | Akun diambil alih | Persetujuan Ketua RT wajib; pembatasan percobaan; data warga hanya bisa diklaim satu akun |
| Batas serverless Vercel (ukuran request, durasi function) | Import dan export besar gagal | Import dibagi per batch 200 baris; export dibatasi 5.000 baris per file |
| Ketergantungan pada layanan pihak ketiga (Vercel, Neon, email) | Layanan terganggu atau berubah paket | Backup dan uji pemulihan; ekspor data berkala |
| Definisi kategori usia belum disepakati | Angka statistik diperdebatkan | Kategori disimpan di tabel dan bisa diubah tanpa deploy |

### 12.4 Pertanyaan terbuka

- [ ] Kolom apa saja yang ada di Excel saat ini, dan berapa baris? (menentukan template dan pemetaan kolom)
- [ ] Satu RW saja, atau beberapa RW dalam satu sistem?
- [ ] Warga login dengan email atau nomor HP? Nomor HP tanpa email memerlukan OTP lewat SMS atau WhatsApp, yang di luar lingkup versi 1.
- [ ] Siapa Super Admin dan penanggung jawab data pribadi?
- [ ] Apakah Ketua RT yang memverifikasi klaim dan pengajuan, atau cukup Admin RW?
- [ ] Apakah perubahan NIK, nama, atau tanggal lahir wajib disertai foto KK/KTP?
- [ ] Berapa usia minimal warga untuk mendaftar akun? (asumsi saat ini 17 tahun)
- [ ] Definisi final kategori usia (bagian 6.2) dan nilai default wilayah (kelurahan, kecamatan, kota).
- [ ] Apakah kebijakan privasi perlu disetujui pihak kelurahan atau hukum setempat sebelum peluncuran?
- [ ] Estimasi durasi tiap fase ditentukan setelah jumlah pengembang dan kolom Excel diketahui.
