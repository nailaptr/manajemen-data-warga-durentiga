import type { AGAMA, GOLONGAN_DARAH, HUBUNGAN, STATUS_PERKAWINAN } from "../validators/kk";

// Tipe bersama modul import (PRD bagian 7). Semua fungsi di lib/import/ murni: tanpa database, tanpa DOM.

export type Hubungan = (typeof HUBUNGAN)[number];
export type Agama = (typeof AGAMA)[number];
export type GolonganDarah = (typeof GOLONGAN_DARAH)[number];
export type StatusPerkawinan = (typeof STATUS_PERKAWINAN)[number];

// Field sistem yang bisa diisi dari kolom Excel (PRD 7.2).
export const FIELD_IMPOR = [
  "no_kk", "nik", "nama_lengkap", "jenis_kelamin", "tanggal_lahir", "hubungan_keluarga",
  "tempat_lahir", "agama", "pendidikan", "pekerjaan", "golongan_darah", "status_perkawinan",
  "alamat", "rt", "rw", "desa_kelurahan", "kecamatan", "kabupaten_kota", "provinsi", "kode_pos",
] as const;
export type FieldImpor = (typeof FIELD_IMPOR)[number];

// Hasil membaca file: header dan baris sel teks. nomor = nomor baris di Excel (dimulai 1), untuk pesan "Baris 14: ...".
export interface BarisSel {
  nomor: number;
  sel: string[];
}
export interface HasilParse {
  header: string[];
  baris: BarisSel[];
}

// Pemetaan field sistem -> nama header di file (wizard mapping, PRD 7.1 langkah 2).
export type Mapping = Partial<Record<FieldImpor, string>>;

export interface BarisMentah {
  nomor: number;
  // Field yang tidak dipetakan tidak ada di objek; field dipetakan tetapi sel kosong bernilai "".
  nilai: Partial<Record<FieldImpor, string>>;
}

export interface OpsiMaster {
  id: string;
  nama: string;
  alias: string[];
}
export interface MasterImpor {
  pendidikan: OpsiMaster[];
  pekerjaan: OpsiMaster[];
  // Pasangan RW/RT (3 digit) yang sudah ada di master wilayah.
  wilayah: { rw: string; rt: string }[];
  // Pemetaan manual sekali untuk semua baris: nilai (huruf kecil, spasi dirapikan) -> id master.
  pemetaanManual?: { pendidikan?: Record<string, string>; pekerjaan?: Record<string, string> };
}

// Hasil normalisasi satu baris. null berarti kosong atau tidak terbaca; teks asli tetap ada di `mentah`
// agar validasi bisa membedakan "kosong" dari "tidak dikenali".
export interface BarisNormal {
  nomor: number;
  mentah: Partial<Record<FieldImpor, string>>;
  no_kk: string;
  nik: string;
  nama_lengkap: string;
  jenis_kelamin: "L" | "P" | null;
  tanggal_lahir: string | null; // yyyy-mm-dd
  hubungan_keluarga: Hubungan | null;
  tempat_lahir: string;
  agama: Agama | null;
  pendidikan_id: string | null;
  pekerjaan_id: string | null;
  golongan_darah: GolonganDarah | null;
  status_perkawinan: StatusPerkawinan | null;
  alamat: string;
  rt: string; // 3 digit bila terbaca, selain itu teks asli
  rw: string;
  desa_kelurahan: string;
  kecamatan: string;
  kabupaten_kota: string;
  provinsi: string;
  kode_pos: string;
}

export interface Temuan {
  level: "error" | "peringatan";
  // Kolom yang bermasalah; dipakai preview untuk menyorot sel.
  field?: FieldImpor;
  pesan: string;
}

export type StatusBaris = "valid" | "peringatan" | "error";

export interface BarisHasil {
  data: BarisNormal;
  temuan: Temuan[];
  status: StatusBaris;
}

export interface KkImpor {
  no_kk: string;
  // Alamat dan wilayah diambil dari baris pertama tiap No KK yang diimpor (PRD 7.2).
  alamat: string;
  rt: string;
  rw: string;
  desa_kelurahan: string;
  kecamatan: string;
  kabupaten_kota: string;
  provinsi: string;
  kode_pos: string;
  anggota: BarisHasil[];
}

export class GalatImpor extends Error {}

export const BATAS_UKURAN_BYTE = 5 * 1024 * 1024;
export const BATAS_BARIS = 5000;
