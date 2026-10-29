import { buatAkunAktif } from "../lib/akun";
import { prisma } from "../lib/db";

// Satu akun uji per peran untuk pengembangan lokal. Menolak jalan di produksi.
// NIK/No KK di bawah palsu (berawalan 999), hanya agar akun Warga punya KK untuk diuji.
const NO_KK_UJI = "9990000000009001";
const NIK_UJI = "9990000000009011";

async function buatWargaUji(createdBy: string, wilayahId: string): Promise<string> {
  const kk = await prisma.kartuKeluarga.upsert({
    where: { no_kk: NO_KK_UJI },
    update: {},
    create: { no_kk: NO_KK_UJI, alamat: "Jl. Uji No. 1", wilayah_id: wilayahId, created_by: createdBy },
  });
  const warga = await prisma.warga.upsert({
    where: { nik: NIK_UJI },
    update: {},
    create: {
      kartu_keluarga_id: kk.id,
      nik: NIK_UJI,
      nama_lengkap: "Warga Uji",
      jenis_kelamin: "L",
      tanggal_lahir: new Date("1990-01-01"),
      hubungan_keluarga: "KEPALA_KELUARGA",
    },
  });
  return warga.id;
}

async function pastikanAkun(data: Parameters<typeof buatAkunAktif>[0]): Promise<string> {
  const ada = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  return ada ? ada.id : buatAkunAktif(data);
}

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

  const superAdminId = await pastikanAkun({
    nama: "Super Admin Uji", email: "superadmin@contoh.test", kataSandi, role: "SUPER_ADMIN", rw: "003",
  });
  await pastikanAkun({
    nama: "Admin RW Uji", email: "adminrw@contoh.test", kataSandi, role: "ADMIN_RW", rw: "003",
  });
  await pastikanAkun({
    nama: "Ketua RT 01 Uji", email: "ketuart01@contoh.test", kataSandi, role: "KETUA_RT", wilayah_id: rt01.id, rw: "003",
  });
  await pastikanAkun({
    nama: "Warga Uji", email: "warga@contoh.test", kataSandi, role: "WARGA",
    warga_id: await buatWargaUji(superAdminId, rt01.id),
  });
}
