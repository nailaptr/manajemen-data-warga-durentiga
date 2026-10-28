import { prisma } from "./db";

const AKSI_LOGIN_GAGAL = "LOGIN_GAGAL";
const JENDELA_MS = 15 * 60 * 1000;

function normalisasi(email: string): string {
  return email.trim().toLowerCase();
}

export async function hitungLoginGagal(email: string): Promise<number> {
  return prisma.activityLog.count({
    where: {
      aksi: AKSI_LOGIN_GAGAL,
      entitas_id: normalisasi(email),
      created_at: { gt: new Date(Date.now() - JENDELA_MS) },
    },
  });
}

export async function catatLoginGagal(email: string): Promise<void> {
  await prisma.activityLog.create({
    data: { aksi: AKSI_LOGIN_GAGAL, entitas: "email", entitas_id: normalisasi(email) },
  });
}
