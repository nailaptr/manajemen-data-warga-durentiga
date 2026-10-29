"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { BarisKategoriUsia } from "@/lib/data/pengaturan";
import { simpanKategoriUsiaAksi } from "./actions";

interface Baris {
  kunci: string;
  id?: string;
  nama: string;
  usia_min: string;
  usia_maks: string;
  jenis_kelamin: "" | "L" | "P";
}

const kelasSel =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-teks focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30";

function dariData(data: BarisKategoriUsia[]): Baris[] {
  return data.map((k) => ({
    kunci: k.id,
    id: k.id,
    nama: k.nama,
    usia_min: String(k.usia_min),
    usia_maks: k.usia_maks === null ? "" : String(k.usia_maks),
    jenis_kelamin: k.jenis_kelamin ?? "",
  }));
}

export function TabKategoriUsia({ data }: { data: BarisKategoriUsia[] }) {
  const router = useRouter();
  const [baris, setBaris] = useState<Baris[]>(() => dariData(data));
  const [galat, setGalat] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const ubah = (kunci: string, sebagian: Partial<Baris>) =>
    setBaris((b) => b.map((r) => (r.kunci === kunci ? { ...r, ...sebagian } : r)));

  async function simpan() {
    setGalat(null);
    setInfo(null);
    setMenyimpan(true);
    const hasil = await simpanKategoriUsiaAksi(baris.map((r) => ({ id: r.id, nama: r.nama, usia_min: r.usia_min, usia_maks: r.usia_maks, jenis_kelamin: r.jenis_kelamin })));
    setMenyimpan(false);
    if (!hasil.ok) {
      setGalat(hasil.galat);
      return;
    }
    setInfo("Perubahan tersimpan.");
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-teks">Kategori usia</h2>
          <p className="text-sm text-teks-sekunder">Dipakai sebagai filter di Dashboard dan Cari Warga. Usia dihitung dari tanggal lahir.</p>
        </div>
        <button
          type="button"
          onClick={() => setBaris((b) => [...b, { kunci: crypto.randomUUID(), nama: "", usia_min: "0", usia_maks: "", jenis_kelamin: "" }])}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90"
        >
          <Plus className="size-5" aria-hidden /> Tambah kategori
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="bg-teal text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Urutan</th>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Usia min (th)</th>
              <th className="px-4 py-3 font-semibold">Usia maks (th)</th>
              <th className="px-4 py-3 font-semibold">Jenis kelamin</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {baris.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-teks-sekunder">Belum ada kategori usia.</td></tr>
            )}
            {baris.map((r, i) => (
              <tr key={r.kunci} className="border-b border-border">
                <td className="px-4 py-3">{i + 1}</td>
                <td className="px-2 py-3">
                  <input aria-label={`Nama kategori ${i + 1}`} value={r.nama} onChange={(e) => ubah(r.kunci, { nama: e.target.value })} className={kelasSel} />
                </td>
                <td className="px-2 py-3">
                  <input aria-label={`Usia min ${i + 1}`} type="number" min={0} value={r.usia_min} onChange={(e) => ubah(r.kunci, { usia_min: e.target.value })} className={`${kelasSel} w-28`} />
                </td>
                <td className="px-2 py-3">
                  <input aria-label={`Usia maks ${i + 1}`} type="number" min={0} value={r.usia_maks} placeholder="Tanpa batas" onChange={(e) => ubah(r.kunci, { usia_maks: e.target.value })} className={`${kelasSel} w-36`} />
                </td>
                <td className="px-2 py-3">
                  <select aria-label={`Jenis kelamin ${i + 1}`} value={r.jenis_kelamin} onChange={(e) => ubah(r.kunci, { jenis_kelamin: e.target.value as Baris["jenis_kelamin"] })} className={kelasSel}>
                    <option value="">Semua</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    aria-label={`Hapus ${r.nama || `kategori ${i + 1}`}`}
                    onClick={() => setBaris((b) => b.filter((x) => x.kunci !== r.kunci))}
                    className="flex size-11 items-center justify-center rounded-lg text-galat hover:bg-galat-latar"
                  >
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 rounded-lg bg-teal-muda px-4 py-3 text-teal">
        Kategori boleh tumpang tindih (misalnya Usia subur beririsan dengan Remaja dan Dewasa), karena filter kategori usia bisa dipilih lebih dari satu.
      </p>
      {galat && <p role="alert" className="mt-3 rounded-lg bg-galat-latar px-4 py-3 text-galat">{galat}</p>}
      {info && <p role="status" className="mt-3 rounded-lg bg-sukses-latar px-4 py-3 text-sukses">{info}</p>}

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setBaris(dariData(data));
            setGalat(null);
            setInfo(null);
          }}
          className="min-h-11 rounded-lg border border-teal bg-white px-5 font-semibold text-teal"
        >
          Batal
        </button>
        <button type="button" onClick={simpan} disabled={menyimpan} className="min-h-11 rounded-lg bg-teal px-6 font-semibold text-white hover:bg-teal/90 disabled:opacity-60">
          {menyimpan ? "Menyimpan..." : "Simpan perubahan"}
        </button>
      </div>
    </section>
  );
}
