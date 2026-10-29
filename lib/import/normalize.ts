import { AGAMA, GOLONGAN_DARAH, HUBUNGAN, STATUS_PERKAWINAN } from "../validators/kk";
import {
  FIELD_IMPOR,
  type Agama,
  type BarisMentah,
  type BarisNormal,
  type FieldImpor,
  type GolonganDarah,
  type HasilParse,
  type Hubungan,
  type Mapping,
  type MasterImpor,
  type OpsiMaster,
  type StatusPerkawinan,
} from "./types";

// Nama kolom pada template PRD 7.2; dipakai sebagai pemetaan awal bila file memakai template.
export const MAPPING_TEMPLATE: Mapping = {
  no_kk: "No KK", nik: "NIK", nama_lengkap: "Nama lengkap", jenis_kelamin: "Jenis kelamin",
  tanggal_lahir: "Tanggal lahir", hubungan_keluarga: "Hubungan keluarga", tempat_lahir: "Tempat lahir",
  agama: "Agama", pendidikan: "Pendidikan", pekerjaan: "Pekerjaan", golongan_darah: "Golongan darah",
  status_perkawinan: "Status perkawinan", alamat: "Alamat", rt: "RT", rw: "RW", desa_kelurahan: "Desa",
  kecamatan: "Kecamatan", kabupaten_kota: "Kab/Kota", provinsi: "Provinsi", kode_pos: "Kode pos",
};

export const kunci = (teks: string) => teks.trim().replace(/\s+/g, " ").toLowerCase();

// Menerapkan pemetaan kolom ke baris hasil parse. Header dicocokkan tanpa pandang huruf besar/kecil.
export function petakan(hasil: HasilParse, mapping: Mapping): BarisMentah[] {
  const indeks = new Map<string, number>();
  hasil.header.forEach((h, i) => {
    if (!indeks.has(kunci(h))) indeks.set(kunci(h), i);
  });
  const kolom = FIELD_IMPOR.flatMap((f) => {
    const header = mapping[f];
    const i = header === undefined ? undefined : indeks.get(kunci(header));
    return i === undefined ? [] : [[f, i] as const];
  });
  return hasil.baris.map(({ nomor, sel }) => ({
    nomor,
    nilai: Object.fromEntries(kolom.map(([f, i]) => [f, sel[i] ?? ""])),
  }));
}

const SERIAL_EXCEL_AWAL = Date.UTC(1899, 11, 30);
const HARI_MS = 86_400_000;

function iso(tahun: number, bulan: number, hari: number): string | null {
  const d = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (d.getUTCFullYear() !== tahun || d.getUTCMonth() !== bulan - 1 || d.getUTCDate() !== hari) return null;
  return d.toISOString().slice(0, 10);
}

// Menerima: nomor seri Excel, dd/mm/yyyy (juga - atau .), dan yyyy-mm-dd (juga /). Selain itu null.
export function normalisasiTanggal(teks: string): string | null {
  const t = teks.trim();
  if (/^\d+(\.\d+)?$/.test(t)) {
    const seri = Math.floor(Number(t));
    // Rentang seri 1 (1900) sampai 73050 (2099); angka 8 digit seperti 19900101 sengaja ditolak.
    if (seri < 1 || seri > 73_050) return null;
    return new Date(SERIAL_EXCEL_AWAL + seri * HARI_MS).toISOString().slice(0, 10);
  }
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (ymd) return iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (dmy) return iso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  return null;
}

const LAKI = new Set(["l", "lk", "laki-laki", "laki laki", "lakilaki", "laki", "pria", "male", "m"]);
const PEREMPUAN = new Set(["p", "pr", "perempuan", "wanita", "female", "w", "f"]);

export function normalisasiJenisKelamin(teks: string): "L" | "P" | null {
  const k = kunci(teks);
  return LAKI.has(k) ? "L" : PEREMPUAN.has(k) ? "P" : null;
}

// RT/RW: "1", "01", "RT 01", "RW.003" menjadi "001"/"003". Bila bukan 1-3 digit, teks aslinya dikembalikan agar
// validasi bisa menolaknya.
export function normalisasiRtRw(teks: string): string {
  const t = teks.trim();
  const angka = /^(?:r[tw]\.?\s*)?(\d{1,3})$/i.exec(t);
  return angka?.[1] ? angka[1].padStart(3, "0") : t;
}

function dariDaftar<T extends string>(daftar: readonly T[], teks: string, alias: Record<string, T> = {}): T | null {
  const k = kunci(teks).replace(/[\s_-]+/g, "_").toUpperCase();
  const langsung = daftar.find((d) => d === k);
  if (langsung) return langsung;
  return alias[kunci(teks)] ?? null;
}

const ALIAS_HUBUNGAN: Record<string, Hubungan> = {
  kepala: "KEPALA_KELUARGA", kk: "KEPALA_KELUARGA", "kepala keluarga": "KEPALA_KELUARGA",
  orangtua: "ORANG_TUA", "orang tua": "ORANG_TUA", famili: "FAMILI_LAIN", "famili lain": "FAMILI_LAIN",
  isteri: "ISTRI", lain: "LAINNYA", "lain-lain": "LAINNYA",
};
const ALIAS_AGAMA: Record<string, Agama> = {
  islam: "ISLAM", kristen: "KRISTEN", "kristen protestan": "KRISTEN", protestan: "KRISTEN", katolik: "KATOLIK",
  katholik: "KATOLIK", hindu: "HINDU", buddha: "BUDDHA", budha: "BUDDHA", konghucu: "KONGHUCU", khonghucu: "KONGHUCU",
};
const ALIAS_DARAH: Record<string, GolonganDarah> = {
  a: "A", b: "B", ab: "AB", o: "O", "tidak tahu": "TIDAK_TAHU",
};
const ALIAS_KAWIN: Record<string, StatusPerkawinan> = {
  "belum kawin": "BELUM_KAWIN", "belum menikah": "BELUM_KAWIN", kawin: "KAWIN", menikah: "KAWIN",
  "cerai hidup": "CERAI_HIDUP", "cerai mati": "CERAI_MATI",
};

// Mencocokkan teks dengan nama atau alias master (tanpa pandang huruf besar/kecil), lalu pemetaan manual.
export function cocokkanMaster(teks: string, master: OpsiMaster[], manual: Record<string, string> = {}): string | null {
  const k = kunci(teks);
  if (!k) return null;
  const manualId = manual[k];
  if (manualId) return manualId;
  return master.find((m) => kunci(m.nama) === k || m.alias.some((a) => kunci(a) === k))?.id ?? null;
}

export function normalisasiBaris(mentah: BarisMentah, master: MasterImpor): BarisNormal {
  const n = mentah.nilai;
  const v = (f: FieldImpor) => (n[f] ?? "").trim();
  return {
    nomor: mentah.nomor,
    mentah: n,
    no_kk: v("no_kk"),
    nik: v("nik"),
    nama_lengkap: v("nama_lengkap"),
    jenis_kelamin: normalisasiJenisKelamin(v("jenis_kelamin")),
    tanggal_lahir: normalisasiTanggal(v("tanggal_lahir")),
    hubungan_keluarga: dariDaftar(HUBUNGAN, v("hubungan_keluarga"), ALIAS_HUBUNGAN),
    tempat_lahir: v("tempat_lahir"),
    agama: dariDaftar(AGAMA, v("agama"), ALIAS_AGAMA),
    pendidikan_id: cocokkanMaster(v("pendidikan"), master.pendidikan, master.pemetaanManual?.pendidikan),
    pekerjaan_id: cocokkanMaster(v("pekerjaan"), master.pekerjaan, master.pemetaanManual?.pekerjaan),
    golongan_darah: dariDaftar(GOLONGAN_DARAH, v("golongan_darah"), ALIAS_DARAH),
    status_perkawinan: dariDaftar(STATUS_PERKAWINAN, v("status_perkawinan"), ALIAS_KAWIN),
    alamat: v("alamat"),
    rt: normalisasiRtRw(v("rt")),
    rw: normalisasiRtRw(v("rw")),
    desa_kelurahan: v("desa_kelurahan"),
    kecamatan: v("kecamatan"),
    kabupaten_kota: v("kabupaten_kota"),
    provinsi: v("provinsi"),
    kode_pos: v("kode_pos"),
  };
}
