"use client";

import { useId, useRef, useState } from "react";
import { kelasInput } from "@/components/kartu-form";
import type { OpsiKk } from "@/lib/data/warga";
import { maskNomor } from "@/lib/mask";
import { cariKkAksi } from "./actions";

const JEDA_CARI_MS = 250;

export function labelKk(k: OpsiKk): string {
  return `${maskNomor(k.no_kk)} · ${k.kepala_keluarga ?? "Belum ada kepala keluarga"}`;
}

interface Props {
  nilai: OpsiKk | null;
  onPilih: (kk: OpsiKk) => void;
  galat?: string;
}

// Combobox pencarian KK (PRD 5.3): cari No KK atau nama kepala; hasil dibatasi cakupan di server.
export function ComboboxKk({ nilai, onPilih, galat }: Props) {
  const idDaftar = useId();
  const [teks, setTeks] = useState(nilai ? labelKk(nilai) : "");
  const [hasil, setHasil] = useState<OpsiKk[]>([]);
  const [terbuka, setTerbuka] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urutan = useRef(0);

  function cari(q: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const saya = ++urutan.current;
      setMemuat(true);
      const data = await cariKkAksi(q);
      if (saya !== urutan.current) return; // jawaban lama diabaikan
      setHasil(data);
      setMemuat(false);
    }, JEDA_CARI_MS);
  }

  function pilih(k: OpsiKk) {
    onPilih(k);
    setTeks(labelKk(k));
    setTerbuka(false);
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={terbuka}
        aria-controls={idDaftar}
        aria-autocomplete="list"
        aria-invalid={galat ? true : undefined}
        autoComplete="off"
        placeholder="Cari No KK atau nama kepala"
        className={kelasInput}
        value={teks}
        onFocus={() => {
          setTerbuka(true);
          cari(nilai && teks === labelKk(nilai) ? "" : teks);
        }}
        onChange={(e) => {
          setTeks(e.target.value);
          setTerbuka(true);
          cari(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && terbuka) {
            e.stopPropagation();
            setTerbuka(false);
          }
        }}
        onBlur={() => setTimeout(() => setTerbuka(false), 150)}
      />
      {terbuka && (
        <ul
          id={idDaftar}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-white shadow-lg"
        >
          {memuat && <li className="px-3 py-2 text-sm text-teks-sekunder">Mencari...</li>}
          {!memuat && hasil.length === 0 && <li className="px-3 py-2 text-sm text-teks-sekunder">KK tidak ditemukan.</li>}
          {hasil.map((k) => (
            <li
              key={k.id}
              role="option"
              aria-selected={nilai?.id === k.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pilih(k)}
              className="min-h-11 cursor-pointer px-3 py-2.5 text-base hover:bg-teal-muda"
            >
              {labelKk(k)}
            </li>
          ))}
        </ul>
      )}
      {galat && <p role="alert" className="mt-1 text-sm text-galat">{galat}</p>}
    </div>
  );
}
