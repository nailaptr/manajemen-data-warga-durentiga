import { hashPassword } from "better-auth/crypto";
import type { Role } from "../generated/prisma/client";
import { prisma } from "./db";

interface AkunBaru {
  nama: string;
  email: string;
  kataSandi: string;
  role: Role;
  wilayah_id?: string;
  rw?: string;
}

// Satu-satunya jalan membuat akun aktif dan terverifikasi dengan kata sandi (seed, skrip Super Admin).
export async function buatAkunAktif(data: AkunBaru): Promise<string> {
  const user = await prisma.user.create({
    data: {
      nama: data.nama,
      email: data.email.trim().toLowerCase(),
      role: data.role,
      status: "AKTIF",
      email_verified: true,
      wilayah_id: data.wilayah_id,
      rw: data.rw,
      accounts: {
        create: {
          providerId: "credential",
          accountId: "pending",
          password: await hashPassword(data.kataSandi),
        },
      },
    },
  });
  await prisma.account.updateMany({ where: { userId: user.id }, data: { accountId: user.id } });
  return user.id;
}
