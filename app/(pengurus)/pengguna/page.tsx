import { ClipboardCheck, UserCheck, Users } from "lucide-react";
import { FilterChip } from "@/components/filter-chip";
import { JudulHalaman } from "@/components/judul-halaman";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { daftarRt } from "@/lib/data/kk";
import { daftarKlaim, daftarPengurus, statistikPengguna } from "@/lib/data/pengguna";
import { ADMIN, NAMA_PERAN } from "@/lib/navigasi";
import { AntreanKlaim } from "./antrean-klaim";
import { TabelPengurus } from "./tabel-pengurus";

function satu(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function href(q?: string, peran?: string): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (peran) p.set("peran", peran);
  const s = p.toString();
  return s ? `/pengguna?${s}` : "/pengguna";
}

export default async function Pengguna({ searchParams }: PageProps<"/pengguna">) {
  const user = await requireRole(...ADMIN);
  const sp = await searchParams;
  const q = satu(sp.q);
  const peranParam = satu(sp.peran);
  const peran = peranParam === "ADMIN_RW" || peranParam === "KETUA_RT" ? peranParam : undefined;
  const superAdmin = user.role === "SUPER_ADMIN";

  const [stat, pengurus, klaim, wilayah] = await Promise.all([
    statistikPengguna(user),
    daftarPengurus(user, { q, role: peran }),
    daftarKlaim(user),
    daftarRt(user),
  ]);
  const kelasInput = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-teks";

  return (
    <>
      <JudulHalaman judul="Manajemen Pengguna" deskripsi="Kelola akun pengurus dan verifikasi akun warga." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Akun pengurus" nilai={String(stat.pengurus)} ikon={<Users className="size-6" />} />
        <StatCard label="Akun warga aktif" nilai={String(stat.wargaAktif)} ikon={<UserCheck className="size-6" />} />
        <StatCard label="Klaim akun menunggu" nilai={String(stat.klaimMenunggu)} ikon={<ClipboardCheck className="size-6" />} />
      </div>

      <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-teks">Akun pengurus</h2>
        <form method="get" action="/pengguna" className="mb-4 flex flex-wrap items-center gap-3">
          <input type="search" name="q" defaultValue={q} aria-label="Cari nama atau email" placeholder="Cari nama atau email" className={`${kelasInput} min-w-64 flex-1`} />
          {superAdmin && (
            <select name="peran" defaultValue={peran ?? ""} aria-label="Filter peran" className={kelasInput}>
              <option value="">Semua peran</option>
              <option value="ADMIN_RW">{NAMA_PERAN.ADMIN_RW}</option>
              <option value="KETUA_RT">{NAMA_PERAN.KETUA_RT}</option>
            </select>
          )}
          <button type="submit" className="min-h-11 rounded-lg bg-teal px-5 font-semibold text-white">Terapkan</button>
        </form>
        {(q || peran) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {q && <FilterChip label={`Cari: ${q}`} hrefHapus={href(undefined, peran)} />}
            {peran && <FilterChip label={NAMA_PERAN[peran]} hrefHapus={href(q)} />}
          </div>
        )}
        <TabelPengurus data={pengurus} wilayah={wilayah} superAdmin={superAdmin} />
      </section>

      <AntreanKlaim data={klaim} />
    </>
  );
}
