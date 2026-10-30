import { hashPassword } from "better-auth/crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { buatAkun } from "../akun";
import { catatAktivitas } from "../activity-log";
import { prisma } from "../db";
import { hariJakarta, mundurTahun } from "../filters";
import { catatDanCekPercobaan } from "../klaim-limit";
import type { KlaimData } from "../validators/klaim";

type Klien = PrismaClient | Prisma.TransactionClient;

export const USIA_MINIMAL_AKUN = 17;
// Satu pesan untuk semua kegagalan pencocokan (SEC-05, AC-09): tidak menyebut data mana yang salah.
export const PESAN_KLAIM_GAGAL = "Data tidak dapat diverifikasi. Periksa kembali isian Anda atau hubungi pengurus RT.";
export const PESAN_KLAIM_DIBATASI = "Terlalu banyak percobaan. Coba lagi dalam 1 jam.";

const ID_KOSONG = "00000000-0000-0000-0000-000000000000";

export type HasilKlaim =
  | { ok: true; email: string }
  | { ok: false; kode: "GAGAL" | "DIBATASI"; pesan: string };

const gagal: HasilKlaim = { ok: false, kode: "GAGAL", pesan: PESAN_KLAIM_GAGAL };
const dibatasi: HasilKlaim = { ok: false, kode: "DIBATASI", pesan: PESAN_KLAIM_DIBATASI };

function jalankan<T>(db: Klien, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

const pelanggaranUnik = (e: unknown): boolean => typeof e === "object" && e !== null && "code" in e && e.code === "P2002";

// Klaim akun warga (PRD 3.1). Jumlah query dan hash kata sandi sama untuk semua hasil pencocokan.
export async function klaimAkun(
  input: KlaimData,
  ip: string,
  db: Klien = prisma,
  hari: Date = hariJakarta(),
): Promise<HasilKlaim> {
  const hashSandi = await hashPassword(input.kata_sandi);
  if (await catatDanCekPercobaan(ip, input.nik, db)) return dibatasi;

  const warga = await db.warga.findFirst({
    where: {
      nik: input.nik,
      status_kependudukan: "AKTIF",
      deleted_at: null,
      AND: [{ tanggal_lahir: new Date(input.tanggal_lahir) }, { tanggal_lahir: { lte: mundurTahun(hari, USIA_MINIMAL_AKUN) } }],
      kartu_keluarga: { no_kk: input.no_kk, deleted_at: null },
    },
    select: { id: true, nama_lengkap: true },
  });
  // Warga sudah diklaim atau email sudah dipakai: dijawab sama dengan data tidak cocok.
  const bentrok = await db.user.findFirst({
    where: { OR: [{ warga_id: warga?.id ?? ID_KOSONG }, { email: input.email }] },
    select: { id: true },
  });
  if (!warga || bentrok) return gagal;

  try {
    await jalankan(db, async (tx) => {
      const userId = await buatAkun(
        { nama: warga.nama_lengkap, email: input.email, role: "WARGA", warga_id: warga.id, hashSandi, status: "MENUNGGU_VERIFIKASI", email_verified: false },
        tx,
      );
      await catatAktivitas(
        { userId, aksi: "KLAIM_DIAJUKAN", entitas: "user", entitasId: userId, perubahan: { persetujuan_privasi: true } },
        tx,
      );
    });
  } catch (e) {
    // Balapan: unique warga_id atau email menahan klaim kedua.
    if (pelanggaranUnik(e)) return gagal;
    throw e;
  }
  return { ok: true, email: input.email };
}
