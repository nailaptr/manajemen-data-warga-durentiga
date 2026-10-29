import { FIELD_IMPOR, type FieldImpor, type Mapping } from "./types";
import { kunci } from "./normalize";

// Nama kolom yang umum dipakai di Excel pengurus, ditulis tanpa spasi dan tanda baca (PRD 7.1 langkah 2).
const SINONIM: Record<FieldImpor, string[]> = {
  no_kk: ["nokk", "nomorkk", "nokartukeluarga", "nomorkartukeluarga"],
  nik: ["nik", "nomorindukkependudukan"],
  nama_lengkap: ["namalengkap", "nama"],
  jenis_kelamin: ["jeniskelamin", "jk", "kelamin", "gender"],
  tanggal_lahir: ["tanggallahir", "tgllahir", "tanggalkelahiran", "tgllhr"],
  hubungan_keluarga: ["hubungankeluarga", "hubungan", "shdk", "statushubungankeluarga"],
  tempat_lahir: ["tempatlahir", "tmplahir", "tempatkelahiran"],
  agama: ["agama"],
  pendidikan: ["pendidikan", "pendidikanterakhir"],
  pekerjaan: ["pekerjaan"],
  golongan_darah: ["golongandarah", "goldarah"],
  status_perkawinan: ["statusperkawinan", "statuskawin", "perkawinan"],
  alamat: ["alamat"],
  rt: ["rt"],
  rw: ["rw"],
  desa_kelurahan: ["desa", "kelurahan", "desakelurahan", "kelurahandesa"],
  kecamatan: ["kecamatan"],
  kabupaten_kota: ["kabkota", "kabupatenkota", "kabupaten", "kota"],
  provinsi: ["provinsi"],
  kode_pos: ["kodepos"],
};

const polos = (teks: string) => teks.toLowerCase().replace(/[^a-z0-9]/g, "");

// Mencocokkan header file ke field sistem. Tiap header dipakai paling banyak sekali; field tanpa padanan tidak dipetakan.
export function deteksiMapping(header: string[]): Mapping {
  const dipakai = new Set<number>();
  const hasil: Mapping = {};
  for (const field of FIELD_IMPOR) {
    const i = header.findIndex((h, idx) => !dipakai.has(idx) && SINONIM[field].includes(polos(h)));
    const nama = header[i];
    if (i >= 0 && nama !== undefined) {
      dipakai.add(i);
      hasil[field] = nama;
    }
  }
  return hasil;
}

// Mapping tersimpan menang atas deteksi otomatis, tetapi hanya untuk kolom yang memang ada di file ini.
export function gabungkanMapping(terdeteksi: Mapping, tersimpan: Record<string, string> | null, header: string[]): Mapping {
  if (!tersimpan) return terdeteksi;
  const hasil: Mapping = { ...terdeteksi };
  for (const field of FIELD_IMPOR) {
    const nama = tersimpan[field];
    const ada = nama === undefined ? undefined : header.find((h) => kunci(h) === kunci(nama));
    if (ada !== undefined) hasil[field] = ada;
  }
  return hasil;
}

// Kolom wajib untuk membentuk KK dan identitas warga (PRD 7.2). Hubungan keluarga boleh diganti opsi "anggota pertama".
export const FIELD_WAJIB: readonly FieldImpor[] = ["no_kk", "nik", "nama_lengkap", "jenis_kelamin", "tanggal_lahir", "rt", "rw"];
