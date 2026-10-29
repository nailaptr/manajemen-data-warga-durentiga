import type { BarisHasil, BarisNormal, KkImpor } from "./types";

// Kelompokkan baris menurut No KK, urutan kemunculan dipertahankan. Baris dengan No KK kosong dilewati.
export function kelompokkan<T>(baris: readonly T[], noKk: (b: T) => string): Map<string, T[]> {
  const hasil = new Map<string, T[]>();
  for (const b of baris) {
    const kunci = noKk(b);
    if (!kunci) continue;
    const grup = hasil.get(kunci);
    if (grup) grup.push(b);
    else hasil.set(kunci, [b]);
  }
  return hasil;
}

// PRD 7.2: bila kolom Hubungan keluarga tidak ada, anggota pertama tiap No KK dianggap Kepala Keluarga
// (anggota lain LAINNYA) dan admin memeriksanya di preview. Baris yang kolom hubungannya ada tidak diubah.
export function tetapkanKepalaPertama(baris: readonly BarisNormal[]): BarisNormal[] {
  const sudahAdaKepala = new Set<string>();
  return baris.map((b) => {
    if (b.mentah.hubungan_keluarga !== undefined) return b;
    const kepala = !sudahAdaKepala.has(b.no_kk);
    sudahAdaKepala.add(b.no_kk);
    return { ...b, hubungan_keluarga: kepala ? "KEPALA_KELUARGA" : "LAINNYA" };
  });
}

// Bentuk KK dari baris yang bisa diimpor (tanpa Error). Alamat dan wilayah diambil dari baris pertama tiap No KK.
export function bentukKk(baris: readonly BarisHasil[]): KkImpor[] {
  const bisaDiimpor = baris.filter((b) => b.status !== "error");
  return [...kelompokkan(bisaDiimpor, (b) => b.data.no_kk).entries()].map(([no_kk, anggota]) => {
    const d = anggota[0]?.data;
    return {
      no_kk,
      alamat: d?.alamat ?? "",
      rt: d?.rt ?? "",
      rw: d?.rw ?? "",
      desa_kelurahan: d?.desa_kelurahan ?? "",
      kecamatan: d?.kecamatan ?? "",
      kabupaten_kota: d?.kabupaten_kota ?? "",
      provinsi: d?.provinsi ?? "",
      kode_pos: d?.kode_pos ?? "",
      anggota,
    };
  });
}
