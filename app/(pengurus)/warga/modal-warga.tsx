"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { kelasInput } from "@/components/kartu-form";
import type { OpsiKk } from "@/lib/data/warga";
import { nikCocokTanggalLahir } from "@/lib/nik";
import { wargaSchema, type WargaData, type WargaInput } from "@/lib/validators/warga";
import { simpanWargaAksi } from "./actions";
import { ComboboxKk } from "./combobox-kk";

interface Opsi {
  id: string;
  nama: string;
}
export interface MasterWarga {
  pendidikan: Opsi[];
  pekerjaan: Opsi[];
}
type Pasangan = [string, string][];

const HUBUNGAN: Pasangan = [
  ["KEPALA_KELUARGA", "Kepala Keluarga"], ["ISTRI", "Istri"], ["SUAMI", "Suami"], ["ANAK", "Anak"],
  ["MENANTU", "Menantu"], ["CUCU", "Cucu"], ["ORANG_TUA", "Orang tua"], ["MERTUA", "Mertua"],
  ["FAMILI_LAIN", "Famili lain"], ["LAINNYA", "Lainnya"],
];
const AGAMA: Pasangan = [
  ["ISLAM", "Islam"], ["KRISTEN", "Kristen"], ["KATOLIK", "Katolik"], ["HINDU", "Hindu"],
  ["BUDDHA", "Buddha"], ["KONGHUCU", "Konghucu"], ["LAINNYA", "Lainnya"],
];
const DARAH: Pasangan = [["A", "A"], ["B", "B"], ["AB", "AB"], ["O", "O"], ["TIDAK_TAHU", "Tidak tahu"]];
const KAWIN: Pasangan = [
  ["BELUM_KAWIN", "Belum kawin"], ["KAWIN", "Kawin"], ["CERAI_HIDUP", "Cerai hidup"], ["CERAI_MATI", "Cerai mati"],
];
const STATUS: Pasangan = [["AKTIF", "Aktif"], ["PINDAH", "Pindah"], ["MENINGGAL", "Meninggal"]];

const hariIni = () => new Date().toISOString().slice(0, 10);

export const WARGA_KOSONG = {
  kartu_keluarga_id: "", hubungan_keluarga: "ANAK", nik: "", nama_lengkap: "", jenis_kelamin: "",
  tempat_lahir: "", tanggal_lahir: "", agama: "", pendidikan_id: "", pekerjaan_id: "",
  golongan_darah: "", status_perkawinan: "", status_kependudukan: "AKTIF", tanggal_status: "",
} as unknown as WargaInput;

function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-teal">{judul}</h3>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Bidang({ label, wajib, galat, children }: { label: string; wajib?: boolean; galat?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-teks">
      {label}
      {wajib && <span className="text-galat"> *</span>}
      {children}
      {galat && <p role="alert" className="mt-1 text-sm font-normal text-galat">{galat}</p>}
    </label>
  );
}

function Pilih({ reg, opsi, kosong }: { reg: UseFormRegisterReturn; opsi: Pasangan; kosong?: string }) {
  return (
    <select {...reg} className={kelasInput}>
      {kosong !== undefined && <option value="">{kosong}</option>}
      {opsi.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
}

interface Props {
  nilaiAwal: WargaInput;
  kkAwal: OpsiKk | null;
  wargaId?: string;
  master: MasterWarga;
  onTutup: (tersimpan: boolean) => void;
}

export function ModalWarga({ nilaiAwal, kkAwal, wargaId, master, onTutup }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kk, setKk] = useState<OpsiKk | null>(kkAwal);
  const [galatServer, setGalatServer] = useState<string | null>(null);
  const { register, handleSubmit, control, setValue, getValues, formState } = useForm<WargaInput, unknown, WargaData>({
    resolver: zodResolver(wargaSchema),
    defaultValues: nilaiAwal,
  });
  const e = formState.errors;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const [nik, lahir, jk, status] = useWatch({ control, name: ["nik", "tanggal_lahir", "jenis_kelamin", "status_kependudukan"] });
  // BR-10: hanya peringatan, tidak memblokir simpan.
  const nikTidakCocok = jk === "L" || jk === "P" ? nikCocokTanggalLahir(nik, lahir, jk) === false : false;

  async function simpan(data: WargaData) {
    setGalatServer(null);
    const hasil = await simpanWargaAksi(data, wargaId);
    if (!hasil.ok) {
      setGalatServer(hasil.galat);
      return;
    }
    onTutup(true);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="judul-modal-warga"
      onClose={() => onTutup(false)}
      className="m-auto max-h-[92vh] w-[min(44rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50"
    >
      <form onSubmit={handleSubmit(simpan)} noValidate className="flex max-h-[92vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 id="judul-modal-warga" className="text-xl font-bold text-teks">
              {wargaId ? "Ubah Warga" : "Tambah Warga"}
            </h2>
            <p className="text-sm text-teks-sekunder">Setiap warga wajib masuk ke satu Kartu Keluarga.</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Tutup"
            className="flex size-11 items-center justify-center rounded-lg text-teks hover:bg-latar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="space-y-6 overflow-y-auto px-6 py-5">
          <Bagian judul="Kartu Keluarga">
            <div>
              <p className="text-sm font-semibold text-teks">
                Kartu Keluarga<span className="text-galat"> *</span>
              </p>
              <ComboboxKk
                nilai={kk}
                onPilih={(k) => {
                  setKk(k);
                  setValue("kartu_keluarga_id", k.id, { shouldValidate: true });
                }}
                galat={e.kartu_keluarga_id?.message}
              />
              <Link href="/kk/baru" className="mt-1 inline-block text-sm font-semibold text-teal underline">
                + Buat KK baru
              </Link>
            </div>
            <Bidang label="Hubungan dalam keluarga" wajib galat={e.hubungan_keluarga?.message}>
              <Pilih reg={register("hubungan_keluarga")} opsi={HUBUNGAN} />
            </Bidang>
          </Bagian>

          <Bagian judul="Identitas">
            <Bidang label="NIK" wajib galat={e.nik?.message}>
              <input {...register("nik")} inputMode="numeric" maxLength={16} className={kelasInput} aria-invalid={e.nik ? true : undefined} />
            </Bidang>
            <Bidang label="Nama lengkap" wajib galat={e.nama_lengkap?.message}>
              <input {...register("nama_lengkap")} placeholder="Sesuai KTP/KK" className={kelasInput} />
            </Bidang>
            <fieldset>
              <legend className="text-sm font-semibold text-teks">Jenis kelamin<span className="text-galat"> *</span></legend>
              <div className="mt-1 flex min-h-11 items-center gap-6">
                {([["L", "Laki-laki"], ["P", "Perempuan"]] as const).map(([v, t]) => (
                  <label key={v} className="flex min-h-11 items-center gap-2 text-base">
                    <input type="radio" value={v} {...register("jenis_kelamin")} className="size-5" /> {t}
                  </label>
                ))}
              </div>
              {e.jenis_kelamin && <p role="alert" className="text-sm text-galat">{e.jenis_kelamin.message}</p>}
            </fieldset>
            <Bidang label="Tempat lahir" wajib galat={e.tempat_lahir?.message}>
              <input {...register("tempat_lahir")} placeholder="Kota/kabupaten" className={kelasInput} />
            </Bidang>
            <Bidang label="Tanggal lahir" wajib galat={e.tanggal_lahir?.message}>
              <input type="date" max={hariIni()} {...register("tanggal_lahir")} className={kelasInput} />
            </Bidang>
            {nikTidakCocok && (
              <p role="status" className="rounded-lg bg-peringatan-latar px-4 py-3 text-sm text-peringatan md:col-span-2">
                Peringatan: digit tanggal pada NIK tidak cocok dengan tanggal lahir dan jenis kelamin. Periksa kembali; data tetap bisa disimpan.
              </p>
            )}
          </Bagian>

          <Bagian judul="Data diri">
            <Bidang label="Agama" wajib galat={e.agama?.message}>
              <Pilih reg={register("agama")} opsi={AGAMA} kosong="Pilih agama" />
            </Bidang>
            <Bidang label="Pendidikan terakhir" wajib galat={e.pendidikan_id?.message}>
              <Pilih reg={register("pendidikan_id")} opsi={master.pendidikan.map((o): [string, string] => [o.id, o.nama])} kosong="Pilih pendidikan" />
            </Bidang>
            <Bidang label="Pekerjaan" wajib galat={e.pekerjaan_id?.message}>
              <Pilih reg={register("pekerjaan_id")} opsi={master.pekerjaan.map((o): [string, string] => [o.id, o.nama])} kosong="Pilih pekerjaan" />
            </Bidang>
            <Bidang label="Golongan darah">
              <Pilih reg={register("golongan_darah")} opsi={DARAH} kosong="-" />
            </Bidang>
          </Bagian>

          <Bagian judul="Tambahan">
            <Bidang label="Status perkawinan">
              <Pilih reg={register("status_perkawinan")} opsi={KAWIN} kosong="-" />
            </Bidang>
            <Bidang label="Status kependudukan" wajib galat={e.status_kependudukan?.message}>
              <Pilih
                reg={register("status_kependudukan", {
                  onChange: (ev) => {
                    if (ev.target.value !== "AKTIF" && !getValues("tanggal_status")) setValue("tanggal_status", hariIni());
                  },
                })}
                opsi={STATUS}
              />
            </Bidang>
            {status !== "AKTIF" && (
              <Bidang label={status === "MENINGGAL" ? "Tanggal meninggal" : "Tanggal pindah"} wajib galat={e.tanggal_status?.message}>
                <input type="date" max={hariIni()} {...register("tanggal_status")} className={kelasInput} />
              </Bidang>
            )}
          </Bagian>

          {galatServer && <p role="alert" className="rounded-lg bg-galat-latar px-4 py-3 text-galat">{galatServer}</p>}
        </div>

        <footer className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-lg border border-teal bg-white px-5 font-semibold text-teal">
            Batal
          </button>
          <button type="submit" disabled={formState.isSubmitting} className="min-h-11 rounded-lg bg-teal px-6 font-semibold text-white hover:bg-teal/90 disabled:opacity-60">
            {formState.isSubmitting ? "Menyimpan..." : "Simpan"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
