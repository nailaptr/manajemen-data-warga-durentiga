import { buatAkunAktif } from "../lib/akun";
import { prisma } from "../lib/db";

// Akun uji untuk pengembangan lokal. Menolak jalan di produksi.
export async function seedAkunUji(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Akun uji tidak boleh dibuat di produksi.");
  }
  const kataSandi = process.env.SEED_DEV_PASSWORD;
  if (!kataSandi || kataSandi.length < 12) {
    console.info("SEED_DEV_PASSWORD kosong/kurang dari 12 karakter: akun uji dilewati.");
    return;
  }
  const rt01 = await prisma.wilayah.findUniqueOrThrow({ where: { rw_rt: { rw: "003", rt: "001" } } });
  const rt02 = await prisma.wilayah.findUniqueOrThrow({ where: { rw_rt: { rw: "003", rt: "002" } } });

  const akun = [
    { nama: "Super Admin Uji", email: "superadmin@contoh.test", role: "SUPER_ADMIN" as const, rw: "003" },
    { nama: "Admin RW Uji", email: "adminrw@contoh.test", role: "ADMIN_RW" as const, rw: "003" },
    { nama: "Ketua RT 01 Uji", email: "ketuart01@contoh.test", role: "KETUA_RT" as const, wilayah_id: rt01.id, rw: "003" },
    { nama: "Ketua RT 02 Uji", email: "ketuart02@contoh.test", role: "KETUA_RT" as const, wilayah_id: rt02.id, rw: "003" },
  ];
  for (const a of akun) {
    const ada = await prisma.user.findUnique({ where: { email: a.email } });
    if (!ada) await buatAkunAktif({ ...a, kataSandi });
  }
}
