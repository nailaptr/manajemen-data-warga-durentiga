"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { detailWarga, nomorLengkap, type DetailWarga } from "@/lib/data/warga";
import { PENGURUS } from "@/lib/navigasi";

export type HasilDetail = { ok: true; detail: DetailWarga } | { ok: false; galat: string };
export type HasilNomor = { ok: true; nik: string; no_kk: string } | { ok: false; galat: string };

const idSchema = z.string().uuid();
const TIDAK_DITEMUKAN = "Warga tidak ditemukan";
const GALAT_UMUM = "Terjadi kesalahan. Coba lagi.";

export async function detailWargaAksi(id: string): Promise<HasilDetail> {
  const user = await requireRole(...PENGURUS);
  if (!idSchema.safeParse(id).success) return { ok: false, galat: TIDAK_DITEMUKAN };
  try {
    const detail = await detailWarga(user, id);
    return detail ? { ok: true, detail } : { ok: false, galat: TIDAK_DITEMUKAN };
  } catch (e) {
    console.error("detailWargaAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: GALAT_UMUM };
  }
}

// Tombol "Tampilkan lengkap": mengembalikan NIK dan No KK penuh dan mencatatnya di activity_logs (AC-07).
export async function tampilkanLengkapAksi(id: string): Promise<HasilNomor> {
  const user = await requireRole(...PENGURUS);
  if (!idSchema.safeParse(id).success) return { ok: false, galat: TIDAK_DITEMUKAN };
  try {
    const hasil = await nomorLengkap(user, id);
    return hasil ? { ok: true, ...hasil } : { ok: false, galat: TIDAK_DITEMUKAN };
  } catch (e) {
    console.error("tampilkanLengkapAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: GALAT_UMUM };
  }
}
