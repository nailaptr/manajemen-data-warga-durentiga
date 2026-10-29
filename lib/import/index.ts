import { bentukKk, tetapkanKepalaPertama } from "./group";
import { kunci, normalisasiBaris, petakan } from "./normalize";
import type { BarisHasil, HasilParse, KkImpor, Mapping, MasterImpor } from "./types";
import { validasiFile } from "./validate";

export interface NilaiTakDikenal {
  nilai: string;
  jumlah: number;
}

export interface HasilImpor {
  baris: BarisHasil[];
  kk: KkImpor[];
  ringkasan: { total: number; valid: number; peringatan: number; error: number; jumlahKk: number };
  // Nilai pendidikan/pekerjaan yang tak dikenali, untuk dipetakan manual sekali di preview (PRD 7.3).
  tidakDikenal: { pendidikan: NilaiTakDikenal[]; pekerjaan: NilaiTakDikenal[] };
}

// Nilai sama (tanpa pandang huruf besar/kecil dan spasi) dihitung satu; teks yang ditampilkan = kemunculan pertama.
function hitungUnik(nilai: (string | undefined)[]): NilaiTakDikenal[] {
  const hasil = new Map<string, NilaiTakDikenal>();
  for (const n of nilai) {
    if (!n) continue;
    const ada = hasil.get(kunci(n));
    if (ada) ada.jumlah += 1;
    else hasil.set(kunci(n), { nilai: n, jumlah: 1 });
  }
  return [...hasil.values()];
}

// Alur murni: pemetaan -> normalisasi -> (opsional) kepala keluarga pertama -> validasi -> kelompok per No KK.
export function prosesImpor(
  hasil: HasilParse,
  mapping: Mapping,
  master: MasterImpor,
  hariIni: string,
  opsi: { kepalaPertama?: boolean } = {},
): HasilImpor {
  const normal = petakan(hasil, mapping).map((b) => normalisasiBaris(b, master));
  const baris = validasiFile(opsi.kepalaPertama ? tetapkanKepalaPertama(normal) : normal, master, hariIni);
  const hitung = (s: BarisHasil["status"]) => baris.filter((b) => b.status === s).length;
  const kk = bentukKk(baris);
  return {
    baris,
    kk,
    ringkasan: { total: baris.length, valid: hitung("valid"), peringatan: hitung("peringatan"), error: hitung("error"), jumlahKk: kk.length },
    tidakDikenal: {
      pendidikan: hitungUnik(normal.filter((b) => !b.pendidikan_id).map((b) => b.mentah.pendidikan)),
      pekerjaan: hitungUnik(normal.filter((b) => !b.pekerjaan_id).map((b) => b.mentah.pekerjaan)),
    },
  };
}
