import { nikCocokTanggalLahir } from "../nik";
import { kelompokkan } from "./group";
import type { BarisHasil, BarisNormal, FieldImpor, MasterImpor, StatusBaris, Temuan } from "./types";

// Aturan PRD 7.4. Error: baris tidak diimpor. Peringatan: baris tetap diimpor dan ditandai.
const error = (field: FieldImpor, pesan: string): Temuan => ({ level: "error", field, pesan });
const peringatan = (field: FieldImpor | undefined, pesan: string): Temuan => ({ level: "peringatan", field, pesan });

// 3.17E+15, 3,17E+15: Excel sudah membuang digit akhir, tidak bisa dipulihkan (PRD 7.3).
// Pesan Error disimpan di import_batches: tanpa NIK, No KK, atau tanggal lahir dari file.
const NOTASI_ILMIAH = /^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i;
const ENAM_BELAS_DIGIT = /^\d{16}$/;

function cekNomor16(field: "no_kk" | "nik", label: string, nilai: string): Temuan[] {
  if (ENAM_BELAS_DIGIT.test(nilai)) return [];
  if (NOTASI_ILMIAH.test(nilai)) {
    return [error(field, `${label} terbaca notasi ilmiah, digit akhir hilang. Ubah format kolom menjadi Teks di Excel, lalu isi ulang`)];
  }
  return [error(field, nilai ? `${label} bukan 16 digit` : `${label} kosong`)];
}

const kosong = (teks: string | undefined) => !teks || teks === "-";

// Peringatan untuk kolom enum opsional yang berisi teks tak dikenal: nilainya akan dikosongkan saat impor.
function cekOpsional(field: FieldImpor, label: string, mentah: string | undefined, hasil: unknown): Temuan[] {
  return kosong(mentah) || hasil !== null ? [] : [peringatan(field, `${label} "${mentah}" tidak dikenali dan akan dikosongkan`)];
}

export function validasiBaris(b: BarisNormal, master: MasterImpor, hariIni: string): Temuan[] {
  const t: Temuan[] = [];
  t.push(...cekNomor16("no_kk", "No KK", b.no_kk), ...cekNomor16("nik", "NIK", b.nik));
  if (!b.nama_lengkap) t.push(error("nama_lengkap", "Nama kosong"));
  else if (b.nama_lengkap.length > 100) t.push(error("nama_lengkap", "Nama lebih dari 100 karakter"));

  if (!b.mentah.tanggal_lahir) t.push(error("tanggal_lahir", "Tanggal lahir kosong"));
  else if (!b.tanggal_lahir) t.push(error("tanggal_lahir", "Tanggal lahir tidak terbaca"));
  else if (b.tanggal_lahir > hariIni) t.push(error("tanggal_lahir", "Tanggal lahir di masa depan"));

  if (!b.mentah.jenis_kelamin) t.push(error("jenis_kelamin", "Jenis kelamin kosong"));
  else if (!b.jenis_kelamin) t.push(error("jenis_kelamin", `Jenis kelamin "${b.mentah.jenis_kelamin}" tidak dikenali`));

  if (!b.hubungan_keluarga) {
    t.push(error("hubungan_keluarga", b.mentah.hubungan_keluarga ? `Hubungan keluarga "${b.mentah.hubungan_keluarga}" tidak dikenali` : "Hubungan keluarga kosong"));
  }

  const rtRwValid = /^\d{3}$/.test(b.rt) && /^\d{3}$/.test(b.rw);
  if (!/^\d{3}$/.test(b.rt)) t.push(error("rt", b.rt ? `RT "${b.rt}" tidak valid` : "RT kosong"));
  if (!/^\d{3}$/.test(b.rw)) t.push(error("rw", b.rw ? `RW "${b.rw}" tidak valid` : "RW kosong"));
  if (rtRwValid && !master.wilayah.some((w) => w.rw === b.rw && w.rt === b.rt)) {
    t.push(peringatan("rt", `RT ${b.rt}/RW ${b.rw} belum ada di master`));
  }

  if (ENAM_BELAS_DIGIT.test(b.nik) && b.tanggal_lahir && b.jenis_kelamin && nikCocokTanggalLahir(b.nik, b.tanggal_lahir, b.jenis_kelamin) === false) {
    t.push(peringatan("nik", "NIK tidak cocok dengan tanggal lahir dan jenis kelamin"));
  }

  for (const [field, label, id] of [["pendidikan", "Pendidikan", b.pendidikan_id], ["pekerjaan", "Pekerjaan", b.pekerjaan_id]] as const) {
    if (id) continue;
    const mentah = b.mentah[field];
    t.push(peringatan(field, mentah ? `${label} "${mentah}" tidak dikenali` : `${label} kosong`));
  }
  t.push(
    ...cekOpsional("agama", "Agama", b.mentah.agama, b.agama),
    ...cekOpsional("golongan_darah", "Golongan darah", b.mentah.golongan_darah, b.golongan_darah),
    ...cekOpsional("status_perkawinan", "Status perkawinan", b.mentah.status_perkawinan, b.status_perkawinan),
  );
  return t;
}

function daftarBaris(nomor: number[]): string {
  return `baris ${nomor.join(", ")}`;
}

// Aturan yang butuh seluruh file: NIK ganda, lebih dari satu Kepala Keluarga per No KK, KK tanpa Kepala Keluarga.
function validasiAntarBaris(baris: readonly BarisNormal[]): Map<number, Temuan[]> {
  const hasil = new Map<number, Temuan[]>();
  const tambah = (nomor: number, temuan: Temuan) => hasil.set(nomor, [...(hasil.get(nomor) ?? []), temuan]);

  const perNik = kelompokkan(baris.filter((b) => ENAM_BELAS_DIGIT.test(b.nik)), (b) => b.nik);
  for (const grup of perNik.values()) {
    if (grup.length < 2) continue;
    for (const b of grup) {
      const lain = grup.filter((x) => x.nomor !== b.nomor).map((x) => x.nomor);
      tambah(b.nomor, error("nik", `NIK ganda di dalam file (${daftarBaris(lain)})`));
    }
  }

  for (const grup of kelompokkan(baris.filter((b) => ENAM_BELAS_DIGIT.test(b.no_kk)), (b) => b.no_kk).values()) {
    const kepala = grup.filter((b) => b.hubungan_keluarga === "KEPALA_KELUARGA");
    if (kepala.length === 0) {
      const [pertama] = grup;
      if (pertama) tambah(pertama.nomor, peringatan("hubungan_keluarga", "KK tidak punya Kepala Keluarga"));
    }
    if (kepala.length > 1) {
      for (const b of kepala) {
        const lain = kepala.filter((x) => x.nomor !== b.nomor).map((x) => x.nomor);
        tambah(b.nomor, error("hubungan_keluarga", `Lebih dari satu Kepala Keluarga dalam satu No KK (${daftarBaris(lain)})`));
      }
    }
  }
  return hasil;
}

export function statusDari(temuan: readonly Temuan[]): StatusBaris {
  if (temuan.some((t) => t.level === "error")) return "error";
  return temuan.length > 0 ? "peringatan" : "valid";
}

// hariIni: yyyy-mm-dd, dikirim dari luar agar fungsi tetap murni dan tes deterministik.
export function validasiFile(baris: readonly BarisNormal[], master: MasterImpor, hariIni: string): BarisHasil[] {
  const antarBaris = validasiAntarBaris(baris);
  return baris.map((data) => {
    const temuan = [...validasiBaris(data, master, hariIni), ...(antarBaris.get(data.nomor) ?? [])];
    return { data, temuan, status: statusDari(temuan) };
  });
}
