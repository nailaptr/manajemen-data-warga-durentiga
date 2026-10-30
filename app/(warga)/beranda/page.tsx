import Link from "next/link";
import { AvatarInisial } from "@/components/avatar-inisial";
import { StatusPengajuan } from "@/components/status-pengajuan";
import { requireRole } from "@/lib/auth";
import { keluargaSaya, pengajuanSaya } from "@/lib/data/portal";
import { maskNomor } from "@/lib/mask";

const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const JUMLAH_TERBARU = 3;

export default async function BerandaWarga() {
  const user = await requireRole("WARGA");
  const [keluarga, pengajuan] = await Promise.all([keluargaSaya(user), pengajuanSaya(user, JUMLAH_TERBARU)]);

  if (!keluarga) {
    return (
      <p role="status" className="rounded-2xl bg-white p-5 text-teks-sekunder shadow-sm">
        Data keluarga Anda belum dapat ditampilkan. Hubungi pengurus RT Anda.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="judul-kk" className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 id="judul-kk" className="text-sm font-bold uppercase tracking-wide text-teks-sekunder">Kartu Keluarga</h2>
        <p className="mt-2 text-2xl font-bold text-teks">{maskNomor(keluarga.kk.no_kk)}</p>
        <p className="text-teks-sekunder">{keluarga.kk.alamat} · RT {keluarga.kk.rt}/RW {keluarga.kk.rw}</p>
        <Link href="/keluarga" className="mt-4 flex min-h-11 items-center justify-between gap-3">
          <span className="flex -space-x-2">
            {keluarga.anggota.slice(0, 4).map((a) => (
              <span key={a.id} className="rounded-full ring-2 ring-white"><AvatarInisial nama={a.nama} kecil /></span>
            ))}
          </span>
          <span className="font-bold text-teal">{keluarga.anggota.length} anggota · Lihat →</span>
        </Link>
      </section>

      <section aria-labelledby="judul-pengajuan" className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 id="judul-pengajuan" className="text-sm font-bold uppercase tracking-wide text-teks-sekunder">Pengajuan terbaru</h2>
          <Link href="/pengajuan-saya" className="flex min-h-11 items-center font-semibold text-teal">Lihat semua</Link>
        </div>
        {pengajuan.length === 0 ? (
          <p className="mt-2 text-teks-sekunder">Belum ada pengajuan.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {pengajuan.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold text-teks">{p.jenis}{p.nama_warga ? ` · ${p.nama_warga}` : ""}</p>
                  <p className="text-teks-sekunder">{tanggal.format(p.tanggal)}</p>
                </div>
                <StatusPengajuan status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/pengajuan-saya/baru" className="flex min-h-14 items-center justify-center rounded-xl bg-teal px-3 text-center font-bold text-white">
          Ajukan perubahan
        </Link>
        <Link href="/pengajuan-saya/baru?jenis=TAMBAH_ANGGOTA" className="flex min-h-14 items-center justify-center rounded-xl border border-teal bg-white px-3 text-center font-bold text-teal">
          Tambah anggota
        </Link>
      </div>

      <p className="text-center text-sm text-teks-sekunder">
        Data Anda hanya dapat dilihat oleh pengurus RW {keluarga.kk.rw}.{" "}
        <Link href="/kebijakan-privasi" className="font-bold text-teal">Kebijakan privasi</Link>
      </p>
    </div>
  );
}
