import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Prisma, Role, UserStatus } from "../generated/prisma/client";
import { prisma } from "./db";

interface AkunDasar {
  nama: string;
  email: string;
  role: Role;
  wilayah_id?: string;
  rw?: string;
  warga_id?: string;
}

// Hash sudah dihitung pemanggil, sehingga kata sandi mentah tidak ikut ke sini.
interface AkunTersimpan extends AkunDasar {
  hashSandi: string;
  status: UserStatus;
  email_verified: boolean;
}

// Satu-satunya jalan membuat akun berkata sandi: user dan account credential dalam satu penulisan.
export async function buatAkun(data: AkunTersimpan, klien: Pick<Prisma.TransactionClient, "user"> = prisma): Promise<string> {
  const id = randomUUID();
  await klien.user.create({
    data: {
      id,
      nama: data.nama,
      email: data.email.trim().toLowerCase(),
      role: data.role,
      status: data.status,
      email_verified: data.email_verified,
      wilayah_id: data.wilayah_id,
      rw: data.rw,
      warga_id: data.warga_id,
      accounts: { create: { providerId: "credential", accountId: id, password: data.hashSandi } },
    },
  });
  return id;
}

// Akun aktif dan terverifikasi (seed, skrip Super Admin).
export async function buatAkunAktif(data: AkunDasar & { kataSandi: string }): Promise<string> {
  const { kataSandi, ...dasar } = data;
  return buatAkun({ ...dasar, hashSandi: await hashPassword(kataSandi), status: "AKTIF", email_verified: true });
}
