"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { catatAktivitas } from "@/lib/activity-log";
import { requireRole } from "@/lib/auth";
import { GalatKk } from "@/lib/data/kk";
import { ambilOpsiKk, ambilWarga, cariKk, simpanWarga, type OpsiKk } from "@/lib/data/warga";
import { PENGURUS } from "@/lib/navigasi";
import { wargaSchema, type WargaInput } from "@/lib/validators/warga";

export type HasilSimpan = { ok: true; id: string } | { ok: false; galat: string };

const idSchema = z.string().uuid();

export async function simpanWargaAksi(input: unknown, id?: string): Promise<HasilSimpan> {
  const user = await requireRole(...PENGURUS);
  const idValid = id === undefined ? undefined : idSchema.safeParse(id);
  if (idValid && !idValid.success) return { ok: false, galat: "Warga tidak ditemukan" };
  const hasil = wargaSchema.safeParse(input);
  if (!hasil.success) return { ok: false, galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  try {
    const wargaId = await simpanWarga(user, hasil.data, idValid?.data);
    revalidatePath("/warga");
    return { ok: true, id: wargaId };
  } catch (e) {
    if (e instanceof GalatKk) return { ok: false, galat: e.message };
    console.error("simpanWargaAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: "Terjadi kesalahan. Data tidak tersimpan." };
  }
}

export async function cariKkAksi(q: string): Promise<OpsiKk[]> {
  const user = await requireRole(...PENGURUS);
  return cariKk(user, z.string().max(100).parse(q));
}

// Nilai awal modal Ubah. NIK tampil penuh di form, jadi pembukaannya dicatat dengan id saja.
export async function ambilWargaAksi(id: string): Promise<{ nilai: WargaInput; kk: OpsiKk } | null> {
  const user = await requireRole(...PENGURUS);
  if (!idSchema.safeParse(id).success) return null;
  const w = await ambilWarga(user, id);
  if (!w) return null;
  const kk = await ambilOpsiKk(user, w.kartu_keluarga_id);
  if (!kk) return null;
  await catatAktivitas({ userId: user.id, aksi: "WARGA_DIBUKA", entitas: "warga", entitasId: w.id });
  return {
    kk,
    nilai: {
      kartu_keluarga_id: w.kartu_keluarga_id,
      hubungan_keluarga: w.hubungan_keluarga,
      nik: w.nik,
      nama_lengkap: w.nama_lengkap,
      jenis_kelamin: w.jenis_kelamin,
      tempat_lahir: w.tempat_lahir ?? "",
      tanggal_lahir: w.tanggal_lahir.toISOString().slice(0, 10),
      agama: w.agama ?? "LAINNYA",
      pendidikan_id: w.pendidikan_id ?? "",
      pekerjaan_id: w.pekerjaan_id ?? "",
      golongan_darah: w.golongan_darah ?? "",
      status_perkawinan: w.status_perkawinan ?? "",
      status_kependudukan: w.status_kependudukan,
      tanggal_status: w.tanggal_status?.toISOString().slice(0, 10) ?? "",
    } as WargaInput,
  };
}
