import Link from "next/link";
import { ArrowLeft, Download, Search } from "lucide-react";
import { ChipFilterAktif } from "@/components/chip-filter-aktif";
import { FilterStatistik } from "@/components/filter-statistik";
import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { BATAS_EXPORT } from "@/lib/data/export";
import { daftarRtCakupan, daftarWargaTerfilter } from "@/lib/data/stats";
import { adaFilter, filterKeQuery, type FilterUrl } from "@/lib/filter-url";
import { muatMaster, susunFilterUi } from "@/lib/filter-ui";
import { parseFilter } from "@/lib/filters";
import { formatAngka } from "@/lib/format";
import { PENGURUS } from "@/lib/navigasi";
import { HasilWarga } from "./hasil-warga";

const UKURAN = 25;
const MAKS_Q = 100;

const satu = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const kelasTombol =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border border-teal bg-white px-4 font-semibold text-teal hover:bg-teal-muda focus-visible:outline-2 focus-visible:outline-teal";

// Cari Warga (PRD 4.6): filter dan query yang sama dengan Dashboard, ditambah pencarian teks bebas.
export default async function CariWarga({ searchParams }: PageProps<"/cari-warga">) {
  const user = await requireRole(...PENGURUS);
  const sp = await searchParams;
  const hasil = parseFilter(sp);
  const galatFilter = hasil.ok ? null : hasil.galat;
  const parsed: FilterUrl = hasil.ok ? hasil.filter : {};
  // Ketua RT terkunci pada RT-nya: scopeWhere sudah membatasi data, parameter rt dibuang agar chip dan tautan bersih.
  const terkunci = user.role === "KETUA_RT";
  const filter: FilterUrl = terkunci ? { ...parsed, rt: [] } : parsed;
  const q = satu(sp.q)?.slice(0, MAKS_Q);
  const halaman = Math.max(1, Number.parseInt(satu(sp.halaman) ?? "1", 10) || 1);

  const [daftar, master, rt] = await Promise.all([
    daftarWargaTerfilter(user, filter, { halaman, ukuran: UKURAN, q }),
    muatMaster(),
    daftarRtCakupan(user),
  ]);

  const queryFilter = filterKeQuery(filter);
  const tambahan = q ? new URLSearchParams({ q }).toString() : undefined;
  const { opsi, chip } = susunFilterUi({ basePath: "/cari-warga", filter, master, rt, tambahan });
  const chipLengkap = q
    ? [{ label: `Cari: ${q}`, href: queryFilter ? `/cari-warga?${queryFilter}` : "/cari-warga" }, ...chip]
    : chip;

  const linkDashboard = `/dashboard${adaFilter(filter) ? `?${queryFilter}` : ""}`;
  const queryExport = [queryFilter, tambahan].filter(Boolean).join("&");
  const bolehExport = daftar.total > 0 && daftar.total <= BATAS_EXPORT;
  const linkExport = (format: "xlsx" | "csv") => `/api/export?format=${format}${queryExport ? `&${queryExport}` : ""}`;

  return (
    <>
      <JudulHalaman judul="Cari Warga" deskripsi="Hasil pencarian dan filter. NIK dan No KK dimasking di tabel." />

      <div className="mb-4">
        <Link href={linkDashboard} className={kelasTombol}>
          <ArrowLeft className="size-5" aria-hidden /> Kembali ke dashboard
        </Link>
      </div>

      <form method="get" action="/cari-warga" className="mb-4 flex flex-wrap items-center gap-3">
        {Object.entries(Object.fromEntries(new URLSearchParams(queryFilter))).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={MAKS_Q}
          aria-label="Cari nama, NIK, atau No KK"
          placeholder="Cari nama, NIK, atau No KK"
          className="min-h-11 min-w-64 flex-1 rounded-lg border border-border bg-card px-3 text-base text-teks focus-visible:outline-2 focus-visible:outline-teal"
        />
        <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-5 font-semibold text-white">
          <Search className="size-5" aria-hidden /> Cari
        </button>
      </form>

      <FilterStatistik
        basePath="/cari-warga"
        filter={filter}
        opsi={opsi}
        rtTerkunci={terkunci}
        tambahan={tambahan}
        chip={<ChipFilterAktif chip={chipLengkap} galat={galatFilter} />}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold text-teks" aria-live="polite">
          {formatAngka(daftar.total)} warga ditemukan
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {bolehExport ? (
            <>
              <a href={linkExport("xlsx")} className={kelasTombol}>
                <Download className="size-5" aria-hidden /> Export Excel
              </a>
              <a href={linkExport("csv")} className={kelasTombol}>
                <Download className="size-5" aria-hidden /> Export CSV
              </a>
            </>
          ) : (
            daftar.total > BATAS_EXPORT && (
              <p role="status" className="text-sm text-peringatan">
                Export dibatasi {formatAngka(BATAS_EXPORT)} baris per file. Persempit filter.
              </p>
            )
          )}
        </div>
      </div>

      <div className="mt-3">
        <HasilWarga data={daftar.baris} total={daftar.total} halaman={halaman} ukuranHalaman={UKURAN} />
      </div>
    </>
  );
}
