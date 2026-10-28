import "dotenv/config";
import { prisma } from "../lib/db";
import { seedAkunUji } from "./seed-dev-users";

// Nilai awal kategori usia dari PRD 6.2; usulan, bisa diubah lewat halaman Pengaturan.
const KATEGORI_USIA = [
  { nama: "Batita", usia_min: 0, usia_maks: 3, jenis_kelamin: null },
  { nama: "Balita", usia_min: 0, usia_maks: 5, jenis_kelamin: null },
  { nama: "Anak", usia_min: 6, usia_maks: 11, jenis_kelamin: null },
  { nama: "Remaja", usia_min: 12, usia_maks: 17, jenis_kelamin: null },
  { nama: "Dewasa", usia_min: 18, usia_maks: 59, jenis_kelamin: null },
  { nama: "Usia subur", usia_min: 15, usia_maks: 49, jenis_kelamin: "P" },
  { nama: "Lansia", usia_min: 60, usia_maks: null, jenis_kelamin: null },
] as const;

// Urutan dan alias mengikuti mockup Pengaturan.
const PENDIDIKAN = [
  { nama: "Tidak/Belum Sekolah", alias: ["Tidak Sekolah", "Belum Sekolah"] },
  { nama: "SD", alias: ["SD/Sederajat", "MI"] },
  { nama: "SMP", alias: ["SMP/Sederajat", "MTs"] },
  { nama: "SMA", alias: ["SMA/Sederajat", "SMK", "MA"] },
  { nama: "D1–D3", alias: ["Diploma", "D3"] },
  { nama: "D4/S1", alias: ["S1", "D4"] },
  { nama: "S2", alias: ["Magister"] },
  { nama: "S3", alias: ["Doktor"] },
];

const PEKERJAAN = [
  { nama: "Belum/Tidak Bekerja", alias: ["Belum Bekerja", "Tidak Bekerja"] },
  { nama: "Pelajar/Mahasiswa", alias: ["Pelajar", "Mahasiswa"] },
  { nama: "Ibu Rumah Tangga", alias: ["IRT", "Mengurus Rumah Tangga"] },
  { nama: "Karyawan Swasta", alias: ["Swasta"] },
  { nama: "Wiraswasta", alias: ["Wirausaha"] },
  { nama: "PNS/TNI/Polri", alias: ["PNS", "TNI", "Polri"] },
  { nama: "Lainnya", alias: [] },
];

const RW = "003";
const RT_LIST = ["001", "002", "003", "004", "005"];

async function main(): Promise<void> {
  for (const rt of RT_LIST) {
    await prisma.wilayah.upsert({
      where: { rw_rt: { rw: RW, rt } },
      update: {},
      create: { rw: RW, rt, keterangan: `RT ${rt.slice(1)}/RW ${RW.slice(1)}` },
    });
  }

  for (const [i, p] of PENDIDIKAN.entries()) {
    await prisma.refPendidikan.upsert({
      where: { nama: p.nama },
      update: {},
      create: { nama: p.nama, urutan: i + 1, alias: p.alias },
    });
  }

  for (const p of PEKERJAAN) {
    await prisma.refPekerjaan.upsert({
      where: { nama: p.nama },
      update: {},
      create: { nama: p.nama, alias: p.alias },
    });
  }

  for (const [i, k] of KATEGORI_USIA.entries()) {
    const ada = await prisma.kategoriUsia.findFirst({ where: { nama: k.nama } });
    if (!ada) {
      await prisma.kategoriUsia.create({ data: { ...k, urutan: i + 1 } });
    }
  }

  await seedAkunUji();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error("Seed gagal:", error instanceof Error ? error.message : "kesalahan tidak dikenal");
    await prisma.$disconnect();
    process.exit(1);
  });
