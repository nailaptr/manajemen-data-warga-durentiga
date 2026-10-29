import * as XLSX from "xlsx";
import type { GagalImpor } from "../validators/impor";
import { MAPPING_TEMPLATE } from "./normalize";
import { FIELD_IMPOR, type HasilParse } from "./types";

// Berkas yang dibuat di browser untuk diunduh: template (PRD 7.1 langkah 1) dan daftar baris gagal (langkah 4).
// Semua sel ditulis sebagai teks agar NIK dan No KK tidak berubah menjadi angka saat dibuka di Excel.
function keXlsx(nama: string, baris: string[][]): Uint8Array {
  const lembar = XLSX.utils.aoa_to_sheet(baris);
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, lembar, nama);
  return new Uint8Array(XLSX.write(buku, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

// Satu baris contoh palsu (awalan 999) agar format tanggal dan nilai pilihan terlihat jelas.
const CONTOH: Record<(typeof FIELD_IMPOR)[number], string> = {
  no_kk: "9990000000000001", nik: "9990001503800001", nama_lengkap: "Contoh Nama", jenis_kelamin: "L",
  tanggal_lahir: "15/03/1980", hubungan_keluarga: "Kepala Keluarga", tempat_lahir: "Jakarta", agama: "Islam",
  pendidikan: "SMA", pekerjaan: "Wiraswasta", golongan_darah: "O", status_perkawinan: "Kawin",
  alamat: "Jl. Contoh No. 1", rt: "001", rw: "003", desa_kelurahan: "", kecamatan: "", kabupaten_kota: "", provinsi: "", kode_pos: "",
};

export function buatTemplate(): Uint8Array {
  return keXlsx("Warga", [FIELD_IMPOR.map((f) => MAPPING_TEMPLATE[f] ?? f), FIELD_IMPOR.map((f) => CONTOH[f])]);
}

// Header dan sel asli file ditambah kolom "Masalah", supaya admin bisa memperbaiki di Excel lalu mengimpor ulang.
export function buatDaftarGagal(hasil: HasilParse, gagal: GagalImpor[]): Uint8Array {
  const perBaris = new Map<number, string[]>();
  for (const g of gagal) perBaris.set(g.nomor, [...(perBaris.get(g.nomor) ?? []), g.pesan]);
  const baris = hasil.baris.flatMap((b) => {
    const pesan = perBaris.get(b.nomor);
    return pesan ? [[...b.sel, pesan.join("; ")]] : [];
  });
  return keXlsx("Gagal", [[...hasil.header, "Masalah"], ...baris]);
}
