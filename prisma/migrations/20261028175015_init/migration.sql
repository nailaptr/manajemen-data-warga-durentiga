-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_RW', 'KETUA_RT', 'WARGA');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('MENUNGGU_VERIFIKASI', 'AKTIF', 'DITOLAK', 'NONAKTIF');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "Agama" AS ENUM ('ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU', 'LAINNYA');

-- CreateEnum
CREATE TYPE "GolonganDarah" AS ENUM ('A', 'B', 'AB', 'O', 'TIDAK_TAHU');

-- CreateEnum
CREATE TYPE "HubunganKeluarga" AS ENUM ('KEPALA_KELUARGA', 'ISTRI', 'SUAMI', 'ANAK', 'MENANTU', 'CUCU', 'ORANG_TUA', 'MERTUA', 'FAMILI_LAIN', 'LAINNYA');

-- CreateEnum
CREATE TYPE "StatusPerkawinan" AS ENUM ('BELUM_KAWIN', 'KAWIN', 'CERAI_HIDUP', 'CERAI_MATI');

-- CreateEnum
CREATE TYPE "StatusKependudukan" AS ENUM ('AKTIF', 'PINDAH', 'MENINGGAL');

-- CreateEnum
CREATE TYPE "JenisPengajuan" AS ENUM ('UBAH_WARGA', 'TAMBAH_ANGGOTA', 'LAPOR_PINDAH', 'LAPOR_MENINGGAL');

-- CreateEnum
CREATE TYPE "StatusPengajuan" AS ENUM ('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN');

-- CreateTable
CREATE TABLE "wilayah" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rw" VARCHAR(3) NOT NULL,
    "rt" VARCHAR(3) NOT NULL,
    "keterangan" TEXT,

    CONSTRAINT "wilayah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_pendidikan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nama" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "alias" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ref_pendidikan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_pekerjaan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nama" TEXT NOT NULL,
    "alias" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ref_pekerjaan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kategori_usia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nama" TEXT NOT NULL,
    "usia_min" INTEGER NOT NULL,
    "usia_maks" INTEGER,
    "jenis_kelamin" "JenisKelamin",
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "kategori_usia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "no_hp" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "wilayah_id" UUID,
    "rw" VARCHAR(3),
    "warga_id" UUID,
    "status" "UserStatus" NOT NULL,
    "email_verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kartu_keluarga" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "no_kk" CHAR(16) NOT NULL,
    "alamat" TEXT NOT NULL,
    "wilayah_id" UUID NOT NULL,
    "desa_kelurahan" TEXT,
    "kecamatan" TEXT,
    "kabupaten_kota" TEXT,
    "provinsi" TEXT,
    "kode_pos" VARCHAR(5),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "kartu_keluarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warga" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kartu_keluarga_id" UUID NOT NULL,
    "nik" CHAR(16) NOT NULL,
    "nama_lengkap" VARCHAR(100) NOT NULL,
    "jenis_kelamin" "JenisKelamin" NOT NULL,
    "tempat_lahir" TEXT,
    "tanggal_lahir" DATE NOT NULL,
    "agama" "Agama",
    "pendidikan_id" UUID,
    "pekerjaan_id" UUID,
    "golongan_darah" "GolonganDarah",
    "hubungan_keluarga" "HubunganKeluarga" NOT NULL,
    "status_perkawinan" "StatusPerkawinan",
    "status_kependudukan" "StatusKependudukan" NOT NULL DEFAULT 'AKTIF',
    "tanggal_status" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "warga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengajuan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kartu_keluarga_id" UUID NOT NULL,
    "diajukan_oleh" UUID NOT NULL,
    "jenis" "JenisPengajuan" NOT NULL,
    "warga_id" UUID,
    "data_lama" JSONB,
    "data_baru" JSONB,
    "catatan" TEXT,
    "status" "StatusPengajuan" NOT NULL DEFAULT 'MENUNGGU',
    "diproses_oleh" UUID,
    "alasan_penolakan" TEXT,
    "diproses_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "nama_file" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "total_baris" INTEGER NOT NULL DEFAULT 0,
    "baris_berhasil" INTEGER NOT NULL DEFAULT 0,
    "baris_gagal" INTEGER NOT NULL DEFAULT 0,
    "mapping" JSONB,
    "errors" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT,
    "entitas_id" TEXT,
    "perubahan" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wilayah_rw_rt_key" ON "wilayah"("rw", "rt");

-- CreateIndex
CREATE UNIQUE INDEX "ref_pendidikan_nama_key" ON "ref_pendidikan"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "ref_pekerjaan_nama_key" ON "ref_pekerjaan"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_warga_id_key" ON "users"("warga_id");

-- CreateIndex
CREATE UNIQUE INDEX "kartu_keluarga_no_kk_key" ON "kartu_keluarga"("no_kk");

-- CreateIndex
CREATE INDEX "kartu_keluarga_wilayah_id_idx" ON "kartu_keluarga"("wilayah_id");

-- CreateIndex
CREATE UNIQUE INDEX "warga_nik_key" ON "warga"("nik");

-- CreateIndex
CREATE INDEX "warga_tanggal_lahir_idx" ON "warga"("tanggal_lahir");

-- CreateIndex
CREATE INDEX "warga_pendidikan_id_idx" ON "warga"("pendidikan_id");

-- CreateIndex
CREATE INDEX "warga_pekerjaan_id_idx" ON "warga"("pekerjaan_id");

-- CreateIndex
CREATE INDEX "warga_jenis_kelamin_idx" ON "warga"("jenis_kelamin");

-- CreateIndex
CREATE INDEX "warga_kartu_keluarga_id_idx" ON "warga"("kartu_keluarga_id");

-- CreateIndex
CREATE INDEX "pengajuan_status_kartu_keluarga_id_idx" ON "pengajuan"("status", "kartu_keluarga_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_wilayah_id_fkey" FOREIGN KEY ("wilayah_id") REFERENCES "wilayah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_warga_id_fkey" FOREIGN KEY ("warga_id") REFERENCES "warga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kartu_keluarga" ADD CONSTRAINT "kartu_keluarga_wilayah_id_fkey" FOREIGN KEY ("wilayah_id") REFERENCES "wilayah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kartu_keluarga" ADD CONSTRAINT "kartu_keluarga_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warga" ADD CONSTRAINT "warga_kartu_keluarga_id_fkey" FOREIGN KEY ("kartu_keluarga_id") REFERENCES "kartu_keluarga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warga" ADD CONSTRAINT "warga_pendidikan_id_fkey" FOREIGN KEY ("pendidikan_id") REFERENCES "ref_pendidikan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warga" ADD CONSTRAINT "warga_pekerjaan_id_fkey" FOREIGN KEY ("pekerjaan_id") REFERENCES "ref_pekerjaan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_kartu_keluarga_id_fkey" FOREIGN KEY ("kartu_keluarga_id") REFERENCES "kartu_keluarga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_diajukan_oleh_fkey" FOREIGN KEY ("diajukan_oleh") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_diproses_oleh_fkey" FOREIGN KEY ("diproses_oleh") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_warga_id_fkey" FOREIGN KEY ("warga_id") REFERENCES "warga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BR-03: NIK dan No KK selalu tepat 16 digit angka.
ALTER TABLE "warga" ADD CONSTRAINT "warga_nik_16_digit" CHECK ("nik" ~ '^[0-9]{16}$');
ALTER TABLE "kartu_keluarga" ADD CONSTRAINT "kartu_keluarga_no_kk_16_digit" CHECK ("no_kk" ~ '^[0-9]{16}$');

-- BR-02: satu KK hanya punya satu Kepala Keluarga aktif (PRD 8.2).
CREATE UNIQUE INDEX "one_head_per_kk"
ON "warga" ("kartu_keluarga_id")
WHERE "hubungan_keluarga" = 'KEPALA_KELUARGA' AND "deleted_at" IS NULL;
