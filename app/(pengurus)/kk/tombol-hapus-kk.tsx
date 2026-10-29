"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { hapusKkAksi } from "./actions";

export function TombolHapusKk({ id, teks, tujuan }: { id: string; teks?: string; tujuan?: string }) {
  const router = useRouter();
  const [galat, setGalat] = useState<string | null>(null);

  async function hapus() {
    if (!window.confirm("Hapus KK ini? Data tetap tersimpan sebagai arsip (soft delete).")) return;
    const hasil = await hapusKkAksi(id);
    if (!hasil.ok) {
      setGalat(hasil.galat);
      return;
    }
    if (tujuan) router.push(tujuan);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={hapus}
        aria-label={teks ? undefined : "Hapus KK"}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-galat hover:bg-galat-latar"
      >
        <Trash2 className="size-5" aria-hidden />
        {teks}
      </button>
      {galat && (
        <span role="alert" className="max-w-64 text-sm text-galat">
          {galat}
        </span>
      )}
    </span>
  );
}
