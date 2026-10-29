import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { z } from "zod";
import { JudulHalaman } from "@/components/judul-halaman";
import { StatusBadge } from "@/components/status-badge";
import { catatAktivitas } from "@/lib/activity-log";
import { requireRole } from "@/lib/auth";
import { ambilKk } from "@/lib/data/kk";
import { maskNomor } from "@/lib/mask";
import { PENGURUS } from "@/lib/navigasi";
import { TombolHapusKk } from "../tombol-hapus-kk";

const HUBUNGAN: Record<string, string> = {
  KEPALA_KELUARGA: "Kepala Keluarga", ISTRI: "Istri", SUAMI: "Suami", ANAK: "Anak", MENANTU: "Menantu",
  CUCU: "Cucu", ORANG_TUA: "Orang tua", MERTUA: "Mertua", FAMILI_LAIN: "Famili lain", LAINNYA: "Lainnya",
};
const STATUS = { AKTIF: "Aktif", PINDAH: "Pindah", MENINGGAL: "Meninggal" } as const;

export default async function DetailKk({ params }: PageProps<"/kk/[id]">) {
  const user = await requireRole(...PENGURUS);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const kk = await ambilKk(user, id);
  if (!kk) notFound();
  // Pembukaan detail (No KK tampil penuh) dicatat dengan id entitas saja.
  await catatAktivitas({ userId: user.id, aksi: "KK_DIBUKA", entitas: "kartu_keluarga", entitasId: kk.id });

  const adaKepala = kk.warga.some((w) => w.hubungan_keluarga === "KEPALA_KELUARGA" && w.status_kependudukan === "AKTIF");
  const aktif = kk.warga.filter((w) => w.status_kependudukan === "AKTIF").length;
  const anggota = [...kk.warga].sort(
    (a, b) => Number(b.hubungan_keluarga === "KEPALA_KELUARGA") - Number(a.hubungan_keluarga === "KEPALA_KELUARGA"),
  );

  return (
    <>
      <nav aria-label="Jejak halaman" className="mb-2 text-sm text-teks-sekunder">
        <Link href="/kk" className="text-teal underline">Data KK</Link> › Detail KK
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <JudulHalaman judul={`KK ${kk.no_kk}`} deskripsi={`${kk.alamat}, RT ${kk.wilayah.rt}/RW ${kk.wilayah.rw}`} />
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/kk/${kk.id}/ubah`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 font-semibold text-teks">
            <Pencil className="size-5" aria-hidden /> Ubah
          </Link>
          <TombolHapusKk id={kk.id} teks="Hapus KK" tujuan="/kk" />
        </div>
      </div>

      {!adaKepala && (
        <p role="status" className="mb-4 rounded-lg bg-peringatan-latar px-4 py-3 text-peringatan">
          KK ini belum punya kepala keluarga aktif.
        </p>
      )}

      <section className="mb-6 rounded-xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-teks">Data KK</h2>
        <dl className="grid gap-3 text-[15px] md:grid-cols-3">
          {[
            ["Desa/Kelurahan", kk.desa_kelurahan],
            ["Kecamatan", kk.kecamatan],
            ["Kabupaten/Kota", kk.kabupaten_kota],
            ["Provinsi", kk.provinsi],
            ["Kode pos", kk.kode_pos],
            ["Anggota aktif", String(aktif)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-teks-sekunder">{k}</dt>
              <dd className="font-semibold text-teks">{v || "-"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 p-5">
          <h2 className="text-lg font-bold text-teks">Anggota keluarga</h2>
          <Link href={`/kk/${kk.id}/ubah`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90">
            <Plus className="size-5" aria-hidden /> Tambah Anggota
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <caption className="sr-only">Anggota keluarga</caption>
            <thead className="border-y border-border text-sm text-teks-sekunder">
              <tr>
                {["Nama", "NIK", "Hubungan", "Tanggal lahir", "Status"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anggota.map((w) => (
                <tr key={w.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold">{w.nama_lengkap}</td>
                  <td className="px-4 py-3 font-mono">{maskNomor(w.nik)}</td>
                  <td className="px-4 py-3">{HUBUNGAN[w.hubungan_keluarga]}</td>
                  <td className="px-4 py-3">{w.tanggal_lahir.toLocaleDateString("id-ID", { timeZone: "UTC", dateStyle: "long" })}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.status_kependudukan === "AKTIF" ? "aktif" : "nonaktif"} label={STATUS[w.status_kependudukan]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
