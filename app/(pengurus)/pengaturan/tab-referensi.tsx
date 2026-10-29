"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { BarisReferensi } from "@/lib/data/pengaturan";
import {
  hapusPekerjaanAksi,
  hapusPendidikanAksi,
  simpanPekerjaanAksi,
  simpanPendidikanAksi,
  type HasilPengaturan,
} from "./actions";
import { DialogPengaturan, kelasField } from "./dialog-pengaturan";

interface Props {
  jenis: "pendidikan" | "pekerjaan";
  data: BarisReferensi[];
}

const TEKS = {
  pendidikan: {
    judul: "Pendidikan dan alias",
    deskripsi: "Alias dipakai saat import Excel agar penulisan yang berbeda dikenali otomatis. Urutan menentukan susunan di grafik.",
    tambah: "Tambah pendidikan",
    nama: "pendidikan",
  },
  pekerjaan: {
    judul: "Pekerjaan dan alias",
    deskripsi: "Alias dipakai saat import Excel agar penulisan yang berbeda dikenali otomatis.",
    tambah: "Tambah pekerjaan",
    nama: "pekerjaan",
  },
} as const;

interface Formulir {
  id?: string;
  nama: string;
  urutan: string;
  alias: string;
}

export function TabReferensi({ jenis, data }: Props) {
  const router = useRouter();
  const teks = TEKS[jenis];
  const denganUrutan = jenis === "pendidikan";
  const [form, setForm] = useState<Formulir | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const kosong: Formulir = { nama: "", urutan: String((data.at(-1)?.urutan ?? 0) + 1), alias: "" };

  async function simpan(): Promise<HasilPengaturan> {
    if (!form) return { ok: false, galat: "Formulir tertutup" };
    const alias = form.alias.split(",");
    return jenis === "pendidikan"
      ? simpanPendidikanAksi({ nama: form.nama, urutan: form.urutan, alias }, form.id)
      : simpanPekerjaanAksi({ nama: form.nama, alias }, form.id);
  }

  async function hapus(b: BarisReferensi) {
    setGalat(null);
    if (!window.confirm(`Hapus ${teks.nama} "${b.nama}"?`)) return;
    const hasil = await (jenis === "pendidikan" ? hapusPendidikanAksi(b.id) : hapusPekerjaanAksi(b.id));
    if (hasil.ok) router.refresh();
    else setGalat(hasil.galat);
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-teks">{teks.judul}</h2>
          <p className="text-sm text-teks-sekunder">{teks.deskripsi}</p>
        </div>
        <button
          type="button"
          onClick={() => setForm(kosong)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90"
        >
          <Plus className="size-5" aria-hidden /> {teks.tambah}
        </button>
      </div>
      {galat && <p role="alert" className="mb-3 rounded-lg bg-galat-latar px-4 py-3 text-galat">{galat}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left">
          <thead className="bg-teal text-white">
            <tr>
              {denganUrutan && <th className="px-4 py-3 font-semibold">Urutan</th>}
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Alias yang dikenali</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-teks-sekunder">Belum ada data.</td></tr>
            )}
            {data.map((b) => (
              <tr key={b.id} className="border-b border-border">
                {denganUrutan && <td className="px-4 py-3">{b.urutan}</td>}
                <td className="px-4 py-3 font-bold text-teks">{b.nama}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-2">
                    {b.alias.map((a) => (
                      <span key={a} className="rounded-full bg-teal-muda px-3 py-1 text-sm text-teal">{a}</span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center">
                    <button
                      type="button"
                      aria-label={`Ubah ${b.nama}`}
                      onClick={() => setForm({ id: b.id, nama: b.nama, urutan: String(b.urutan ?? ""), alias: b.alias.join(", ") })}
                      className="flex size-11 items-center justify-center rounded-lg text-teal hover:bg-teal-muda"
                    >
                      <Pencil className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus ${b.nama}`}
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
          judul={`${form.id ? "Ubah" : "Tambah"} ${teks.nama}`}
          onSimpan={simpan}
          onTutup={(tersimpan) => {
            setForm(null);
            if (tersimpan) router.refresh();
          }}
        >
          <label className="block text-sm font-semibold text-teks">
            Nama
            <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className={kelasField} />
          </label>
          {denganUrutan && (
            <label className="block text-sm font-semibold text-teks">
              Urutan
              <input type="number" min={1} value={form.urutan} onChange={(e) => setForm({ ...form, urutan: e.target.value })} className={kelasField} />
            </label>
          )}
          <label className="block text-sm font-semibold text-teks">
            Alias (pisahkan dengan koma)
            <input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} placeholder="Contoh: Tidak Sekolah, Belum Sekolah" className={kelasField} />
          </label>
        </DialogPengaturan>
      )}
    </section>
  );
}
