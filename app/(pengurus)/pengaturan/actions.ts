"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  GalatPengaturan,
  hapusPekerjaan,
  hapusPendidikan,
  hapusWilayah,
  simpanKategoriUsia,
  simpanPekerjaan,
  simpanPendidikan,
  simpanWilayah,
} from "@/lib/data/pengaturan";
import { ADMIN } from "@/lib/navigasi";
import { kategoriUsiaSchema, pekerjaanSchema, pendidikanSchema, wilayahSchema } from "@/lib/validators/pengaturan";

export type HasilPengaturan = { ok: true } | { ok: false; galat: string };

const idSchema = z.string().uuid();

// Semua aksi: hanya Admin RW dan Super Admin, input divalidasi Zod, galat bisnis ditampilkan apa adanya.
async function bungkus(nama: string, fn: (user: Awaited<ReturnType<typeof requireRole>>) => Promise<void>): Promise<HasilPengaturan> {
  const user = await requireRole(...ADMIN);
  try {
    await fn(user);
    revalidatePath("/pengaturan");
    return { ok: true };
  } catch (e) {
    if (e instanceof GalatPengaturan) return { ok: false, galat: e.message };
    console.error(`${nama} gagal`, e instanceof Error ? e.name : "galat");
    return { ok: false, galat: "Terjadi kesalahan. Data tidak tersimpan." };
  }
}

function idAtauGalat(id: string | undefined): { ok: true; id?: string } | { ok: false; galat: string } {
  if (id === undefined) return { ok: true };
  const r = idSchema.safeParse(id);
  return r.success ? { ok: true, id: r.data } : { ok: false, galat: "Data tidak ditemukan" };
}

function pesanPertama(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Data tidak valid";
}

export async function simpanPendidikanAksi(input: unknown, id?: string): Promise<HasilPengaturan> {
  const idCek = idAtauGalat(id);
  if (!idCek.ok) return idCek;
  const data = pendidikanSchema.safeParse(input);
  if (!data.success) return { ok: false, galat: pesanPertama(data.error) };
  return bungkus("simpanPendidikanAksi", async (u) => void (await simpanPendidikan(u, data.data, idCek.id)));
}

export async function hapusPendidikanAksi(id: string): Promise<HasilPengaturan> {
  const idCek = idSchema.safeParse(id);
  if (!idCek.success) return { ok: false, galat: "Data tidak ditemukan" };
  return bungkus("hapusPendidikanAksi", (u) => hapusPendidikan(u, idCek.data));
}

export async function simpanPekerjaanAksi(input: unknown, id?: string): Promise<HasilPengaturan> {
  const idCek = idAtauGalat(id);
  if (!idCek.ok) return idCek;
  const data = pekerjaanSchema.safeParse(input);
  if (!data.success) return { ok: false, galat: pesanPertama(data.error) };
  return bungkus("simpanPekerjaanAksi", async (u) => void (await simpanPekerjaan(u, data.data, idCek.id)));
}

export async function hapusPekerjaanAksi(id: string): Promise<HasilPengaturan> {
  const idCek = idSchema.safeParse(id);
  if (!idCek.success) return { ok: false, galat: "Data tidak ditemukan" };
  return bungkus("hapusPekerjaanAksi", (u) => hapusPekerjaan(u, idCek.data));
}

export async function simpanKategoriUsiaAksi(input: unknown): Promise<HasilPengaturan> {
  const data = kategoriUsiaSchema.safeParse(input);
  if (!data.success) return { ok: false, galat: pesanPertama(data.error) };
  return bungkus("simpanKategoriUsiaAksi", (u) => simpanKategoriUsia(u, data.data));
}

export async function simpanWilayahAksi(input: unknown, id?: string): Promise<HasilPengaturan> {
  const idCek = idAtauGalat(id);
  if (!idCek.ok) return idCek;
  const data = wilayahSchema.safeParse(input);
  if (!data.success) return { ok: false, galat: pesanPertama(data.error) };
  return bungkus("simpanWilayahAksi", async (u) => void (await simpanWilayah(u, data.data, idCek.id)));
}

export async function hapusWilayahAksi(id: string): Promise<HasilPengaturan> {
  const idCek = idSchema.safeParse(id);
  if (!idCek.success) return { ok: false, galat: "Data tidak ditemukan" };
  return bungkus("hapusWilayahAksi", (u) => hapusWilayah(u, idCek.data));
}
