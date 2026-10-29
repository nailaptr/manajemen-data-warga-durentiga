import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import type { Role } from "../generated/prisma/client";
import { prisma } from "./db";
import { kirimEmail } from "./email";
import { catatLoginGagal, hitungLoginGagal } from "./login-lockout";

const SIGN_IN_PATH = "/sign-in/email";
const SESI_30_MENIT = 60 * 30;

// Akun tidak dibuat lewat sign-up Better Auth: pengurus lewat seed/skrip, warga lewat klaim akun.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    fields: {
      name: "nama",
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await kirimEmail({ ke: user.email, subjek: "Atur ulang kata sandi", tautan: url });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await kirimEmail({ ke: user.email, subjek: "Verifikasi email", tautan: url });
    },
  },
  // Semua kunci utama di skema bertipe uuid.
  advanced: { database: { generateId: "uuid" } },
  // FR-AUTH-04: sesi berakhir setelah 30 menit tidak aktif (diperpanjang saat dipakai).
  session: { expiresIn: SESI_30_MENIT, updateAge: 60 * 5 },
  databaseHooks: {
    session: {
      create: {
        before: async (sesi) => {
          const pengguna = await prisma.user.findUnique({
            where: { id: sesi.userId },
            select: { status: true },
          });
          if (pengguna?.status !== "AKTIF") {
            throw new APIError("FORBIDDEN", { message: "Akun belum aktif." });
          }
        },
      },
    },
  },
  hooks: {
    // FR-AUTH-04: kunci 15 menit setelah 5 kali gagal login. Berlaku untuk email apa pun
    // agar respons tidak membuka email mana yang terdaftar.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      if (typeof email !== "string") return;
      if ((await hitungLoginGagal(email)) >= 5) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      const hasil = ctx.context.returned;
      if (typeof email === "string" && hasil instanceof APIError && hasil.statusCode === 401) {
        await catatLoginGagal(email);
      }
    }),
  },
  plugins: [nextCookies()],
});

export interface Pengguna {
  id: string;
  nama: string;
  email: string;
  role: Role;
  wilayah_id: string | null;
  rw: string | null;
  warga_id: string | null;
}

// Peran dan status dibaca ulang dari database di tiap permintaan, sehingga akun yang
// dinonaktifkan langsung kehilangan akses tanpa menunggu sesinya habis.
export async function getSession(): Promise<Pengguna | null> {
  const sesi = await auth.api.getSession({ headers: await headers() });
  if (!sesi) return null;
  const pengguna = await prisma.user.findUnique({
    where: { id: sesi.user.id },
    select: { id: true, nama: true, email: true, role: true, status: true, wilayah_id: true, rw: true, warga_id: true },
  });
  if (!pengguna || pengguna.status !== "AKTIF") return null;
  return {
    id: pengguna.id,
    nama: pengguna.nama,
    email: pengguna.email,
    role: pengguna.role,
    wilayah_id: pengguna.wilayah_id,
    rw: pengguna.rw,
    warga_id: pengguna.warga_id,
  };
}

// Belum masuk -> /masuk. Sudah masuk tetapi peran tidak sesuai -> /tidak-berwenang.
export async function requireRole(...peran: Role[]): Promise<Pengguna> {
  const pengguna = await getSession();
  if (!pengguna) redirect("/masuk");
  if (!peran.includes(pengguna.role)) redirect("/tidak-berwenang");
  return pengguna;
}
