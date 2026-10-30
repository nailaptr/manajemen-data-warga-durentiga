"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALASAN_TOLAK_MIN, tolakPengajuanSchema } from "@/lib/validators/pengajuan";
import { setujuiPengajuanAksi, tolakPengajuanAksi, type HasilKeputusan } from "./actions";

export function PanelKeputusan({ id }: { id: string }) {
  const router = useRouter();
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  async function selesai(hasil: HasilKeputusan) {
    setMemproses(false);
    if (hasil.ok) return router.refresh();
    setGalat(hasil.galat);
  }

  async function setujui() {
    setGalat(null);
    setMemproses(true);
    let hasil = await setujuiPengajuanAksi(id, false);
    // Server mendeteksi data warga sudah berubah (BR-08): minta konfirmasi, lalu kirim ulang.
    if (!hasil.ok && hasil.konflik) {
      const lanjut = window.confirm(
        `Data berikut sudah berubah sejak pengajuan dibuat: ${hasil.konflik.join(", ")}.\n\nTetap terapkan usulan ini dan timpa nilai sekarang?`,
      );
      if (!lanjut) return setMemproses(false);
      hasil = await setujuiPengajuanAksi(id, true);
    }
    await selesai(hasil);
  }

  async function tolak() {
    setGalat(null);
    const lokal = tolakPengajuanSchema.safeParse({ alasan });
    if (!lokal.success) return setGalat(lokal.error.issues[0]?.message ?? "Alasan tidak valid");
    setMemproses(true);
    await selesai(await tolakPengajuanAksi(id, { alasan }));
  }

  return (
    <div className="mt-5">
      <label htmlFor="alasan" className="block font-semibold text-teks">
        Alasan penolakan <span className="font-normal text-teks-sekunder">(wajib jika menolak, minimal {ALASAN_TOLAK_MIN} karakter)</span>
      </label>
      <textarea
        id="alasan"
        rows={3}
        maxLength={500}
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder="Contoh: mohon lampirkan bukti pekerjaan"
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-teks focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
      />
      {galat && (
        <p role="alert" className="mt-2 font-medium text-galat">
          {galat}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={tolak} disabled={memproses} className="min-h-11 rounded-lg border border-galat px-5 font-semibold text-galat disabled:opacity-60">
          Tolak
        </button>
        <button type="button" onClick={setujui} disabled={memproses} className="min-h-11 rounded-lg bg-teal px-5 font-semibold text-white disabled:opacity-60">
          {memproses ? "Memproses..." : "Setujui perubahan"}
        </button>
      </div>
    </div>
  );
}
