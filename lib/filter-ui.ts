import { daftarKategoriUsia, daftarPekerjaan, daftarPendidikan } from "./data/pengaturan";
import { filterKeQuery, type FilterUrl } from "./filter-url";
import type { OpsiFilter } from "../components/filter-statistik";

// Penyusun pilihan dan chip untuk FilterStatistik; dipakai Dashboard dan Cari Warga agar tidak ada salinan.
export const dua = (kode: string) => String(Number(kode)).padStart(2, "0");
export const labelRt = (rt: string) => `RT ${dua(rt)}`;

export function labelKategori(k: { nama: string; usia_min: number; usia_maks: number | null }): string {
  return k.usia_maks === null ? `${k.nama} (${k.usia_min}+ th)` : `${k.nama} (${k.usia_min}–${k.usia_maks} th)`;
}

export async function muatMaster() {
  const [pendidikan, pekerjaan, kategori] = await Promise.all([daftarPendidikan(), daftarPekerjaan(), daftarKategoriUsia()]);
  return { pendidikan, pekerjaan, kategori };
}

export type MasterFilter = Awaited<ReturnType<typeof muatMaster>>;

export interface ChipFilter {
  label: string;
  href: string;
}

interface Param {
  basePath: string;
  filter: FilterUrl;
  master: MasterFilter;
  rt: { rw: string; rt: string }[];
  // Query tambahan yang ikut dipertahankan saat filter berubah, mis. "q=budi".
  tambahan?: string;
}

export function susunFilterUi({ basePath, filter, master, rt, tambahan }: Param): { opsi: OpsiFilter; chip: ChipFilter[] } {
  const rwUnik = new Set(rt.map((r) => r.rw));
  const labelRtDaftar = (r: { rw: string; rt: string }) => (rwUnik.size > 1 ? `RW ${dua(r.rw)} · ${labelRt(r.rt)}` : labelRt(r.rt));
  const opsi: OpsiFilter = {
    pendidikan: master.pendidikan.map((p) => ({ nilai: p.id, label: p.nama })),
    pekerjaan: master.pekerjaan.map((p) => ({ nilai: p.id, label: p.nama })),
    kategori: master.kategori.map((k) => ({ nilai: k.id, label: labelKategori(k) })),
    rt: [...new Map(rt.map((r) => [r.rt, { nilai: r.rt, label: labelRtDaftar(r) }])).values()],
  };

  const namaDari = (daftarOpsi: { nilai: string; label: string }[], ids: string[] = []) =>
    daftarOpsi.filter((o) => ids.includes(o.nilai)).map((o) => o.label).join(", ");
  const tanpa = (bagian: Partial<FilterUrl>) => {
    const q = [filterKeQuery({ ...filter, ...bagian }), tambahan].filter(Boolean).join("&");
    return q ? `${basePath}?${q}` : basePath;
  };
  const chip = [
    filter.pendidikan?.length && { label: `Pendidikan: ${namaDari(opsi.pendidikan, filter.pendidikan)}`, href: tanpa({ pendidikan: [] }) },
    filter.pekerjaan?.length && { label: `Pekerjaan: ${namaDari(opsi.pekerjaan, filter.pekerjaan)}`, href: tanpa({ pekerjaan: [] }) },
    filter.jk?.length && { label: `Jenis kelamin: ${filter.jk.map((j) => (j === "L" ? "Laki-laki" : "Perempuan")).join(", ")}`, href: tanpa({ jk: [] }) },
    filter.kategori?.length && { label: `Kategori: ${master.kategori.filter((k) => filter.kategori?.includes(k.id)).map((k) => k.nama).join(", ") || "tidak ditemukan"}`, href: tanpa({ kategori: [] }) },
    (filter.usia_min !== undefined || filter.usia_max !== undefined) && {
      label: `Usia ${filter.usia_min ?? 0}–${filter.usia_max ?? "…"}`,
      href: tanpa({ usia_min: undefined, usia_max: undefined }),
    },
    filter.rt?.length && { label: `RT: ${filter.rt.map(labelRt).join(", ")}`, href: tanpa({ rt: [] }) },
  ].filter((c): c is ChipFilter => Boolean(c));
  return { opsi, chip };
}
