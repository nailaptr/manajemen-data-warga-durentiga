import { createHmac } from "node:crypto";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";

type Klien = Pick<Prisma.TransactionClient, "activityLog">;

const AKSI_PERCOBAAN = "KLAIM_PERCOBAAN";
const ENTITAS_IP = "klaim_ip";
const ENTITAS_NIK = "klaim_nik";
const JENDELA_MS = 60 * 60 * 1000;
export const BATAS_PERCOBAAN = 5;
// Lantai waktu respons klaim: kasus cocok dan tidak cocok tidak boleh dibedakan dari lamanya.
export const LANTAI_WAKTU_MS = 800;

function rahasia(): string {
  const nilai = process.env.BETTER_AUTH_SECRET;
  if (!nilai) throw new Error("BETTER_AUTH_SECRET belum diatur.");
  return nilai;
}

// NIK dan IP tidak disimpan apa adanya di activity_logs, hanya sidik HMAC-nya.
const sidik = (jenis: string, nilai: string): string => createHmac("sha256", rahasia()).update(`${jenis}:${nilai}`).digest("hex");

// Mencatat percobaan lebih dulu, baru menghitung, sehingga dua permintaan serentak tidak lolos bersama.
// Mengembalikan true bila percobaan ini melewati batas per IP atau per NIK dalam satu jam (PRD 3.1, SEC-05).
export async function catatDanCekPercobaan(ip: string, nik: string, db: Klien = prisma): Promise<boolean> {
  const idIp = sidik(ENTITAS_IP, ip);
  const idNik = sidik(ENTITAS_NIK, nik);
  await db.activityLog.createMany({
    data: [
      { aksi: AKSI_PERCOBAAN, entitas: ENTITAS_IP, entitas_id: idIp },
      { aksi: AKSI_PERCOBAAN, entitas: ENTITAS_NIK, entitas_id: idNik },
    ],
  });
  const sejak = { gt: new Date(Date.now() - JENDELA_MS) };
  // Berurutan: klien transaksi (tes) tidak boleh menerima dua query serentak.
  const perIp = await db.activityLog.count({ where: { aksi: AKSI_PERCOBAAN, entitas: ENTITAS_IP, entitas_id: idIp, created_at: sejak } });
  const perNik = await db.activityLog.count({ where: { aksi: AKSI_PERCOBAAN, entitas: ENTITAS_NIK, entitas_id: idNik, created_at: sejak } });
  return perIp > BATAS_PERCOBAAN || perNik > BATAS_PERCOBAAN;
}

export async function tahanSampai(mulai: number, lantaiMs: number = LANTAI_WAKTU_MS): Promise<void> {
  const sisa = lantaiMs - (Date.now() - mulai);
  if (sisa > 0) await new Promise((selesai) => setTimeout(selesai, sisa));
}
