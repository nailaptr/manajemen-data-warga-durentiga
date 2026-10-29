"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { GalatKk, hapusKk, simpanKk } from "@/lib/data/kk";
import { PENGURUS } from "@/lib/navigasi";
import { kkSchema } from "@/lib/validators/kk";

export type HasilAksi = { ok: true; id: string } | { ok: false; galat: string };

const idSchema = z.string().uuid();

function pesan(e: unknown): string {
  // Galat tak terduga tidak dibocorkan ke klien; galat bisnis (GalatKk) aman ditampilkan.
  return e instanceof GalatKk ? e.message : "Terjadi kesalahan. Data tidak tersimpan.";
}

export async function simpanKkAksi(input: unknown, id?: string): Promise<HasilAksi> {
  const user = await requireRole(...PENGURUS);
  const idValid = id === undefined ? undefined : idSchema.safeParse(id);
  if (idValid && !idValid.success) return { ok: false, galat: "KK tidak ditemukan" };
  const hasil = kkSchema.safeParse(input);
  if (!hasil.success) return { ok: false, galat: hasil.error.issues[0]?.message ?? "Data tidak valid" };
  try {
    const kkId = await simpanKk(user, hasil.data, idValid?.data);
    revalidatePath("/kk");
    return { ok: true, id: kkId };
  } catch (e) {
    if (!(e instanceof GalatKk)) console.error("simpanKkAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: pesan(e) };
  }
}

export async function hapusKkAksi(id: string): Promise<HasilAksi> {
  const user = await requireRole(...PENGURUS);
  const idValid = idSchema.safeParse(id);
  if (!idValid.success) return { ok: false, galat: "KK tidak ditemukan" };
  try {
    await hapusKk(user, idValid.data);
    revalidatePath("/kk");
    return { ok: true, id: idValid.data };
  } catch (e) {
    if (!(e instanceof GalatKk)) console.error("hapusKkAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: pesan(e) };
  }
}
