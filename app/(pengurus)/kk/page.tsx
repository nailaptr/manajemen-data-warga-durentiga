import Link from "next/link";
import { Home, Plus, TriangleAlert, Users } from "lucide-react";
import { FilterChip } from "@/components/filter-chip";
import { JudulHalaman } from "@/components/judul-halaman";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { daftarKk, daftarRt, statistikKk } from "@/lib/data/kk";
import { PENGURUS } from "@/lib/navigasi";
import { TabelKk } from "./tabel-kk";

const UKURAN = 10;

function satu(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function href(q?: string, rt?: string): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (rt) p.set("rt", rt);
  const s = p.toString();
  return s ? `/kk?${s}` : "/kk";
}

export default async function DataKk({ searchParams }: PageProps<"/kk">) {
  const user = await requireRole(...PENGURUS);
  const sp = await searchParams;
  const q = satu(sp.q);
  const rt = satu(sp.rt);
  const halaman = Math.max(1, Number.parseInt(satu(sp.halaman) ?? "1", 10) || 1);

  const [stat, hasil, rtOpsi] = await Promise.all([
    statistikKk(user),
    daftarKk(user, { q, rt, halaman, ukuran: UKURAN }),
    daftarRt(user),
  ]);
  const kelasInput = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-teks";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <JudulHalaman judul="Data KK" deskripsi="Kartu Keluarga dan anggotanya dalam cakupan Anda." />
        <Link href="/kk/baru" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90">
          <Plus className="size-5" aria-hidden /> Tambah KK
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total KK" nilai={String(stat.totalKk)} ikon={<Home className="size-6" />} />
        <StatCard label="Anggota keluarga aktif" nilai={String(stat.anggotaAktif)} ikon={<Users className="size-6" />} />
        <StatCard label="KK tanpa kepala keluarga" nilai={String(stat.tanpaKepala)} ikon={<TriangleAlert className="size-6" />} />
      </div>

      <form method="get" action="/kk" className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Cari No KK, kepala keluarga, alamat"
          placeholder="Cari No KK, kepala keluarga, alamat"
          className={`${kelasInput} min-w-64 flex-1`}
        />
        <select name="rt" defaultValue={rt ?? ""} aria-label="Filter RT" className={kelasInput}>
          <option value="">Semua RT</option>
          {[...new Set(rtOpsi.map((w) => w.rt))].map((r) => (
            <option key={r} value={r}>RT {r}</option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-lg bg-teal px-5 font-semibold text-white">Terapkan</button>
      </form>

      {(q || rt) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {q && <FilterChip label={`Cari: ${q}`} hrefHapus={href(undefined, rt)} />}
          {rt && <FilterChip label={`RT ${rt}`} hrefHapus={href(q)} />}
        </div>
      )}

      <TabelKk data={hasil.baris} total={hasil.total} halaman={halaman} ukuranHalaman={UKURAN} />
    </>
  );
}
