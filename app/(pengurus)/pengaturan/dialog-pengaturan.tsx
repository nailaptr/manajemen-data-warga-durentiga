"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import type { HasilPengaturan } from "./actions";

interface Props {
  judul: string;
  children: ReactNode;
  // Mengembalikan hasil aksi; dialog tertutup bila ok.
  onSimpan: () => Promise<HasilPengaturan>;
  onTutup: (tersimpan: boolean) => void;
  labelSimpan?: string;
}

export const kelasField =
  "mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-teks focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30";

export function DialogPengaturan({ judul, children, onSimpan, onTutup, labelSimpan = "Simpan" }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setMenyimpan(true);
    const hasil = await onSimpan();
    setMenyimpan(false);
    if (hasil.ok) onTutup(true);
    else setGalat(hasil.galat);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="judul-dialog-pengaturan"
      onClose={() => onTutup(false)}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50"
    >
      <form onSubmit={kirim} noValidate>
        <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 id="judul-dialog-pengaturan" className="text-xl font-bold text-teks">{judul}</h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Tutup" className="flex size-11 items-center justify-center rounded-lg text-teks hover:bg-latar">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="space-y-4 px-6 py-5">
          {children}
          {galat && <p role="alert" className="rounded-lg bg-galat-latar px-4 py-3 text-galat">{galat}</p>}
        </div>
        <footer className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-lg border border-teal bg-white px-5 font-semibold text-teal">
            Batal
          </button>
          <button type="submit" disabled={menyimpan} className="min-h-11 rounded-lg bg-teal px-6 font-semibold text-white hover:bg-teal/90 disabled:opacity-60">
            {menyimpan ? "Memproses..." : labelSimpan}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
