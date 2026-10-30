"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BarisKlaim } from "@/lib/data/pengguna";
import { DialogPengaturan, kelasField } from "../pengaturan/dialog-pengaturan";
import { setujuiKlaimAksi, tolakKlaimAksi } from "./actions";

const formatWaktu = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function AntreanKlaim({ data }: { data: BarisKlaim[] }) {
  const router = useRouter();
  const [ditolak, setDitolak] = useState<BarisKlaim | null>(null);
  const [alasan, setAlasan] = useState("");
  const [sedangDiproses, setSedangDiproses] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "galat" | "info"; teks: string } | null>(null);

  async function setujui(k: BarisKlaim) {
    setPesan(null);
    setSedangDiproses(k.id);
    const hasil = await setujuiKlaimAksi(k.id);
    setSedangDiproses(null);
    if (!hasil.ok) setPesan({ jenis: "galat", teks: hasil.galat });
    else if (hasil.info) setPesan({ jenis: "info", teks: hasil.info });
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-teks">Klaim akun warga menunggu verifikasi</h2>
          <p className="text-sm text-teks-sekunder">
            Pastikan pendaftar benar-benar warga RT tersebut sebelum menyetujui. NIK, No KK, dan tanggal lahir sudah cocok dengan data warga.
          </p>
        </div>
        <span className="rounded-full bg-peringatan-latar px-3 py-1 text-sm font-semibold text-peringatan">{data.length} menunggu</span>
      </div>
      {pesan && (
        <p role={pesan.jenis === "galat" ? "alert" : "status"} className={`mb-3 rounded-lg px-4 py-3 ${pesan.jenis === "galat" ? "bg-galat-latar text-galat" : "bg-peringatan-latar text-peringatan"}`}>
          {pesan.teks}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="bg-teal text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Nama (dari data warga)</th>
              <th className="px-4 py-3 font-semibold">NIK</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">RT</th>
              <th className="px-4 py-3 font-semibold">Waktu daftar</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-teks-sekunder">Tidak ada klaim yang menunggu.</td></tr>
            )}
            {data.map((k) => (
              <tr key={k.id} className="border-b border-border">
                <td className="px-4 py-3 font-bold text-teks">{k.nama}</td>
                <td className="px-4 py-3">{k.nik}</td>
                <td className="px-4 py-3">
                  {k.email}
                  {!k.emailTerverifikasi && <span className="mt-1 block text-sm font-semibold text-peringatan">Email belum diverifikasi</span>}
                </td>
                <td className="px-4 py-3">{k.rt}</td>
                <td className="px-4 py-3">{formatWaktu.format(k.dibuat)}</td>
                <td className="px-4 py-3">
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={sedangDiproses === k.id}
                      onClick={() => {
                        setAlasan("");
                        setDitolak(k);
                      }}
                      className="min-h-11 rounded-lg border border-galat bg-white px-4 font-semibold text-galat hover:bg-galat-latar disabled:opacity-60"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={!k.emailTerverifikasi || sedangDiproses === k.id}
                      title={k.emailTerverifikasi ? undefined : "Menunggu pendaftar memverifikasi emailnya"}
                      onClick={() => setujui(k)}
                      className="min-h-11 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90 disabled:opacity-60"
                    >
                      Setujui
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ditolak && (
        <DialogPengaturan
          judul={`Tolak klaim ${ditolak.nama}`}
          labelSimpan="Tolak klaim"
          onSimpan={() => tolakKlaimAksi(ditolak.id, { alasan })}
          onTutup={(selesai) => {
            setDitolak(null);
            if (selesai) router.refresh();
          }}
        >
          <p className="text-sm text-teks-sekunder">Data warga ini bisa diklaim lagi oleh orang yang benar. Alasan dikirim ke pendaftar lewat email.</p>
          <label className="block text-sm font-semibold text-teks">
            Alasan (opsional)
            <textarea value={alasan} maxLength={200} rows={3} onChange={(e) => setAlasan(e.target.value)} className={`${kelasField} py-2`} />
          </label>
        </DialogPengaturan>
      )}
    </section>
  );
}
