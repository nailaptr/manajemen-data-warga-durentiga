"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { kelasInput } from "@/components/kartu-form";
import { kkSchema, type KkData, type KkInput } from "@/lib/validators/kk";
import { simpanKkAksi } from "./actions";

interface Opsi {
  id: string;
  nama: string;
}
interface Props {
  nilaiAwal: KkInput;
  kkId?: string;
  pendidikan: Opsi[];
  pekerjaan: Opsi[];
  rtTersedia: { rt: string; rw: string }[];
}

const HUBUNGAN: [string, string][] = [
  ["KEPALA_KELUARGA", "Kepala Keluarga"], ["ISTRI", "Istri"], ["SUAMI", "Suami"], ["ANAK", "Anak"],
  ["MENANTU", "Menantu"], ["CUCU", "Cucu"], ["ORANG_TUA", "Orang tua"], ["MERTUA", "Mertua"],
  ["FAMILI_LAIN", "Famili lain"], ["LAINNYA", "Lainnya"],
];
const AGAMA: [string, string][] = [
  ["ISLAM", "Islam"], ["KRISTEN", "Kristen"], ["KATOLIK", "Katolik"], ["HINDU", "Hindu"],
  ["BUDDHA", "Buddha"], ["KONGHUCU", "Konghucu"], ["LAINNYA", "Lainnya"],
];
const DARAH: [string, string][] = [["A", "A"], ["B", "B"], ["AB", "AB"], ["O", "O"], ["TIDAK_TAHU", "Tidak tahu"]];
const KAWIN: [string, string][] = [
  ["BELUM_KAWIN", "Belum kawin"], ["KAWIN", "Kawin"], ["CERAI_HIDUP", "Cerai hidup"], ["CERAI_MATI", "Cerai mati"],
];

export const ANGGOTA_KOSONG = {
  hubungan_keluarga: "ANAK", nik: "", nama_lengkap: "", jenis_kelamin: "L", tempat_lahir: "",
  tanggal_lahir: "", agama: "ISLAM", pendidikan_id: "", pekerjaan_id: "", golongan_darah: "", status_perkawinan: "",
} as unknown as KkInput["anggota"][number];

function Galat({ pesan }: { pesan?: string }) {
  return pesan ? <p role="alert" className="mt-1 text-sm text-galat">{pesan}</p> : null;
}

function Pilih({ label, opsi, kosong, galat, ...rest }: {
  label: string; opsi: [string, string][]; kosong?: string; galat?: string;
} & ReturnType<UseFormRegister<KkInput>>) {
  return (
    <label className="block text-sm font-semibold text-teks">
      {label}
      <select {...rest} className={kelasInput}>
        {kosong !== undefined && <option value="">{kosong}</option>}
        {opsi.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      <Galat pesan={galat} />
    </label>
  );
}

function Isi({ label, galat, ...rest }: {
  label: string; galat?: string;
} & ReturnType<UseFormRegister<KkInput>> & { type?: string; inputMode?: "numeric"; maxLength?: number }) {
  return (
    <label className="block text-sm font-semibold text-teks">
      {label}
      <input {...rest} className={kelasInput} aria-invalid={galat ? true : undefined} />
      <Galat pesan={galat} />
    </label>
  );
}

export function FormKk({ nilaiAwal, kkId, pendidikan, pekerjaan, rtTersedia }: Props) {
  const router = useRouter();
  const [galatServer, setGalatServer] = useState<string | null>(null);
  const { register, control, handleSubmit, formState } = useForm<KkInput, unknown, KkData>({
    resolver: zodResolver(kkSchema),
    defaultValues: nilaiAwal,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "anggota" });
  const e: FieldErrors<KkInput> = formState.errors;
  const rtOpsi = [...new Set(rtTersedia.map((w) => w.rt))].map((rt): [string, string] => [rt, `RT ${rt}`]);
  const rwOpsi = [...new Set(rtTersedia.map((w) => w.rw))].map((rw): [string, string] => [rw, `RW ${rw}`]);

  async function simpan(data: KkData) {
    setGalatServer(null);
    // Server memvalidasi ulang dengan skema yang sama; yang dikirim adalah nilai mentah form.
    const hasil = await simpanKkAksi(data, kkId);
    if (!hasil.ok) {
      setGalatServer(hasil.galat);
      return;
    }
    router.push(`/kk/${hasil.id}`);
    router.refresh();
  }

  const opsiPend = pendidikan.map((o): [string, string] => [o.id, o.nama]);
  const opsiPek = pekerjaan.map((o): [string, string] => [o.id, o.nama]);

  return (
    <form onSubmit={handleSubmit(simpan)} noValidate className="space-y-6">
      <section className="rounded-xl bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-teks">Data KK</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Isi label="No KK" inputMode="numeric" maxLength={16} {...register("no_kk")} galat={e.no_kk?.message} />
          <Isi label="Alamat" {...register("alamat")} galat={e.alamat?.message} />
          <Pilih label="RT" opsi={rtOpsi} kosong="Pilih RT" {...register("rt")} galat={e.rt?.message} />
          <Pilih label="RW" opsi={rwOpsi} kosong="Pilih RW" {...register("rw")} galat={e.rw?.message} />
          <Isi label="Kode pos" inputMode="numeric" maxLength={5} {...register("kode_pos")} galat={e.kode_pos?.message} />
          <Isi label="Desa/Kelurahan" {...register("desa_kelurahan")} galat={e.desa_kelurahan?.message} />
          <Isi label="Kecamatan" {...register("kecamatan")} galat={e.kecamatan?.message} />
          <Isi label="Kabupaten/Kota" {...register("kabupaten_kota")} galat={e.kabupaten_kota?.message} />
          <Isi label="Provinsi (opsional)" {...register("provinsi")} galat={e.provinsi?.message} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-teks">Anggota keluarga</h2>
        {fields.map((f, i) => {
          const ea = e.anggota?.[i];
          const kepala = i === 0;
          return (
            <fieldset key={f.id} className="rounded-xl bg-card p-5 shadow-sm">
              <legend className="px-1 text-base font-bold text-teal">
                Anggota {i + 1}{kepala ? " (Kepala Keluarga)" : ""}
              </legend>
              <div className="grid gap-4 md:grid-cols-3">
                {kepala ? (
                  <>
                    <input type="hidden" {...register(`anggota.${i}.hubungan_keluarga`)} value="KEPALA_KELUARGA" />
                    <p className="text-sm font-semibold text-teks">
                      Hubungan keluarga
                      <span className={`${kelasInput} bg-latar`}>Kepala Keluarga</span>
                    </p>
                  </>
                ) : (
                  <Pilih label="Hubungan keluarga" opsi={HUBUNGAN.slice(1)} {...register(`anggota.${i}.hubungan_keluarga`)} galat={ea?.hubungan_keluarga?.message} />
                )}
                <Isi label="NIK" inputMode="numeric" maxLength={16} {...register(`anggota.${i}.nik`)} galat={ea?.nik?.message} />
                <Isi label="Nama lengkap" {...register(`anggota.${i}.nama_lengkap`)} galat={ea?.nama_lengkap?.message} />
                <Pilih label="Jenis kelamin" opsi={[["L", "Laki-laki"], ["P", "Perempuan"]]} {...register(`anggota.${i}.jenis_kelamin`)} galat={ea?.jenis_kelamin?.message} />
                <Isi label="Tempat lahir" {...register(`anggota.${i}.tempat_lahir`)} galat={ea?.tempat_lahir?.message} />
                <Isi label="Tanggal lahir" type="date" {...register(`anggota.${i}.tanggal_lahir`)} galat={ea?.tanggal_lahir?.message} />
                <Pilih label="Agama" opsi={AGAMA} {...register(`anggota.${i}.agama`)} galat={ea?.agama?.message} />
                <Pilih label="Pendidikan" opsi={opsiPend} kosong="Pilih pendidikan" {...register(`anggota.${i}.pendidikan_id`)} galat={ea?.pendidikan_id?.message} />
                <Pilih label="Pekerjaan" opsi={opsiPek} kosong="Pilih pekerjaan" {...register(`anggota.${i}.pekerjaan_id`)} galat={ea?.pekerjaan_id?.message} />
                <Pilih label="Golongan darah (opsional)" opsi={DARAH} kosong="-" {...register(`anggota.${i}.golongan_darah`)} />
                <Pilih label="Status perkawinan (opsional)" opsi={KAWIN} kosong="-" {...register(`anggota.${i}.status_perkawinan`)} />
              </div>
              {!kepala && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-galat hover:bg-galat-latar"
                >
                  <Trash2 className="size-4" aria-hidden /> Hapus anggota
                </button>
              )}
            </fieldset>
          );
        })}
        <Galat pesan={e.anggota?.root?.message ?? e.anggota?.message} />
        <button
          type="button"
          onClick={() => append(ANGGOTA_KOSONG)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal/50 px-4 text-base font-semibold text-teal hover:bg-teal-muda"
        >
          <Plus className="size-5" aria-hidden /> Tambah Anggota
        </button>
      </section>

      {galatServer && <p role="alert" className="rounded-lg bg-galat-latar px-4 py-3 text-galat">{galatServer}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={kkId ? `/kk/${kkId}` : "/kk"} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-5 font-semibold text-teks">
          Batal
        </Link>
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="min-h-11 rounded-lg bg-teal px-5 font-semibold text-white hover:bg-teal/90 disabled:opacity-60"
        >
          {formState.isSubmitting ? "Menyimpan..." : `Simpan KK dan ${fields.length} anggota`}
        </button>
      </div>
    </form>
  );
}
