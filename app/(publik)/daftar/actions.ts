"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { klaimAkun } from "@/lib/data/klaim";
import { tahanSampai } from "@/lib/klaim-limit";
import { klaimSchema } from "@/lib/validators/klaim";

export type HasilDaftar =
  | { ok: true }
  | { ok: false; galat: string; kolom?: Record<string, string> };

const GALAT_UMUM = "Terjadi kesalahan. Coba lagi.";

async function ipKlien(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "tidak-diketahui").trim();
}

export async function daftarAksi(input: unknown): Promise<HasilDaftar> {
  const parsed = klaimSchema.safeParse(input);
  if (!parsed.success) {
    const kolom = Object.fromEntries(
      Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Tidak valid"]),
    );
    return { ok: false, galat: "Periksa kembali isian Anda.", kolom };
  }

  const mulai = Date.now();
  try {
    const hasil = await klaimAkun(parsed.data, await ipKlien());
    if (!hasil.ok) return { ok: false, galat: hasil.pesan };
    try {
      await auth.api.sendVerificationEmail({ body: { email: hasil.email, callbackURL: "/masuk" } });
    } catch (e) {
      // Akun sudah dibuat; warga bisa meminta tautan lagi lewat halaman masuk.
      console.error("kirim verifikasi gagal", e instanceof Error ? e.name : "galat");
    }
    return { ok: true };
  } catch (e) {
    console.error("daftarAksi gagal", e instanceof Error ? e.name : "galat");
    return { ok: false, galat: GALAT_UMUM };
  } finally {
    await tahanSampai(mulai);
  }
}
