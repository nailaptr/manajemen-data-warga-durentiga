// Membuat docs/data-contoh/warga-contoh.xlsx: data PALSU (NIK/No KK berawalan 999) untuk tes import.
// Jalankan: pnpm exec tsx scripts/buat-contoh-impor.ts
// File sengaja memuat campuran sel Teks, angka, tanggal bernomor seri, dan notasi ilmiah.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as XLSX from "xlsx";
import { FIELD_IMPOR, type FieldImpor } from "../lib/import/types";
import { MAPPING_TEMPLATE } from "../lib/import/normalize";

type Sel = string | XLSX.CellObject;
type Baris = Partial<Record<FieldImpor, Sel>>;

const serial = (tahun: number, bulan: number, hari: number) => (Date.UTC(tahun, bulan - 1, hari) - Date.UTC(1899, 11, 30)) / 86_400_000;
const tanggalSerial = (tahun: number, bulan: number, hari: number): XLSX.CellObject => ({ t: "n", v: serial(tahun, bulan, hari), z: "dd/mm/yyyy" });

// NIK palsu: 999000 + DDMMYY (+40 pada hari untuk perempuan) + 4 digit urut.
function nik(tahun: number, bulan: number, hari: number, jk: "L" | "P", urut: number): string {
  const dd = String(hari + (jk === "P" ? 40 : 0)).padStart(2, "0");
  return `999000${dd}${String(bulan).padStart(2, "0")}${String(tahun % 100).padStart(2, "0")}${String(urut).padStart(4, "0")}`;
}

const dasar: Baris = {
  tempat_lahir: "Jakarta", agama: "Islam", pendidikan: "SMA", pekerjaan: "Karyawan Swasta", golongan_darah: "O",
  status_perkawinan: "Kawin", alamat: "Jl. Contoh No. 1", rt: "001", rw: "003", desa_kelurahan: "Duren Tiga",
  kecamatan: "Pancoran", kabupaten_kota: "Jakarta Selatan", provinsi: "DKI Jakarta", kode_pos: "12760",
};
const kk = (n: number) => `99900000000000${String(n).padStart(2, "0")}`;

const DATA: Baris[] = [
  // KK 10: lengkap dan bersih; tiga format tanggal (dd/mm/yyyy, serial Excel, yyyy-mm-dd), nama dengan spasi berlebih.
  { ...dasar, no_kk: kk(10), nik: nik(1980, 3, 15, "L", 1), nama_lengkap: "  Uji   Kepala Sepuluh ", jenis_kelamin: "L", tanggal_lahir: "15/03/1980", hubungan_keluarga: "Kepala Keluarga", pendidikan: "SMA/Sederajat", pekerjaan: "Wiraswasta", rt: { t: "n", v: 1 }, rw: { t: "n", v: 3 } },
  { ...dasar, no_kk: kk(10), nik: nik(1985, 7, 20, "P", 2), nama_lengkap: "Uji Istri Sepuluh", jenis_kelamin: "Perempuan", tanggal_lahir: tanggalSerial(1985, 7, 20), hubungan_keluarga: "Istri", pendidikan: "S1", pekerjaan: "IRT" },
  { ...dasar, no_kk: kk(10), nik: nik(2010, 5, 5, "L", 3), nama_lengkap: "Uji Anak Sepuluh", jenis_kelamin: "laki laki", tanggal_lahir: "2010-05-05", hubungan_keluarga: "Anak", pendidikan: "sd", pekerjaan: "Pelajar", status_perkawinan: "Belum Kawin" },
  // KK 20: pendidikan kosong dan pekerjaan tak dikenal (peringatan).
  { ...dasar, no_kk: kk(20), nik: nik(1970, 12, 1, "L", 4), nama_lengkap: "Uji Kepala Dua Puluh", jenis_kelamin: "Pria", tanggal_lahir: "01/12/1970", hubungan_keluarga: "Kepala Keluarga", rt: "002" },
  { ...dasar, no_kk: kk(20), nik: nik(2005, 2, 9, "P", 5), nama_lengkap: "Uji Anak Dua Puluh", jenis_kelamin: "Wanita", tanggal_lahir: "09/02/2005", hubungan_keluarga: "Anak", pendidikan: "", pekerjaan: "Astronot", rt: "002" },
  // KK 30: tanpa Kepala Keluarga (peringatan).
  { ...dasar, no_kk: kk(30), nik: nik(1990, 8, 17, "P", 6), nama_lengkap: "Uji Istri Tiga Puluh", jenis_kelamin: "P", tanggal_lahir: "17/08/1990", hubungan_keluarga: "Istri", rt: "003" },
  // KK 40: dua Kepala Keluarga (error pada keduanya).
  { ...dasar, no_kk: kk(40), nik: nik(1975, 1, 2, "L", 7), nama_lengkap: "Uji Kepala Empat Puluh A", jenis_kelamin: "L", tanggal_lahir: "02/01/1975", hubungan_keluarga: "Kepala Keluarga", rt: "004" },
  { ...dasar, no_kk: kk(40), nik: nik(1976, 2, 3, "L", 8), nama_lengkap: "Uji Kepala Empat Puluh B", jenis_kelamin: "L", tanggal_lahir: "03/02/1976", hubungan_keluarga: "Kepala Keluarga", rt: "004" },
  // KK 50: NIK berubah menjadi notasi ilmiah (error), sel angka berformat Umum.
  { ...dasar, no_kk: kk(50), nik: { t: "n", v: 9.99e15, z: "General" }, nama_lengkap: "Uji Ilmiah Lima Puluh", jenis_kelamin: "L", tanggal_lahir: "04/04/1980", hubungan_keluarga: "Kepala Keluarga", rt: "005" },
  // KK 60: NIK ganda di dalam file (error pada keduanya).
  { ...dasar, no_kk: kk(60), nik: nik(1981, 1, 1, "L", 9), nama_lengkap: "Uji Ganda Enam Puluh A", jenis_kelamin: "L", tanggal_lahir: "01/01/1981", hubungan_keluarga: "Kepala Keluarga", rt: "001" },
  { ...dasar, no_kk: kk(60), nik: nik(1981, 1, 1, "L", 9), nama_lengkap: "Uji Ganda Enam Puluh B", jenis_kelamin: "L", tanggal_lahir: "01/01/1981", hubungan_keluarga: "Anak", rt: "001" },
  // KK 70: baris bermasalah satu per satu.
  { ...dasar, no_kk: kk(70), nik: nik(1982, 2, 2, "L", 10), nama_lengkap: "Uji Kepala Tujuh Puluh", jenis_kelamin: "L", tanggal_lahir: "02/02/1982", hubungan_keluarga: "Kepala Keluarga", rt: "009" },
  { ...dasar, no_kk: kk(70), nik: nik(2999, 1, 1, "L", 11), nama_lengkap: "Uji Masa Depan", jenis_kelamin: "L", tanggal_lahir: "01/01/2999", hubungan_keluarga: "Anak", rt: "009" },
  { ...dasar, no_kk: kk(70), nik: nik(1990, 3, 3, "L", 12), nama_lengkap: "Uji NIK Tidak Cocok", jenis_kelamin: "L", tanggal_lahir: "04/04/1992", hubungan_keluarga: "Anak", rt: "009" },
  { ...dasar, no_kk: kk(70), nik: nik(1990, 3, 3, "L", 13), nama_lengkap: "", jenis_kelamin: "L", tanggal_lahir: "03/03/1990", hubungan_keluarga: "Anak", rt: "009" },
  { ...dasar, no_kk: kk(70), nik: nik(1990, 3, 3, "L", 14), nama_lengkap: "Uji Kelamin Aneh", jenis_kelamin: "?", tanggal_lahir: "03/03/1990", hubungan_keluarga: "Anak", rt: "009" },
  { ...dasar, no_kk: kk(70), nik: nik(1990, 3, 3, "L", 15), nama_lengkap: "Uji Tanggal Mustahil", jenis_kelamin: "L", tanggal_lahir: "31/02/1990", hubungan_keluarga: "Anak", rt: "009" },
  { ...dasar, no_kk: "99900000000080", nik: nik(1990, 3, 3, "L", 16), nama_lengkap: "Uji No KK Pendek", jenis_kelamin: "L", tanggal_lahir: "03/03/1990", hubungan_keluarga: "Kepala Keluarga" },
];

const urut = FIELD_IMPOR.filter((f) => MAPPING_TEMPLATE[f] !== undefined);
const header = urut.map((f) => MAPPING_TEMPLATE[f] ?? f);
const baris = DATA.map((b) => urut.map((f) => b[f] ?? ""));
// Baris kosong di tengah data menguji pembuangan baris kosong.
baris.splice(5, 0, urut.map(() => ""));

const lembar = XLSX.utils.aoa_to_sheet([header, ...baris]);
const buku = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(buku, lembar, "Warga");
const tujuan = "docs/data-contoh/warga-contoh.xlsx";
mkdirSync(dirname(tujuan), { recursive: true });
XLSX.writeFile(buku, tujuan);
console.log(`Ditulis ${tujuan}: ${DATA.length} baris data`);
