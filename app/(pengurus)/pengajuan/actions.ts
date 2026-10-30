"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { GalatPengajuan, KonflikPengajuan, penerimaHasilPengajuan, setujuiPengajuan, tolakPengajuan } from "@/lib/data/pengajuan";
import { kirimHasilPengajuan } from "@/lib/email";
import { PENGURUS } from "@/lib/navigasi";
import { tolakPengajuanSchema } from "@/lib/validators/pengajuan";

// `konflik` berisi label field yang berubah sejak pengajuan dibuat (BR-08); klien meminta konfirmasi lalu mengirim ulang.
export type HasilKeputusan = { ok: true } | { ok: false; galat: string; konflik?: string[] };

const GALAT_UMUM = "Terjadi kesalahan. Keputusan tidak tersimpan.";
const idSchema = z.string().uuid();

function segarkan() {
  revalidatePath("/pengajuan");
  revalidatePath("/dashboard");
}

// Email hanya kabar; kegagalan kirim tidak membatalkan keputusan yang sudah tersimpan.
async function beritahuWarga(user: Awaited<ReturnType<typeof requireRole>>, id: string) {
  try {
    const p = await penerimaHasilPengajuan(user, id);
    if (p) await kirimHasilPengajuan({ ke: p.email, nama: p.nama, jenis: p.jenis, disetujui: p.disetujui, alasan: p.alasan });
  } catch (e) {
    console.error("beritahuWarga: email gagal dikirim", e instanceof Error ? e.name : "galat");
  }
}

function galat(nama: string, e: unknown): HasilKeputusan {
  if (e instanceof KonflikPengajuan) return { ok: false, galat: e.message, konflik: e.field };
  if (e instanceof GalatPengajuan) return { ok: false, galat: e.message };
  console.error(`${nama} gagal`, e instanceof Error ? e.name : "galat");
  return { ok: false, galat: GALAT_UMUM };
}

export async function setujuiPengajuanAksi(id: string, konfirmasiKonflik: boolean): Promise<HasilKeputusan> {
  const user = await requireRole(...PENGURUS);
  if (!idSchema.safeParse(id).success) return { ok: false, galat: "Pengajuan tidak ditemukan" };
  try {
    await setujuiPengajuan(user, id, { konfirmasiKonflik: konfirmasiKonflik === true });
    await beritahuWarga(user, id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return galat("setujuiPengajuanAksi", e);
  }
}

export async function tolakPengajuanAksi(id: string, input: unknown): Promise<HasilKeputusan> {
  const user = await requireRole(...PENGURUS);
  const alasan = tolakPengajuanSchema.safeParse(input);
  if (!idSchema.safeParse(id).success) return { ok: false, galat: "Pengajuan tidak ditemukan" };
  if (!alasan.success) return { ok: false, galat: alasan.error.issues[0]?.message ?? "Alasan tidak valid" };
  try {
    await tolakPengajuan(user, id, alasan.data.alasan);
    await beritahuWarga(user, id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return galat("tolakPengajuanAksi", e);
  }
}
