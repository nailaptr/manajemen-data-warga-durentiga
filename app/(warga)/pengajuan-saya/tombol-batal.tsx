"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { batalkanPengajuanAksi } from "./actions";

export function TombolBatal({ id }: { id: string }) {
  const router = useRouter();
  const [memproses, setMemproses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function batalkan() {
    if (!window.confirm("Batalkan pengajuan ini?")) return;
    setMemproses(true);
    setGalat(null);
    const hasil = await batalkanPengajuanAksi(id);
    setMemproses(false);
    if (hasil.ok) router.refresh();
    else setGalat(hasil.galat);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={batalkan}
        disabled={memproses}
        className="min-h-11 rounded-xl border border-galat px-4 font-semibold text-galat disabled:opacity-60"
      >
        {memproses ? "Membatalkan..." : "Batalkan pengajuan"}
      </button>
      {galat && (
        <p role="alert" className="mt-2 text-galat">
          {galat}
        </p>
      )}
    </div>
  );
}
