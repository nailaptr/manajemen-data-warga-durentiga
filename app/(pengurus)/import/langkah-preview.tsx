"use client";

import { useState } from "react";
import type { HasilImpor } from "@/lib/import";
import { kunci } from "@/lib/import/normalize";
import type { BarisHasil, OpsiMaster, StatusBaris } from "@/lib/import/types";
import { maskNomor } from "@/lib/mask";

export interface PilihanNilai {
  id: string;
  teks: string;
  jumlah: number;
}
export type JenisMaster = "pendidikan" | "pekerjaan";
export type PilihanManual = Record<JenisMaster, Record<string, PilihanNilai>>;

const BATAS_TAMPIL = 100;
const KOLOM_NILAI: Record<JenisMaster, string> = { pendidikan: "Pendidikan", pekerjaan: "Pekerjaan" };

interface Props {
  namaFile: string;
  impor: HasilImpor;
  opsi: Record<JenisMaster, OpsiMaster[]>;
  pilihan: PilihanManual;
  saatPilih: (jenis: JenisMaster, teks: string, jumlah: number, id: string) => void;
  mode: "lewati" | "perbarui";
  saatMode: (mode: "lewati" | "perbarui") => void;
  saatGanti: () => void;
  saatKembali: () => void;
  saatUnduhError: () => void;
  saatMulai: () => void;
}

interface BarisNilai {
  jenis: JenisMaster;
  teks: string;
  jumlah: number;
  id: string;
}

function tampilNik(b: BarisHasil): string {
  return maskNomor(/^\d{16}$/.test(b.data.nik) ? b.data.nik : (b.data.mentah.nik ?? "").trim()) || "-";
}

export function LangkahPreview({ namaFile, impor, opsi, pilihan, saatPilih, mode, saatMode, saatGanti, saatKembali, saatUnduhError, saatMulai }: Props) {
  const [tab, setTab] = useState<StatusBaris>(impor.ringkasan.error > 0 ? "error" : "valid");
  const { total, valid, peringatan, error } = impor.ringkasan;
  const bisaDiimpor = valid + peringatan;

  const nilai: BarisNilai[] = (["pendidikan", "pekerjaan"] as const).flatMap((jenis) => [
    ...impor.tidakDikenal[jenis].map((n) => ({ jenis, teks: n.nilai, jumlah: n.jumlah, id: "" })),
    ...Object.values(pilihan[jenis]).map((p) => ({ jenis, teks: p.teks, jumlah: p.jumlah, id: p.id })),
  ]);
  const barisTab = impor.baris.filter((b) => b.status === tab);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-teks">{namaFile}</p>
          <p className="text-sm text-teks-sekunder">{total} baris data, {impor.ringkasan.jumlahKk} KK terbaca</p>
        </div>
        <button type="button" onClick={saatGanti} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold text-teks hover:bg-latar">
          Ganti file
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KartuHitung label="Valid" nilai={valid} kelas="bg-sukses-latar text-sukses" />
        <KartuHitung label="Peringatan" nilai={peringatan} kelas="bg-peringatan-latar text-peringatan" />
        <KartuHitung label="Error" nilai={error} kelas="bg-galat-latar text-galat" />
      </div>

      {nilai.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-teks">Nilai yang belum dikenali</h2>
          <p className="mb-3 text-sm text-teks-sekunder">Pilihan Anda disimpan sebagai alias, jadi import berikutnya tidak menanyakan lagi.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-teks-sekunder">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Kolom</th>
                  <th className="py-2 pr-3 font-semibold">Nilai di Excel</th>
                  <th className="py-2 pr-3 font-semibold">Jumlah baris</th>
                  <th className="py-2 font-semibold">Petakan ke</th>
                </tr>
              </thead>
              <tbody>
                {nilai.map((n) => (
                  <tr key={`${n.jenis}:${kunci(n.teks)}`} className="border-t border-border">
                    <td className="py-2 pr-3">{KOLOM_NILAI[n.jenis]}</td>
                    <td className="py-2 pr-3 font-medium text-teks">{n.teks}</td>
                    <td className="py-2 pr-3">{n.jumlah}</td>
                    <td className="py-2">
                      <select
                        aria-label={`Petakan ${n.teks} ke ${KOLOM_NILAI[n.jenis].toLowerCase()}`}
                        value={n.id}
                        onChange={(e) => saatPilih(n.jenis, n.teks, n.jumlah, e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-border bg-card px-3"
                      >
                        <option value="">Kosongkan</option>
                        {opsi[n.jenis].map((o) => (
                          <option key={o.id} value={o.id}>{o.nama}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-lg font-bold text-teks">Hasil pemeriksaan</h2>
        <div role="tablist" aria-label="Hasil pemeriksaan" className="mb-3 flex flex-wrap gap-2">
          {([["valid", "Valid", valid], ["peringatan", "Peringatan", peringatan], ["error", "Error", error]] as const).map(([s, label, n]) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${tab === s ? "bg-teal text-white" : "bg-latar text-teks hover:bg-nonaktif-latar"}`}
            >
              {label} {n}
            </button>
          ))}
        </div>
        {barisTab.length === 0 ? (
          <p className="py-4 text-sm text-teks-sekunder">Tidak ada baris di kategori ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-teks-sekunder">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Baris</th>
                  <th className="py-2 pr-3 font-semibold">Nama</th>
                  <th className="py-2 pr-3 font-semibold">NIK di file</th>
                  <th className="py-2 font-semibold">Masalah</th>
                </tr>
              </thead>
              <tbody>
                {barisTab.slice(0, BATAS_TAMPIL).map((b) => (
                  <tr key={b.data.nomor} className="border-t border-border align-top">
                    <td className="py-2 pr-3">{b.data.nomor}</td>
                    <td className="py-2 pr-3">{b.data.nama_lengkap || "-"}</td>
                    <td className="py-2 pr-3 font-mono">{tampilNik(b)}</td>
                    <td className="py-2">{b.temuan.length ? b.temuan.map((t) => t.pesan).join("; ") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {barisTab.length > BATAS_TAMPIL && (
              <p className="pt-3 text-sm text-teks-sekunder">Menampilkan {BATAS_TAMPIL} dari {barisTab.length} baris.</p>
            )}
          </div>
        )}
      </section>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 text-lg font-bold text-teks">Jika NIK sudah ada di sistem</legend>
        {([["lewati", "Lewati, jangan ubah data yang sudah ada"], ["perbarui", "Perbarui data yang sudah ada"]] as const).map(([nilaiMode, label]) => (
          <label key={nilaiMode} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="radio" name="mode" checked={mode === nilaiMode} onChange={() => saatMode(nilaiMode)} className="size-5 accent-teal" />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={saatKembali} className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-teks hover:bg-latar">
          Kembali ke mapping
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saatUnduhError}
            disabled={error === 0}
            className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-teks hover:bg-latar disabled:opacity-50"
          >
            Unduh daftar error
          </button>
          <button
            type="button"
            onClick={saatMulai}
            disabled={bisaDiimpor === 0}
            className="min-h-11 rounded-lg bg-teal px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Impor {bisaDiimpor} baris
          </button>
        </div>
      </div>
    </div>
  );
}

function KartuHitung({ label, nilai, kelas }: { label: string; nilai: number; kelas: string }) {
  return (
    <div className={`rounded-xl p-5 ${kelas}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-3xl font-bold">{nilai}</p>
    </div>
  );
}
