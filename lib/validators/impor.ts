import { z } from "zod";
import { AGAMA, GOLONGAN_DARAH, HUBUNGAN, STATUS_PERKAWINAN } from "./kk";

// Kontrak antara wizard import (browser) dan Route Handler /api/import-batch (PRD 7.5). Server memvalidasi ulang
// semuanya: isi request tidak dipercaya walau browser sudah memeriksanya.
export const UKURAN_BATCH = 200;

const tanggal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus yyyy-mm-dd")
  .refine((t) => {
    const d = new Date(`${t}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t && t <= new Date().toISOString().slice(0, 10);
  }, "Tanggal tidak valid");

const teks = (maks: number) => z.string().trim().max(maks);
const opsional = <T extends z.ZodType>(s: T) => s.nullish().transform((v) => v ?? null);

export const barisImporSchema = z.object({
  nomor: z.number().int().positive(),
  no_kk: z.string().regex(/^\d{16}$/),
  nik: z.string().regex(/^\d{16}$/),
  nama_lengkap: teks(100).min(1),
  jenis_kelamin: z.enum(["L", "P"]),
  tanggal_lahir: tanggal,
  hubungan_keluarga: z.enum(HUBUNGAN),
  tempat_lahir: teks(100),
  agama: opsional(z.enum(AGAMA)),
  pendidikan_id: opsional(z.string().uuid()),
  pekerjaan_id: opsional(z.string().uuid()),
  golongan_darah: opsional(z.enum(GOLONGAN_DARAH)),
  status_perkawinan: opsional(z.enum(STATUS_PERKAWINAN)),
  alamat: teks(500),
  rt: z.string().regex(/^\d{3}$/),
  rw: z.string().regex(/^\d{3}$/),
  desa_kelurahan: teks(100),
  kecamatan: teks(100),
  kabupaten_kota: teks(100),
  provinsi: teks(100),
  kode_pos: teks(10),
});
export type BarisImpor = z.infer<typeof barisImporSchema>;

const gagalSchema = z.object({ nomor: z.number().int().positive(), pesan: z.string().trim().min(1).max(300) });
export type GagalImpor = z.infer<typeof gagalSchema>;

export const mulaiImporSchema = z.object({
  aksi: z.literal("mulai"),
  nama_file: teks(255).min(1),
  total_baris: z.number().int().min(1).max(5000),
  mapping: z.record(z.string().max(100), z.string().max(255)),
  // Baris yang sudah ditolak di browser (status Error): hanya nomor dan alasan, tanpa data pribadi.
  gagal_klien: z.array(gagalSchema).max(5000),
  // Pemetaan manual nilai tak dikenal; disimpan sebagai alias master untuk import berikutnya.
  alias: z.array(z.object({ jenis: z.enum(["pendidikan", "pekerjaan"]), id: z.string().uuid(), teks: teks(100).min(1) })).max(500),
});

export const prosesImporSchema = z.object({
  aksi: z.literal("proses"),
  id: z.string().uuid(),
  mode: z.enum(["lewati", "perbarui"]),
  baris: z.array(barisImporSchema).min(1).max(UKURAN_BATCH),
});

export const selesaiImporSchema = z.object({ aksi: z.literal("selesai"), id: z.string().uuid() });

export const permintaanImporSchema = z.discriminatedUnion("aksi", [mulaiImporSchema, prosesImporSchema, selesaiImporSchema]);
export type MulaiImpor = z.infer<typeof mulaiImporSchema>;
export type ProsesImpor = z.infer<typeof prosesImporSchema>;

export interface HasilBatch {
  berhasil: number;
  dilewati: number;
  gagal: GagalImpor[];
}
export interface RingkasanImpor {
  berhasil: number;
  dilewati: number;
  gagal: number;
}
