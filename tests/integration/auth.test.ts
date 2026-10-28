import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { buatAkunAktif } from "@/lib/akun";
import { prisma } from "@/lib/db";

const SANDI = "Sandi-Uji-12345";
const EMAIL = "uji-auth@contoh.test";
const EMAIL_NONAKTIF = "uji-nonaktif@contoh.test";

async function bersihkan(): Promise<void> {
  const emails = [EMAIL, EMAIL_NONAKTIF];
  await prisma.activityLog.deleteMany({ where: { entitas: "email", entitas_id: { in: emails } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

async function masuk(email: string, password: string) {
  return auth.api.signInEmail({ body: { email, password } }).then(
    () => ({ ok: true as const }),
    (error: { statusCode?: number; message?: string }) => ({ ok: false as const, status: error.statusCode, pesan: error.message }),
  );
}

describe("autentikasi", () => {
  beforeAll(async () => {
    await bersihkan();
    await buatAkunAktif({ nama: "Uji Auth", email: EMAIL, kataSandi: SANDI, role: "ADMIN_RW", rw: "003" });
    const id = await buatAkunAktif({ nama: "Uji Nonaktif", email: EMAIL_NONAKTIF, kataSandi: SANDI, role: "ADMIN_RW", rw: "003" });
    await prisma.user.update({ where: { id }, data: { status: "NONAKTIF" } });
  });

  afterAll(async () => {
    await bersihkan();
    await prisma.$disconnect();
  });

  it("menolak kata sandi salah dengan pesan generik", async () => {
    const hasil = await masuk(EMAIL, "salah-salah-123");
    expect(hasil.ok).toBe(false);
  });

  it("menolak akun yang tidak aktif walau kata sandi benar", async () => {
    const hasil = await masuk(EMAIL_NONAKTIF, SANDI);
    expect(hasil.ok).toBe(false);
  });

  it("mengunci login setelah 5 kali gagal, termasuk kata sandi benar (FR-AUTH-04)", async () => {
    for (let i = 0; i < 5; i += 1) await masuk(EMAIL, "salah-salah-123");
    const hasil = await masuk(EMAIL, SANDI);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.status).toBe(429);
  });

  it("menerima login benar saat belum terkunci", async () => {
    await prisma.activityLog.deleteMany({ where: { entitas: "email", entitas_id: EMAIL } });
    const hasil = await masuk(EMAIL, SANDI);
    expect(hasil.ok).toBe(true);
  });
});
