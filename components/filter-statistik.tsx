"use client";

import { useOptimistic, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { filterKeQuery, type FilterUrl } from "@/lib/filter-url";
import { PilihanJamak, type OpsiPilihan } from "./pilihan-jamak";

export interface OpsiFilter {
  pendidikan: OpsiPilihan[];
  pekerjaan: OpsiPilihan[];
  kategori: OpsiPilihan[];
  rt: OpsiPilihan[];
}

interface Props {
  basePath: string;
  filter: FilterUrl;
  opsi: OpsiFilter;
  rtTerkunci?: boolean;
  chip: ReactNode;
  // Query non-filter yang dipertahankan saat filter berubah (Cari Warga: "q=budi").
  tambahan?: string;
}

const JK: OpsiPilihan[] = [
  { nilai: "L", label: "Laki-laki" },
  { nilai: "P", label: "Perempuan" },
];

const kolomUsia = "min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base text-teks focus-visible:outline-2 focus-visible:outline-teal";

// Kontrol filter statistik (PRD 6): satu-satunya sumber kebenaran adalah URL. Setiap perubahan
// mendorong URL baru; halaman server membacanya lagi lewat parseFilter.
export function FilterStatistik({ basePath, filter, opsi, rtTerkunci, chip, tambahan }: Props) {
  const router = useRouter();
  const [, mulaiPindah] = useTransition();
  const [aktif, setAktif] = useOptimistic(filter);
  const [usiaMin, setUsiaMin] = useState(filter.usia_min?.toString() ?? "");
  const [usiaMaks, setUsiaMaks] = useState(filter.usia_max?.toString() ?? "");
  const [galatUsia, setGalatUsia] = useState<string | null>(null);

  const terapkan = (baru: FilterUrl) => {
    mulaiPindah(() => {
      setAktif(baru);
      const q = [filterKeQuery(baru), tambahan].filter(Boolean).join("&");
      router.push(q ? `${basePath}?${q}` : basePath);
    });
  };

  const ubahDaftar = (kunci: "pendidikan" | "pekerjaan" | "jk" | "kategori" | "rt") => (nilai: string[]) =>
    terapkan({ ...aktif, [kunci]: nilai });

  const terapkanUsia = (e?: FormEvent) => {
    e?.preventDefault();
    const min = usiaMin.trim() === "" ? undefined : Number(usiaMin);
    const maks = usiaMaks.trim() === "" ? undefined : Number(usiaMaks);
    const tidakValid = (n: number | undefined) => n !== undefined && (!Number.isInteger(n) || n < 0 || n > 150);
    if (tidakValid(min) || tidakValid(maks)) return setGalatUsia("Usia harus bilangan bulat 0 sampai 150");
    if (min !== undefined && maks !== undefined && min > maks) return setGalatUsia("Usia minimal tidak boleh lebih besar dari usia maksimal");
    setGalatUsia(null);
    if (min === aktif.usia_min && maks === aktif.usia_max) return;
    terapkan({ ...aktif, usia_min: min, usia_max: maks });
  };

  return (
    <section aria-labelledby="judul-filter" className="rounded-xl bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="judul-filter" className="text-xl font-bold text-teks">
            Filter statistik
          </h2>
          <p className="mt-1 text-sm text-teks-sekunder">
            Beberapa pilihan dalam satu filter dihitung ATAU; antar filter dihitung DAN.
          </p>
        </div>
        <Link
          href={tambahan ? `${basePath}?${tambahan}` : basePath}
          className="inline-flex min-h-11 items-center rounded-lg border border-teal px-5 text-base font-semibold text-teal hover:bg-teal-muda focus-visible:outline-2 focus-visible:outline-teal"
        >
          Reset filter
        </Link>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PilihanJamak id="f-pendidikan" label="Pendidikan terakhir" semuaLabel="Semua pendidikan" opsi={opsi.pendidikan} terpilih={aktif.pendidikan ?? []} onUbah={ubahDaftar("pendidikan")} />
        <PilihanJamak id="f-pekerjaan" label="Pekerjaan" semuaLabel="Semua pekerjaan" opsi={opsi.pekerjaan} terpilih={aktif.pekerjaan ?? []} onUbah={ubahDaftar("pekerjaan")} />
        <PilihanJamak id="f-jk" label="Jenis kelamin" semuaLabel="Semua" opsi={JK} terpilih={aktif.jk ?? []} onUbah={ubahDaftar("jk")} />
        <PilihanJamak id="f-kategori" label="Kategori usia" semuaLabel="Semua kategori" opsi={opsi.kategori} terpilih={aktif.kategori ?? []} onUbah={ubahDaftar("kategori")} />

        <form onSubmit={terapkanUsia} className="sm:col-span-1">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-teks">Rentang usia (tahun)</legend>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={150}
                aria-label="Usia minimal"
                aria-invalid={galatUsia ? true : undefined}
                aria-describedby={galatUsia ? "galat-usia" : undefined}
                value={usiaMin}
                onChange={(e) => setUsiaMin(e.target.value)}
                onBlur={() => terapkanUsia()}
                className={kolomUsia}
              />
              <span aria-hidden>–</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={150}
                aria-label="Usia maksimal"
                aria-invalid={galatUsia ? true : undefined}
                aria-describedby={galatUsia ? "galat-usia" : undefined}
                value={usiaMaks}
                onChange={(e) => setUsiaMaks(e.target.value)}
                onBlur={() => terapkanUsia()}
                className={kolomUsia}
              />
            </div>
          </fieldset>
          {galatUsia && (
            <p id="galat-usia" role="alert" className="mt-1 text-sm text-galat">
              {galatUsia}
            </p>
          )}
        </form>

        <PilihanJamak
          id="f-rt"
          label={rtTerkunci ? "RT (terkunci)" : "RT"}
          semuaLabel={rtTerkunci ? (opsi.rt[0]?.label ?? "RT Anda") : "Semua RT"}
          opsi={rtTerkunci ? [] : opsi.rt}
          terpilih={rtTerkunci ? [] : (aktif.rt ?? [])}
          nonaktif={rtTerkunci}
          onUbah={ubahDaftar("rt")}
        />
      </div>

      {chip}
    </section>
  );
}
