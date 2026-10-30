"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { batalkanPengajuan, buatPengajuan, GalatPengajuan, penerimaPengajuanBaru } from "@/lib/data/pengajuan";
import { kirimPengajuanBaru } from "@/lib/email";
import { buatPengajuanSchema } from "@/lib/validators/pengajuan";

export type HasilAksi = { ok: true } | { ok: false; galat: string };

const GALAT_UMUM = "Terjadi kesalahan. Pengajuan tidak tersimpan.";

// Email hanya kabar; kegagalan kirim tidak membatalkan pengajuan yang sudah tersimpan.
async function beritahuKetuaRt(user: Awaited<ReturnType<typeof requireRole>>, id: string) {
  try {
    const penerima = await penerimaPengajuanBaru(user, id);
    if (!penerima) return;
    await Promise.all(penerima.pengurus.map((k) => kirimPengajuanBaru({ ke: k.email, namaPengurus: k.nama, namaPengaju: penerima.namaPengaju, jenis: penerima.jenis })));
  } catch (e) {
    console.error("beritahuKetuaRt: email gagal dikirim", e instanceof Error ? e.name : "galat");
  }
}

// Peran dicek dulu; validasi input dan cakupan KK dicek ulang di server.
export async function buatPengajuanAksi(input: unknown): Promise<HasilAksi> {
  const user = await requireRole("WARGA");
  const hasil = buatPengajuanSchema.safeParse(input);
  if (!hasil.success) return { ok: false, galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  try {
    const id = await buatPengajuan(user, hasil.data);
    await beritahuKetuaRt(user, id);
    revalidatePath("/pengajuan-saya");
    revalidatePath("/beranda");
    revalidatePath("/keluarga");
    return { ok: true };
  } catch (e) {
    if (e instanceof GalatPengajuan) return { ok: false, galat: e.message };
    console.error("buatPengajuanAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: GALAT_UMUM };
  }
}

export async function batalkanPengajuanAksi(id: string): Promise<HasilAksi> {
  const user = await requireRole("WARGA");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, galat: "Pengajuan tidak ditemukan" };
  try {
    await batalkanPengajuan(user, id);
    revalidatePath("/pengajuan-saya");
    revalidatePath("/beranda");
    revalidatePath("/keluarga");
    return { ok: true };
  } catch (e) {
    if (e instanceof GalatPengajuan) return { ok: false, galat: e.message };
    console.error("batalkanPengajuanAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: "Terjadi kesalahan. Pengajuan tidak dibatalkan." };
  }
}
