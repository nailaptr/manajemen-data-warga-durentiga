import Link from "next/link";
import { JudulHalaman } from "@/components/judul-halaman";
import { StatusPengajuan } from "@/components/status-pengajuan";
import { requireRole } from "@/lib/auth";
import { pengajuanSaya } from "@/lib/data/portal";
import { TombolBatal } from "./tombol-batal";

const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function PengajuanSaya() {
  const user = await requireRole("WARGA");
  const pengajuan = await pengajuanSaya(user);

  return (
    <>
      <JudulHalaman judul="Pengajuan saya" deskripsi="Perubahan data baru berlaku setelah disetujui Ketua RT." />
      {pengajuan.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-teks-sekunder shadow-sm">Belum ada pengajuan.</p>
      ) : (
        <ul className="space-y-3">
          {pengajuan.map((p) => (
            <li key={p.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-teks">{p.jenis}{p.nama_warga ? ` · ${p.nama_warga}` : ""}</p>
                  <p className="text-teks-sekunder">{tanggal.format(p.tanggal)}</p>
                </div>
                <StatusPengajuan status={p.status} />
              </div>
              {p.status === "DITOLAK" && p.alasan_penolakan && (
                <p className="mt-3 rounded-lg bg-galat-latar px-3 py-2 text-galat">Alasan: {p.alasan_penolakan}</p>
              )}
              {p.status === "MENUNGGU" && p.milikSaya && <TombolBatal id={p.id} />}
            </li>
          ))}
        </ul>
      )}
      <Link href="/pengajuan-saya/baru" className="mt-4 flex min-h-14 items-center justify-center rounded-xl bg-teal font-bold text-white">
        Ajukan perubahan
      </Link>
    </>
  );
}
