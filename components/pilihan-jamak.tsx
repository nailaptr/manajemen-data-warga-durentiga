"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export interface OpsiPilihan {
  nilai: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  opsi: OpsiPilihan[];
  terpilih: string[];
  semuaLabel: string;
  nonaktif?: boolean;
  onUbah: (baru: string[]) => void;
}

// Pilihan jamak (OR dalam satu filter): tombol ringkasan + daftar kotak centang di <details>.
export function PilihanJamak({ id, label, opsi, terpilih, semuaLabel, nonaktif, onUbah }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const tutup = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", tutup);
    document.addEventListener("keydown", tutup);
    return () => {
      document.removeEventListener("pointerdown", tutup);
      document.removeEventListener("keydown", tutup);
    };
  }, []);

  const dipilih = opsi.filter((o) => terpilih.includes(o.nilai));
  const ringkas =
    dipilih.length === 0 ? semuaLabel : dipilih.length <= 2 ? dipilih.map((o) => o.label).join(", ") : `${dipilih.length} dipilih`;

  const ubah = (nilai: string, centang: boolean) =>
    onUbah(centang ? [...terpilih, nilai] : terpilih.filter((n) => n !== nilai));

  return (
    <div className="relative">
      <span id={`${id}-label`} className="mb-1.5 block text-sm font-semibold text-teks">
        {label}
      </span>
      <details ref={ref} className="group" aria-disabled={nonaktif}>
        <summary
          aria-labelledby={`${id}-label ${id}-nilai`}
          className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-base text-teks focus-visible:outline-2 focus-visible:outline-teal ${
            nonaktif ? "pointer-events-none bg-nonaktif-latar text-teks-sekunder" : ""
          }`}
        >
          <span id={`${id}-nilai`} className="truncate">
            {ringkas}
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="absolute z-20 mt-1 max-h-72 w-full min-w-56 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {opsi.map((o) => (
            <li key={o.nilai}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-base text-teks hover:bg-latar">
                <input
                  type="checkbox"
                  className="size-4 accent-teal"
                  checked={terpilih.includes(o.nilai)}
                  onChange={(e) => ubah(o.nilai, e.target.checked)}
                />
                {o.label}
              </label>
            </li>
          ))}
          {opsi.length === 0 && <li className="px-3 py-2 text-sm text-teks-sekunder">Belum ada pilihan</li>}
        </ul>
      </details>
    </div>
  );
}
