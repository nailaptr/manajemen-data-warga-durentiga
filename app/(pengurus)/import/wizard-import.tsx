"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { prosesImpor } from "@/lib/import";
import { buatDaftarGagal, buatTemplate } from "@/lib/import/berkas";
import { deteksiMapping, FIELD_WAJIB, gabungkanMapping } from "@/lib/import/mapping";
import { kunci, MAPPING_TEMPLATE } from "@/lib/import/normalize";
import { parseBerkas } from "@/lib/import/parse";
import { FIELD_IMPOR, GalatImpor, type FieldImpor, type HasilParse, type Mapping, type MasterImpor } from "@/lib/import/types";
import type { GagalImpor, RingkasanImpor } from "@/lib/validators/impor";
import { jalankanImpor, type AliasBaru } from "./jalankan-impor";
import { LangkahPreview, type JenisMaster, type PilihanManual } from "./langkah-preview";

type Langkah = 1 | 2 | 3 | 4;
const NAMA_LANGKAH = ["Upload file", "Mapping kolom", "Preview dan validasi", "Eksekusi dan laporan"] as const;
const PILIHAN_KOSONG: PilihanManual = { pendidikan: {}, pekerjaan: {} };
const tombolUtama = "min-h-11 rounded-lg bg-teal px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
const tombolBiasa = "min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-teks hover:bg-latar disabled:opacity-50";

function unduh(nama: string, isi: Uint8Array) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(isi)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  master: MasterImpor;
  tersimpan: Record<string, string> | null;
}

interface Laporan {
  ringkasan: RingkasanImpor | null;
  gagal: GagalImpor[];
  galat: string | null;
}

export function WizardImport({ master, tersimpan }: Props) {
  const [langkah, setLangkah] = useState<Langkah>(1);
  const [namaFile, setNamaFile] = useState("");
  const [hasil, setHasil] = useState<HasilParse | null>(null);
  const [hariIni, setHariIni] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [pilihan, setPilihan] = useState<PilihanManual>(PILIHAN_KOSONG);
  const [mode, setMode] = useState<"lewati" | "perbarui">("lewati");
  const [galatBaca, setGalatBaca] = useState<string | null>(null);
  const [progres, setProgres] = useState({ selesai: 0, total: 0 });
  const [laporan, setLaporan] = useState<Laporan | null>(null);

  const kepalaPertama = !mapping.hubungan_keluarga;
  const impor = useMemo(() => {
    if (!hasil || langkah < 3) return null;
    const pemetaanManual = Object.fromEntries(
      (["pendidikan", "pekerjaan"] as const).map((j) => [j, Object.fromEntries(Object.entries(pilihan[j]).map(([k, v]) => [k, v.id]))]),
    );
    return prosesImpor(hasil, mapping, { ...master, pemetaanManual }, hariIni, { kepalaPertama });
  }, [hasil, langkah, mapping, master, pilihan, hariIni, kepalaPertama]);

  async function bacaFile(file: File | undefined) {
    if (!file) return;
    setGalatBaca(null);
    try {
      const baca = parseBerkas(await file.arrayBuffer());
      setHasil(baca);
      setNamaFile(file.name);
      setHariIni(new Date().toLocaleDateString("sv-SE"));
      setMapping(gabungkanMapping(deteksiMapping(baca.header), tersimpan, baca.header));
      setPilihan(PILIHAN_KOSONG);
      setLangkah(2);
    } catch (e) {
      setGalatBaca(e instanceof GalatImpor ? e.message : "File tidak bisa dibaca. Gunakan file .xlsx atau .csv");
    }
  }

  function pilihNilai(jenis: JenisMaster, teks: string, jumlah: number, id: string) {
    setPilihan((p) => {
      const sisa = Object.fromEntries(Object.entries(p[jenis]).filter(([k]) => k !== kunci(teks)));
      return { ...p, [jenis]: id ? { ...sisa, [kunci(teks)]: { id, teks, jumlah } } : sisa };
    });
  }

  function ulang() {
    setLangkah(1);
    setHasil(null);
    setLaporan(null);
    setNamaFile("");
  }

  function unduhError() {
    if (!hasil || !impor) return;
    const gagal = impor.baris.filter((b) => b.status === "error").map((b) => ({
      nomor: b.data.nomor,
      pesan: b.temuan.filter((t) => t.level === "error").map((t) => t.pesan).join("; "),
    }));
    unduh("daftar-error-import.xlsx", buatDaftarGagal(hasil, gagal));
  }

  async function mulai() {
    if (!hasil || !impor) return;
    setLangkah(4);
    setLaporan(null);
    setProgres({ selesai: 0, total: 0 });
    const alias: AliasBaru[] = (["pendidikan", "pekerjaan"] as const).flatMap((jenis) =>
      Object.values(pilihan[jenis]).map((p) => ({ jenis, id: p.id, teks: p.teks })),
    );
    try {
      setLaporan(await jalankanImpor({ namaFile, mapping, impor, mode, alias, saatProgres: (selesai, total) => setProgres({ selesai, total }) }));
    } catch (e) {
      setLaporan({ ringkasan: null, gagal: [], galat: e instanceof Error ? e.message : "Terjadi kesalahan" });
    }
  }

  const dipetakan = (f: FieldImpor) => !!mapping[f];
  const wajibKurang = FIELD_WAJIB.filter((f) => !dipetakan(f));

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Langkah import">
        {NAMA_LANGKAH.map((nama, i) => (
          <li
            key={nama}
            aria-current={langkah === i + 1 ? "step" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${langkah === i + 1 ? "bg-teal text-white" : langkah > i + 1 ? "bg-teal-muda text-teal" : "bg-card text-teks-sekunder"}`}
          >
            <span>{i + 1}</span>
            <span>{nama}</span>
          </li>
        ))}
      </ol>

      {langkah === 1 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-teks">Upload file</h2>
          <p className="mt-1 text-sm text-teks-sekunder">Format .xlsx atau .csv, maksimal 5 MB dan 5.000 baris. Baris pertama berisi nama kolom.</p>
          <label className="mt-4 flex min-h-32 cursor-pointer focus-within:ring-2 focus-within:ring-teal flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border px-4 text-center hover:bg-latar">
            <span className="font-semibold text-teks">Pilih file dari komputer</span>
                        <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => bacaFile(e.target.files?.[0])} />
          </label>
          {galatBaca && <p role="alert" className="mt-3 rounded-lg bg-galat-latar px-4 py-3 text-sm text-galat">{galatBaca}</p>}
          <button type="button" onClick={() => unduh("template-import-warga.xlsx", buatTemplate())} className={`${tombolBiasa} mt-4`}>
            Unduh template
          </button>
        </section>
      )}

      {langkah === 2 && hasil && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-teks">Mapping kolom</h2>
          <p className="mt-1 text-sm text-teks-sekunder">
            Kolom file dikenali otomatis. Ubah bila keliru. Mapping dari import terakhir yang selesai dipakai lebih dulu, dan mapping ini tersimpan untuk import berikutnya.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="text-teks-sekunder">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Data warga</th>
                  <th className="py-2 font-semibold">Kolom di file</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_IMPOR.map((f) => {
                  const wajib = FIELD_WAJIB.includes(f);
                  const label = MAPPING_TEMPLATE[f] ?? f;
                  return (
                    <tr key={f} className="border-t border-border">
                      <td className="py-2 pr-3 font-medium text-teks">
                        {label}
                        {wajib && <span className="ml-1 text-galat" title="Wajib">*</span>}
                      </td>
                      <td className="py-2">
                        <select
                          aria-label={`Kolom untuk ${label}`}
                          value={mapping[f] ?? ""}
                          onChange={(e) => {
                            setMapping((m) => ({ ...m, [f]: e.target.value || undefined }));
                            setPilihan(PILIHAN_KOSONG);
                          }}
                          aria-required={wajib}
                          className="min-h-11 w-full max-w-sm rounded-lg border border-border bg-card px-3"
                        >
                          <option value="">Tidak dipetakan</option>
                          {hasil.header.map((h, i) => (
                            <option key={`${i}-${h}`} value={h}>{h || `(kolom ${i + 1} tanpa nama)`}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {kepalaPertama && (
            <p className="mt-3 rounded-lg bg-peringatan-latar px-4 py-3 text-sm text-peringatan">
              Kolom Hubungan keluarga tidak dipetakan. Anggota pertama tiap No KK dianggap Kepala Keluarga; periksa di langkah berikutnya.
            </p>
          )}
          {wajibKurang.length > 0 && (
            <p role="alert" className="mt-3 text-sm text-galat">Kolom wajib belum dipetakan: {wajibKurang.map((f) => MAPPING_TEMPLATE[f] ?? f).join(", ")}.</p>
          )}
          <div className="mt-5 flex flex-wrap justify-between gap-3">
            <button type="button" onClick={ulang} className={tombolBiasa}>Ganti file</button>
            <button type="button" onClick={() => setLangkah(3)} disabled={wajibKurang.length > 0} className={tombolUtama}>Lanjut ke preview</button>
          </div>
        </section>
      )}

      {langkah === 3 && impor && (
        <LangkahPreview
          namaFile={namaFile}
          impor={impor}
          opsi={{ pendidikan: master.pendidikan, pekerjaan: master.pekerjaan }}
          pilihan={pilihan}
          saatPilih={pilihNilai}
          mode={mode}
          saatMode={setMode}
          saatGanti={ulang}
          saatKembali={() => setLangkah(2)}
          saatUnduhError={unduhError}
          saatMulai={mulai}
        />
      )}

      {langkah === 4 && (
        <section className="rounded-2xl border border-border bg-card p-6" aria-live="polite">
          <h2 className="text-lg font-bold text-teks">Eksekusi dan laporan</h2>
          {!laporan ? (
            <div className="mt-4">
              <p className="text-sm text-teks-sekunder">Mengimpor batch {Math.min(progres.selesai + 1, Math.max(progres.total, 1))} dari {Math.max(progres.total, 1)}. Jangan tutup halaman ini.</p>
              <progress aria-label="Kemajuan import" className="mt-2 h-3 w-full" max={Math.max(progres.total, 1)} value={progres.selesai} />
            </div>
          ) : (
            <Laporan laporan={laporan} saatUnduh={() => hasil && unduh("daftar-gagal-import.xlsx", buatDaftarGagal(hasil, laporan.gagal))} saatUlang={ulang} />
          )}
        </section>
      )}
    </div>
  );
}

function Laporan({ laporan, saatUnduh, saatUlang }: { laporan: Laporan; saatUnduh: () => void; saatUlang: () => void }) {
  const { ringkasan, gagal, galat } = laporan;
  return (
    <div className="mt-4 space-y-4">
      {galat && <p role="alert" className="rounded-lg bg-galat-latar px-4 py-3 text-sm text-galat">Import terhenti: {galat}. Batch yang gagal tidak menyimpan data setengah jadi; baris yang sudah berhasil tetap tersimpan.</p>}
      {ringkasan ? (
        <>
          <p className="text-base font-semibold text-teks">
            {ringkasan.berhasil} berhasil, {ringkasan.dilewati} dilewati, {ringkasan.gagal} gagal
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-sukses-latar p-5 text-sukses"><p className="text-sm font-semibold">Berhasil</p><p className="text-3xl font-bold">{ringkasan.berhasil}</p></div>
            <div className="rounded-xl bg-peringatan-latar p-5 text-peringatan"><p className="text-sm font-semibold">Dilewati</p><p className="text-3xl font-bold">{ringkasan.dilewati}</p></div>
            <div className="rounded-xl bg-galat-latar p-5 text-galat"><p className="text-sm font-semibold">Gagal</p><p className="text-3xl font-bold">{ringkasan.gagal}</p></div>
          </div>
        </>
      ) : (
        <p className="text-sm text-teks-sekunder">Ringkasan akhir tidak bisa dibaca dari server. Periksa Data Warga atau Log Aktivitas.</p>
      )}
      <div className="flex flex-wrap gap-3">
        {gagal.length > 0 && <button type="button" onClick={saatUnduh} className={tombolBiasa}>Unduh daftar baris gagal</button>}
        <Link href="/warga" className={`${tombolBiasa} inline-flex items-center`}>Lihat Data Warga</Link>
        <button type="button" onClick={saatUlang} className={tombolUtama}>Import file lain</button>
      </div>
    </div>
  );
}
