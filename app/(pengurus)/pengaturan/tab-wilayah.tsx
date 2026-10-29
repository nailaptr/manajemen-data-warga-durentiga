"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { BarisWilayah } from "@/lib/data/pengaturan";
import { hapusWilayahAksi, simpanWilayahAksi } from "./actions";
import { DialogPengaturan, kelasField } from "./dialog-pengaturan";

interface Formulir {
  id?: string;
  rw: string;
  rt: string;
  keterangan: string;
}

export function TabWilayah({ data, rwDefault }: { data: BarisWilayah[]; rwDefault: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Formulir | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  async function hapus(b: BarisWilayah) {
    setGalat(null);
    if (!window.confirm(`Hapus RT ${b.rt} / RW ${b.rw}?`)) return;
    const hasil = await hapusWilayahAksi(b.id);
    if (hasil.ok) router.refresh();
    else setGalat(hasil.galat);
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-teks">RT dan RW</h2>
          <p className="text-sm text-teks-sekunder">Daftar wilayah yang dipakai KK dan pengguna. Wilayah yang sudah dipakai tidak bisa dihapus.</p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ rw: rwDefault, rt: "", keterangan: "" })}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90"
        >
          <Plus className="size-5" aria-hidden /> Tambah RT
        </button>
      </div>
      {galat && <p role="alert" className="mb-3 rounded-lg bg-galat-latar px-4 py-3 text-galat">{galat}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left">
          <thead className="bg-teal text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">RW</th>
              <th className="px-4 py-3 font-semibold">RT</th>
              <th className="px-4 py-3 font-semibold">Keterangan</th>
              <th className="px-4 py-3 font-semibold">Jumlah KK</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-teks-sekunder">Belum ada wilayah.</td></tr>
            )}
            {data.map((b) => (
              <tr key={b.id} className="border-b border-border">
                <td className="px-4 py-3 font-bold text-teks">{b.rw}</td>
                <td className="px-4 py-3 font-bold text-teks">{b.rt}</td>
                <td className="px-4 py-3">{b.keterangan ?? "-"}</td>
                <td className="px-4 py-3">{b.jumlahKk}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center">
                    <button
                      type="button"
                      aria-label={`Ubah RT ${b.rt} RW ${b.rw}`}
                      onClick={() => setForm({ id: b.id, rw: b.rw, rt: b.rt, keterangan: b.keterangan ?? "" })}
                      className="flex size-11 items-center justify-center rounded-lg text-teal hover:bg-teal-muda"
                    >
                      <Pencil className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus RT ${b.rt} RW ${b.rw}`}
                      onClick={() => hapus(b)}
                      className="flex size-11 items-center justify-center rounded-lg text-galat hover:bg-galat-latar"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <DialogPengaturan
          judul={form.id ? "Ubah RT/RW" : "Tambah RT"}
          onSimpan={() => simpanWilayahAksi({ rw: form.rw, rt: form.rt, keterangan: form.keterangan }, form.id)}
          onTutup={(tersimpan) => {
            setForm(null);
            if (tersimpan) router.refresh();
          }}
        >
          <label className="block text-sm font-semibold text-teks">
            RW
            <input value={form.rw} inputMode="numeric" maxLength={3} onChange={(e) => setForm({ ...form, rw: e.target.value })} className={kelasField} />
          </label>
          <label className="block text-sm font-semibold text-teks">
            RT
            <input value={form.rt} inputMode="numeric" maxLength={3} placeholder="Contoh: 006" onChange={(e) => setForm({ ...form, rt: e.target.value })} className={kelasField} />
          </label>
          <label className="block text-sm font-semibold text-teks">
            Keterangan (opsional)
            <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className={kelasField} />
          </label>
        </DialogPengaturan>
      )}
    </section>
  );
}
