import { UKURAN_BATCH, type BarisImpor } from "../validators/impor";
import type { BarisNormal, KkImpor } from "./types";

const potong = (teks: string, maks: number) => teks.slice(0, maks);

// Baris yang lolos validasi menjadi payload server. null bila ada kolom wajib yang kosong (tidak mungkin untuk baris non-Error).
export function keBarisServer(b: BarisNormal): BarisImpor | null {
  if (!b.jenis_kelamin || !b.tanggal_lahir || !b.hubungan_keluarga) return null;
  return {
    nomor: b.nomor,
    no_kk: b.no_kk,
    nik: b.nik,
    nama_lengkap: b.nama_lengkap,
    jenis_kelamin: b.jenis_kelamin,
    tanggal_lahir: b.tanggal_lahir,
    hubungan_keluarga: b.hubungan_keluarga,
    tempat_lahir: potong(b.tempat_lahir, 100),
    agama: b.agama,
    pendidikan_id: b.pendidikan_id,
    pekerjaan_id: b.pekerjaan_id,
    golongan_darah: b.golongan_darah,
    status_perkawinan: b.status_perkawinan,
    alamat: potong(b.alamat, 500),
    rt: b.rt,
    rw: b.rw,
    desa_kelurahan: potong(b.desa_kelurahan, 100),
    kecamatan: potong(b.kecamatan, 100),
    kabupaten_kota: potong(b.kabupaten_kota, 100),
    provinsi: potong(b.provinsi, 100),
    kode_pos: potong(b.kode_pos, 10),
  };
}

// Bagi KK menjadi batch hingga `ukuran` baris. Satu KK tidak pernah dipecah antar batch, sehingga aturan satu
// Kepala Keluarga per KK dan alamat dari baris pertama dinilai dalam satu transaksi. KK lebih besar dari batch menjadi batch sendiri.
export function bagiBatch(kk: KkImpor[], ukuran: number = UKURAN_BATCH): BarisImpor[][] {
  const hasil: BarisImpor[][] = [];
  let saatIni: BarisImpor[] = [];
  for (const k of kk) {
    const baris = k.anggota.flatMap((a) => keBarisServer(a.data) ?? []);
    if (baris.length === 0) continue;
    if (saatIni.length > 0 && saatIni.length + baris.length > ukuran) {
      hasil.push(saatIni);
      saatIni = [];
    }
    saatIni.push(...baris);
  }
  if (saatIni.length > 0) hasil.push(saatIni);
  return hasil;
}
