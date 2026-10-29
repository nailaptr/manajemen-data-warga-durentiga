import { FilterChip } from "@/components/filter-chip";
import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { opsiMaster } from "@/lib/data/kk";
import { daftarWarga, type FilterWarga } from "@/lib/data/warga";
import { ADMIN, PENGURUS } from "@/lib/navigasi";
import { DaftarWarga } from "./daftar-warga";

const UKURAN = 10;
const STATUS = { AKTIF: "Aktif", PINDAH: "Pindah", MENINGGAL: "Meninggal" } as const;

function satu(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function href(q?: string, status?: string): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (status) p.set("status", status);
  const s = p.toString();
  return s ? `/warga?${s}` : "/warga";
}

export default async function DataWarga({ searchParams }: PageProps<"/warga">) {
  const user = await requireRole(...PENGURUS);
  const sp = await searchParams;
  const q = satu(sp.q);
  const st = satu(sp.status);
  const status = st && st in STATUS ? (st as FilterWarga["status"]) : undefined;
  const halaman = Math.max(1, Number.parseInt(satu(sp.halaman) ?? "1", 10) || 1);

  const [hasil, master] = await Promise.all([
    daftarWarga(user, { q, status, halaman, ukuran: UKURAN }),
    opsiMaster(),
  ]);
  const kelasInput = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-teks";

  return (
    <>
      <JudulHalaman judul="Data Warga" deskripsi="Warga dalam cakupan Anda. NIK dan No KK dimasking di tabel." />

      <form method="get" action="/warga" className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Cari nama, NIK, atau No KK"
          placeholder="Cari nama, NIK, atau No KK"
          className={`${kelasInput} min-w-64 flex-1`}
        />
        <select name="status" defaultValue={status ?? ""} aria-label="Filter status" className={kelasInput}>
          <option value="">Semua status</option>
          {Object.entries(STATUS).map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-lg bg-teal px-5 font-semibold text-white">Terapkan</button>
      </form>

      {(q || status) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {q && <FilterChip label={`Cari: ${q}`} hrefHapus={href(undefined, status)} />}
          {status && <FilterChip label={STATUS[status]} hrefHapus={href(q)} />}
        </div>
      )}

      <DaftarWarga
        data={hasil.baris}
        total={hasil.total}
        halaman={halaman}
        ukuranHalaman={UKURAN}
        master={master}
        bolehImport={(ADMIN as readonly string[]).includes(user.role)}
      />
    </>
  );
}
