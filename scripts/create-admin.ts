import "dotenv/config";
import { buatAkunAktif } from "../lib/akun";
import { prisma } from "../lib/db";

// Sekali jalan untuk membuat Super Admin pertama (terutama di produksi).
// Pemakaian: ADMIN_NAMA=... ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm db:create-admin
async function main(): Promise<void> {
  const { ADMIN_NAMA, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAMA || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_NAMA, ADMIN_EMAIL, dan ADMIN_PASSWORD wajib diisi.");
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD minimal 12 karakter.");
  }
  if ((await prisma.user.count({ where: { role: "SUPER_ADMIN", status: "AKTIF" } })) > 0) {
    throw new Error("Super Admin aktif sudah ada. Tidak ada yang dibuat.");
  }
  await buatAkunAktif({ nama: ADMIN_NAMA, email: ADMIN_EMAIL, kataSandi: ADMIN_PASSWORD, role: "SUPER_ADMIN" });
  console.info("Super Admin dibuat.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Gagal membuat Super Admin.");
    await prisma.$disconnect();
    process.exit(1);
  });
