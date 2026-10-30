"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { DataFormPengajuan } from "@/lib/data/pengajuan";
import { buatPengajuanSchema } from "@/lib/validators/pengajuan";
import { buatPengajuanAksi } from "../actions";

export type TabPengajuan = "UBAH_WARGA" | "TAMBAH_ANGGOTA" | "LAPOR";

type Pasangan = readonly (readonly [string, string])[];
const AGAMA: Pasangan = [
  ["ISLAM", "Islam"], ["KRISTEN", "Kristen"], ["KATOLIK", "Katolik"], ["HINDU", "Hindu"],
  ["BUDDHA", "Buddha"], ["KONGHUCU", "Konghucu"], ["LAINNYA", "Lainnya"],
];
const DARAH: Pasangan = [["A", "A"], ["B", "B"], ["AB", "AB"], ["O", "O"], ["TIDAK_TAHU", "Tidak tahu"]];
const KAWIN: Pasangan = [["BELUM_KAWIN", "Belum Kawin"], ["KAWIN", "Kawin"], ["CERAI_HIDUP", "Cerai Hidup"], ["CERAI_MATI", "Cerai Mati"]];
const HUBUNGAN: Pasangan = [
  ["ISTRI", "Istri"], ["SUAMI", "Suami"], ["ANAK", "Anak"], ["MENANTU", "Menantu"], ["CUCU", "Cucu"],
  ["ORANG_TUA", "Orang Tua"], ["MERTUA", "Mertua"], ["FAMILI_LAIN", "Famili Lain"], ["LAINNYA", "Lainnya"],
];

const kelasInput = "mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-teks focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30";
const TAB: { id: TabPengajuan; label: string }[] = [
  { id: "UBAH_WARGA", label: "Ubah data" },
  { id: "TAMBAH_ANGGOTA", label: "Tambah anggota" },
  { id: "LAPOR", label: "Pindah/ Meninggal" },
];

function Kolom({ label, saatIni, children }: { label: string; saatIni?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-base font-bold text-teks">{label}</span>
      {saatIni && <span className="block text-teks-sekunder">Saat ini: {saatIni}</span>}
      {children}
    </label>
  );
}

function Pilih({ name, pilihan, awal, kosong }: { name: string; pilihan: Pasangan; awal?: string | null; kosong?: string }) {
  return (
    <select name={name} defaultValue={awal ?? ""} className={kelasInput}>
      {kosong !== undefined && <option value="">{kosong}</option>}
      {pilihan.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

const nilai = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

export function FormPengajuan({ data, tabAwal, wargaAwal }: { data: DataFormPengajuan; tabAwal: TabPengajuan; wargaAwal: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabPengajuan>(tabAwal);
  const [wargaId, setWargaId] = useState(wargaAwal);
  const [galat, setGalat] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  const anggota = data.anggota.find((a) => a.id === wargaId);
  const pendidikan = data.pendidikan.map((m) => [m.id, m.nama] as const);
  const pekerjaan = data.pekerjaan.map((m) => [m.id, m.nama] as const);
  const pilihanAnggota = data.anggota.map((a) => [a.id, `${a.nama} (${a.hubungan}, ${a.usia} th)`] as const);

  function susun(d: FormData): unknown {
    const catatan = nilai(d, "catatan");
    if (tab === "TAMBAH_ANGGOTA") {
      return {
        jenis: tab, catatan,
        anggota: {
          hubungan_keluarga: nilai(d, "hubungan_keluarga"), nik: nilai(d, "nik"), nama_lengkap: nilai(d, "nama_lengkap"),
          jenis_kelamin: nilai(d, "jenis_kelamin"), tempat_lahir: nilai(d, "tempat_lahir"), tanggal_lahir: nilai(d, "tanggal_lahir"),
          agama: nilai(d, "agama"), pendidikan_id: nilai(d, "pendidikan_id"), pekerjaan_id: nilai(d, "pekerjaan_id"),
          golongan_darah: nilai(d, "golongan_darah"), status_perkawinan: nilai(d, "status_perkawinan"),
        },
      };
    }
    if (tab === "LAPOR") {
      return { jenis: nilai(d, "lapor"), warga_id: wargaId, tanggal_status: nilai(d, "tanggal_status"), catatan };
    }
    const perubahan: Record<string, string> = {};
    for (const k of ["nama_lengkap", "nik", "tempat_lahir", "tanggal_lahir", "agama", "pendidikan_id", "pekerjaan_id", "golongan_darah", "status_perkawinan"]) {
      // Kosong berarti tidak diubah; server membuang field yang sama dengan data sekarang.
      if (nilai(d, k)) perubahan[k] = nilai(d, k);
    }
    return { jenis: tab, warga_id: wargaId, perubahan, catatan };
  }

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = susun(new FormData(e.currentTarget));
    setGalat(null);
    const lokal = buatPengajuanSchema.safeParse(input);
    if (!lokal.success) return setGalat(lokal.error.issues[0]?.message ?? "Data tidak valid");
    setMemproses(true);
    const hasil = await buatPengajuanAksi(input);
    setMemproses(false);
    if (!hasil.ok) return setGalat(hasil.galat);
    router.push("/pengajuan-saya");
    router.refresh();
  }

  const pilihAnggota = (
    <Kolom label="Anggota keluarga">
      <select value={wargaId} onChange={(e) => setWargaId(e.target.value)} className={kelasInput}>
        {pilihanAnggota.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </Kolom>
  );

  return (
    <form onSubmit={kirim} noValidate className="space-y-5">
      <div role="tablist" aria-label="Jenis pengajuan" className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {TAB.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { setTab(t.id); setGalat(null); }}
            className={`min-h-14 rounded-xl px-2 text-base font-bold ${tab === t.id ? "bg-teal text-white" : "text-teks-sekunder"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "TAMBAH_ANGGOTA" && pilihAnggota}

      {tab === "UBAH_WARGA" && anggota && (
        <fieldset key={anggota.id} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <legend className="sr-only">Data yang diubah</legend>
          <p className="text-sm font-bold uppercase tracking-wide text-teal">Data yang diubah</p>
          <p className="text-teks-sekunder">Ubah hanya kolom yang perlu diperbaiki.</p>
          <Kolom label="Nama lengkap" saatIni={anggota.tampil.nama_lengkap ?? undefined}>
            <input name="nama_lengkap" defaultValue={anggota.nilai.nama_lengkap ?? ""} className={kelasInput} />
          </Kolom>
          <Kolom label="NIK" saatIni={anggota.tampil.nik ?? undefined}>
            <input name="nik" inputMode="numeric" maxLength={16} placeholder="Kosongkan bila tidak berubah" autoComplete="off" className={kelasInput} />
          </Kolom>
          <Kolom label="Tempat lahir" saatIni={anggota.tampil.tempat_lahir ?? undefined}>
            <input name="tempat_lahir" defaultValue={anggota.nilai.tempat_lahir ?? ""} className={kelasInput} />
          </Kolom>
          <Kolom label="Tanggal lahir" saatIni={anggota.tampil.tanggal_lahir ?? undefined}>
            <input name="tanggal_lahir" type="date" defaultValue={anggota.nilai.tanggal_lahir ?? ""} className={kelasInput} />
          </Kolom>
          <Kolom label="Agama" saatIni={anggota.tampil.agama ?? undefined}>
            <Pilih name="agama" pilihan={AGAMA} awal={anggota.nilai.agama} kosong="Tidak diubah" />
          </Kolom>
          <Kolom label="Pendidikan" saatIni={anggota.tampil.pendidikan_id ?? undefined}>
            <Pilih name="pendidikan_id" pilihan={pendidikan} awal={anggota.nilai.pendidikan_id} kosong="Tidak diubah" />
          </Kolom>
          <Kolom label="Pekerjaan" saatIni={anggota.tampil.pekerjaan_id ?? undefined}>
            <Pilih name="pekerjaan_id" pilihan={pekerjaan} awal={anggota.nilai.pekerjaan_id} kosong="Tidak diubah" />
          </Kolom>
          <Kolom label="Golongan darah" saatIni={anggota.tampil.golongan_darah ?? undefined}>
            <Pilih name="golongan_darah" pilihan={DARAH} awal={anggota.nilai.golongan_darah} kosong="Tidak diubah" />
          </Kolom>
          <Kolom label="Status perkawinan" saatIni={anggota.tampil.status_perkawinan ?? undefined}>
            <Pilih name="status_perkawinan" pilihan={KAWIN} awal={anggota.nilai.status_perkawinan} kosong="Tidak diubah" />
          </Kolom>
        </fieldset>
      )}

      {tab === "TAMBAH_ANGGOTA" && (
        <fieldset className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <legend className="sr-only">Data anggota baru</legend>
          <p className="text-sm font-bold uppercase tracking-wide text-teal">Data anggota baru</p>
          <Kolom label="Hubungan keluarga"><Pilih name="hubungan_keluarga" pilihan={HUBUNGAN} kosong="Pilih" /></Kolom>
          <Kolom label="NIK">
            <input name="nik" inputMode="numeric" maxLength={16} placeholder="16 digit" autoComplete="off" className={kelasInput} />
          </Kolom>
          <Kolom label="Nama lengkap"><input name="nama_lengkap" className={kelasInput} /></Kolom>
          <Kolom label="Jenis kelamin"><Pilih name="jenis_kelamin" pilihan={[["L", "Laki-laki"], ["P", "Perempuan"]]} kosong="Pilih" /></Kolom>
          <Kolom label="Tempat lahir"><input name="tempat_lahir" className={kelasInput} /></Kolom>
          <Kolom label="Tanggal lahir"><input name="tanggal_lahir" type="date" className={kelasInput} /></Kolom>
          <Kolom label="Agama"><Pilih name="agama" pilihan={AGAMA} kosong="Pilih" /></Kolom>
          <Kolom label="Pendidikan"><Pilih name="pendidikan_id" pilihan={pendidikan} kosong="Pilih" /></Kolom>
          <Kolom label="Pekerjaan"><Pilih name="pekerjaan_id" pilihan={pekerjaan} kosong="Pilih" /></Kolom>
          <Kolom label="Golongan darah (opsional)"><Pilih name="golongan_darah" pilihan={DARAH} kosong="Tidak diisi" /></Kolom>
          <Kolom label="Status perkawinan (opsional)"><Pilih name="status_perkawinan" pilihan={KAWIN} kosong="Tidak diisi" /></Kolom>
        </fieldset>
      )}

      {tab === "LAPOR" && (
        <fieldset className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <legend className="sr-only">Laporan</legend>
          <Kolom label="Yang dilaporkan">
            <Pilih name="lapor" pilihan={[["LAPOR_PINDAH", "Pindah"], ["LAPOR_MENINGGAL", "Meninggal"]]} awal="LAPOR_PINDAH" />
          </Kolom>
          <Kolom label="Tanggal kejadian"><input name="tanggal_status" type="date" className={kelasInput} /></Kolom>
        </fieldset>
      )}

      <Kolom label="Catatan untuk pengurus">
        <textarea name="catatan" rows={3} maxLength={500} className={`${kelasInput} py-3`} />
      </Kolom>

      <p className="rounded-xl bg-teal-muda px-4 py-3 text-teal">Perubahan berlaku setelah disetujui Ketua RT {data.rt}.</p>

      {galat && (
        <p role="alert" className="font-semibold text-galat">
          {galat}
        </p>
      )}
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Link href="/pengajuan-saya" className="flex min-h-14 items-center justify-center rounded-xl border-2 border-teal font-bold text-teal">
          Batal
        </Link>
        <button type="submit" disabled={memproses} className="min-h-14 rounded-xl bg-teal font-bold text-white disabled:opacity-60">
          {memproses ? "Mengirim..." : "Kirim pengajuan"}
        </button>
      </div>
    </form>
  );
}
