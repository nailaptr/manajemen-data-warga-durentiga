"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, requireRole, type Pengguna } from "@/lib/auth";
import { kirimEmail } from "@/lib/email";
import {
  GalatPengguna,
  setujuiKlaim,
  siapkanResetSandi,
  tambahPengurus,
  tolakKlaim,
  ubahPengurus,
  ubahStatusPengurus,
} from "@/lib/data/pengguna";
import { ADMIN, PENGURUS } from "@/lib/navigasi";
import { tambahPenggunaSchema, tolakKlaimSchema, ubahPenggunaSchema } from "@/lib/validators/pengguna";
import type { Role } from "../../../generated/prisma/client";

// `info` dipakai bila aksi berhasil tetapi ada hal yang perlu diketahui pengguna (mis. email gagal terkirim).
export type HasilAksi = { ok: true; info?: string } | { ok: false; galat: string };

const idSchema = z.string().uuid();
const GALAT_ID = "Data tidak ditemukan";
const GALAT_UMUM = "Terjadi kesalahan. Data tidak tersimpan.";

async function bungkus(peran: Role[], nama: string, fn: (user: Pengguna) => Promise<string | undefined>): Promise<HasilAksi> {
  const user = await requireRole(...peran);
  try {
    const info = await fn(user);
    revalidatePath("/pengguna");
    revalidatePath("/pengguna/klaim");
    return { ok: true, info };
  } catch (e) {
    if (e instanceof GalatPengguna) return { ok: false, galat: e.message };
    console.error(`${nama} gagal`, e instanceof Error ? e.name : "galat");
    return { ok: false, galat: GALAT_UMUM };
  }
}

// Email hanya kabar; kegagalan kirim tidak membatalkan keputusan yang sudah tersimpan.
async function kirimAman(nama: string, kirim: () => Promise<void>): Promise<boolean> {
  try {
    await kirim();
    return true;
  } catch (e) {
    console.error(`${nama}: email gagal dikirim`, e instanceof Error ? e.name : "galat");
    return false;
  }
}

const kirimTautanSandi = (email: string) =>
  auth.api.requestPasswordReset({ body: { email, redirectTo: "/atur-ulang-sandi" } }).then(() => undefined);

// Dipanggil di dalam bungkus(), sesudah requireRole: pemanggil tanpa hak tidak mendapat pesan validasi.
function validasi<T>(skema: z.ZodType<T>, input: unknown, galat?: string): T {
  const hasil = skema.safeParse(input);
  if (!hasil.success) throw new GalatPengguna(galat ?? hasil.error.issues[0]?.message ?? "Data tidak valid");
  return hasil.data;
}

export async function tambahPengurusAksi(input: unknown): Promise<HasilAksi> {
  return bungkus(ADMIN, "tambahPengurusAksi", async (u) => {
    const { email } = await tambahPengurus(u, validasi(tambahPenggunaSchema, input));
    const terkirim = await kirimAman("tambahPengurusAksi", () => kirimTautanSandi(email));
    return terkirim ? undefined : "Akun dibuat, tetapi email atur kata sandi gagal dikirim. Gunakan Reset sandi untuk mengirim ulang.";
  });
}

export async function ubahPengurusAksi(id: string, input: unknown): Promise<HasilAksi> {
  return bungkus(ADMIN, "ubahPengurusAksi", async (u) => {
    await ubahPengurus(u, validasi(idSchema, id, GALAT_ID), validasi(ubahPenggunaSchema, input));
    return undefined;
  });
}

export async function ubahStatusPengurusAksi(id: string, status: "AKTIF" | "NONAKTIF"): Promise<HasilAksi> {
  return bungkus(ADMIN, "ubahStatusPengurusAksi", async (u) => {
    await ubahStatusPengurus(u, validasi(idSchema, id, GALAT_ID), validasi(z.enum(["AKTIF", "NONAKTIF"]), status, GALAT_ID));
    return undefined;
  });
}

export async function resetSandiPengurusAksi(id: string): Promise<HasilAksi> {
  return bungkus(ADMIN, "resetSandiPengurusAksi", async (u) => {
    const { email } = await siapkanResetSandi(u, validasi(idSchema, id, GALAT_ID));
    const terkirim = await kirimAman("resetSandiPengurusAksi", () => kirimTautanSandi(email));
    return terkirim ? "Tautan atur ulang kata sandi sudah dikirim." : "Email atur ulang kata sandi gagal dikirim. Coba lagi nanti.";
  });
}

export async function setujuiKlaimAksi(id: string): Promise<HasilAksi> {
  return bungkus(PENGURUS, "setujuiKlaimAksi", async (u) => {
    const { email, nama } = await setujuiKlaim(u, validasi(idSchema, id, GALAT_ID));
    const terkirim = await kirimAman("setujuiKlaimAksi", () =>
      kirimEmail({ ke: email, subjek: "Akun Anda disetujui", pesan: `Halo ${nama}, klaim akun Anda sudah disetujui pengurus RT. Silakan masuk ke portal warga.` }),
    );
    return terkirim ? undefined : "Klaim disetujui, tetapi email kabar ke pendaftar gagal dikirim.";
  });
}

export async function tolakKlaimAksi(id: string, input: unknown): Promise<HasilAksi> {
  return bungkus(PENGURUS, "tolakKlaimAksi", async (u) => {
    const idKlaim = validasi(idSchema, id, GALAT_ID);
    const data = validasi(tolakKlaimSchema, input);
    const { email, nama } = await tolakKlaim(u, idKlaim, data);
    const alasan = data.alasan ? ` Alasan: ${data.alasan}` : "";
    const terkirim = await kirimAman("tolakKlaimAksi", () =>
      kirimEmail({ ke: email, subjek: "Klaim akun Anda ditolak", pesan: `Halo ${nama}, klaim akun Anda belum dapat disetujui pengurus RT.${alasan} Hubungi pengurus RT Anda bila ada yang perlu diperbaiki.` }),
    );
    return terkirim ? undefined : "Klaim ditolak, tetapi email kabar ke pendaftar gagal dikirim.";
  });
}
