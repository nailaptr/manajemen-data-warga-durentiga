import Link from "next/link";
import { JudulHalaman } from "@/components/judul-halaman";
import { StatusBadge, type StatusLencana } from "@/components/status-badge";
import { requireRole } from "@/lib/auth";
import { daftarAntrean, detailPengajuan, hitungPengajuan, STATUS_PENGAJUAN } from "@/lib/data/pengajuan";
import { PENGURUS } from "@/lib/navigasi";
import { PanelKeputusan } from "./panel-keputusan";

const TAB = [
  { id: "menunggu", status: "MENUNGGU", label: "Menunggu" },
  { id: "disetujui", status: "DISETUJUI", label: "Disetujui" },
  { id: "ditolak", status: "DITOLAK", label: "Ditolak" },
  { id: "dibatalkan", status: "DIBATALKAN", label: "Dibatalkan" },
] as const satisfies readonly { id: string; status: (typeof STATUS_PENGAJUAN)[number]; label: string }[];

const LENCANA: Record<(typeof STATUS_PENGAJUAN)[number], { status: StatusLencana; label: string }> = {
  MENUNGGU: { status: "menunggu", label: "Menunggu persetujuan" },
  DISETUJUI: { status: "disetujui", label: "Disetujui" },
  DITOLAK: { status: "ditolak", label: "Ditolak" },
  DIBATALKAN: { status: "nonaktif", label: "Dibatalkan" },
};

const singkat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
const lengkap = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Pengajuan({ searchParams }: PageProps<"/pengajuan">) {
  const user = await requireRole(...PENGURUS);
  const q = await searchParams;
  const tab = TAB.find((t) => t.id === satu(q.status)) ?? TAB[0];

  const [jumlah, antrean] = await Promise.all([hitungPengajuan(user), daftarAntrean(user, tab.status)]);
  const idPilihan = antrean.find((b) => b.id === satu(q.id))?.id ?? antrean[0]?.id;
  const detail = idPilihan ? await detailPengajuan(user, idPilihan) : null;

  return (
    <>
      <JudulHalaman judul="Pengajuan Perubahan" deskripsi="Periksa usulan perubahan data dari warga sebelum masuk ke data resmi" />

      <nav aria-label="Status pengajuan" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TAB.map((t) => (
          <Link
            key={t.id}
            href={`/pengajuan?status=${t.id}`}
            aria-current={t.id === tab.id ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 font-semibold ${
              t.id === tab.id ? "border-teal text-teal" : "border-transparent text-teks-sekunder hover:text-teks"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-2 text-sm ${t.id === tab.id ? "bg-teal text-white" : "bg-nonaktif-latar text-teks-sekunder"}`}>{jumlah[t.status]}</span>
          </Link>
        ))}
      </nav>

      {antrean.length === 0 ? (
        <p role="status" className="rounded-xl bg-white p-6 text-teks-sekunder shadow-sm">
          Tidak ada pengajuan {tab.label.toLowerCase()}.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul className="space-y-3">
            {antrean.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/pengajuan?status=${tab.id}&id=${b.id}`}
                  aria-current={b.id === idPilihan ? "true" : undefined}
                  className={`block rounded-xl border-2 bg-white p-4 shadow-sm ${b.id === idPilihan ? "border-teal bg-teal-muda" : "border-transparent"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-teal-muda px-3 py-0.5 text-sm font-semibold text-teal">{b.jenis}</span>
                    <span className="text-teks-sekunder">{singkat.format(b.tanggal)}</span>
                  </span>
                  <span className="mt-2 block font-bold text-teks">{b.nama}</span>
                  <span className="block text-teks-sekunder">
                    Diajukan oleh {b.pengaju} · RT {b.rt}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {detail && (
            <section aria-label="Detail pengajuan" className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="rounded-full bg-teal-muda px-3 py-1 text-sm font-semibold text-teal">{detail.jenis}</span>
                <StatusBadge {...LENCANA[detail.status]} />
              </div>
              <h2 className="mt-3 text-2xl font-bold text-teks">{detail.nama}</h2>
              <p className="text-teks-sekunder">
                KK {detail.noKk} · RT {detail.rt}/RW {detail.rw}
              </p>

              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                <dt className="text-teks-sekunder">Diajukan oleh</dt>
                <dd>{detail.pengaju}</dd>
                <dt className="text-teks-sekunder">Waktu</dt>
                <dd>{lengkap.format(detail.waktu)}</dd>
                {detail.catatan && (
                  <>
                    <dt className="text-teks-sekunder">Catatan warga</dt>
                    <dd>{detail.catatan}</dd>
                  </>
                )}
              </dl>

              <table className="mt-5 w-full text-left">
                <thead>
                  <tr className="text-sm uppercase tracking-wide text-teks-sekunder">
                    <th scope="col" className="py-2 pr-3">Data</th>
                    <th scope="col" className="py-2 pr-3">Saat ini</th>
                    <th scope="col" className="py-2">Usulan</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.perbedaan.map((r) => (
                    <tr key={r.label} className="border-t border-border">
                      <th scope="row" className="py-3 pr-3 font-semibold">{r.label}</th>
                      <td className="py-3 pr-3">
                        <span className="rounded bg-galat-latar px-2 py-1 text-galat line-through">{r.lama}</span>
                      </td>
                      <td className="py-3">
                        <span className="rounded bg-sukses-latar px-2 py-1 font-semibold text-sukses">{r.baru}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {detail.status === "MENUNGGU" && (
                <p
                  role={detail.konflik.length ? "alert" : "status"}
                  className={`mt-4 rounded-lg px-4 py-3 ${detail.konflik.length ? "bg-peringatan-latar font-medium text-peringatan" : "bg-latar text-teks-sekunder"}`}
                >
                  {detail.konflik.length
                    ? `Peringatan: data warga sudah berubah sejak pengajuan dibuat (${detail.konflik.join(", ")}). Kolom "Saat ini" di atas adalah nilai saat pengajuan dibuat; Anda diminta konfirmasi sebelum menyetujui.`
                    : "Data warga belum berubah sejak pengajuan dibuat. Setelah disetujui, perubahan diterapkan ke data resmi dan dicatat di log."}
                </p>
              )}

              {detail.status === "DITOLAK" && detail.alasanPenolakan && (
                <p className="mt-4 rounded-lg bg-galat-latar px-4 py-3 text-galat">Alasan penolakan: {detail.alasanPenolakan}</p>
              )}

              {detail.status === "MENUNGGU" && <PanelKeputusan id={detail.id} />}
            </section>
          )}
        </div>
      )}
    </>
  );
}
