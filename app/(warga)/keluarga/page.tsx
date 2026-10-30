import Link from "next/link";
import { AvatarInisial } from "@/components/avatar-inisial";
import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { keluargaSaya } from "@/lib/data/portal";
import { maskNomor } from "@/lib/mask";

export default async function KeluargaSaya() {
  const user = await requireRole("WARGA");
  const keluarga = await keluargaSaya(user);

  if (!keluarga) {
    return (
      <p role="status" className="rounded-2xl bg-white p-5 text-teks-sekunder shadow-sm">
        Data keluarga Anda belum dapat ditampilkan. Hubungi pengurus RT Anda.
      </p>
    );
  }

  return (
    <>
      <JudulHalaman
        judul="Keluarga saya"
        deskripsi={`KK ${maskNomor(keluarga.kk.no_kk)} · RT ${keluarga.kk.rt}/RW ${keluarga.kk.rw}`}
      />
      <ul className="space-y-4">
        {keluarga.anggota.map((a) => (
          <li key={a.id} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm">
            <AvatarInisial nama={a.nama} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-teks">{a.nama}</p>
              <p className="mt-1 flex flex-wrap gap-2">
                <span className="rounded-full bg-teal-muda px-3 py-1 text-sm font-semibold text-teal">{a.hubungan}</span>
                {a.pengajuanMenunggu && (
                  <span className="rounded-full bg-peringatan-latar px-3 py-1 text-sm font-semibold text-peringatan">Pengajuan menunggu</span>
                )}
              </p>
              <p className="mt-2 text-teks-sekunder">
                {[`${a.usia} th`, a.pekerjaan, a.status_perkawinan].filter(Boolean).join(" · ")}
              </p>
              <Link
                href={`/pengajuan-saya/baru?warga=${a.id}`}
                className="mt-1 flex min-h-11 items-center font-bold text-teal"
              >
                Ajukan ubah data →
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <Link
        href="/pengajuan-saya/baru?jenis=TAMBAH_ANGGOTA"
        className="mt-4 flex min-h-14 items-center justify-center rounded-2xl border-2 border-dashed border-teal bg-white font-bold text-teal"
      >
        + Tambah anggota keluarga
      </Link>
    </>
  );
}
