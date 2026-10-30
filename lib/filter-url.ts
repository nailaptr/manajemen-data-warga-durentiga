import type { FilterStatistik } from "./filters";

// Bagian lib/filters.ts yang aman dipakai di browser (tanpa Prisma): filter menjadi query string URL.
// Urutan kunci tetap agar URL yang sama selalu berbentuk sama.
const KUNCI_DAFTAR = ["pendidikan", "pekerjaan", "jk", "kategori", "rt"] as const;

export type FilterUrl = Partial<FilterStatistik>;

export function filterKeQuery(f: FilterUrl): string {
  const p = new URLSearchParams();
  for (const k of KUNCI_DAFTAR) {
    const nilai = f[k];
    if (nilai?.length) p.set(k, nilai.join(","));
  }
  if (f.usia_min !== undefined) p.set("usia_min", String(f.usia_min));
  if (f.usia_max !== undefined) p.set("usia_max", String(f.usia_max));
  return p.toString();
}

export function adaFilter(f: FilterUrl): boolean {
  return filterKeQuery(f) !== "";
}
