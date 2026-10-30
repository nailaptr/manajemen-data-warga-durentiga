import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db";

// Membuat 10.000 warga fiktif acak untuk uji performa Dashboard dan Cari Warga. Bukan data asli:
// NIK dan No KK berawalan 99908, nama dari daftar kata karangan. Acak tetapi berulang (benih tetap).
// Pemakaian: pnpm db:seed:uji
const JUMLAH_WARGA = 10_000;
const AWALAN = "99908";
const KK_PER_BATCH = 500;
const BENIH = 20261030;

const NAMA_DEPAN = ["Ahmad", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi", "Indah", "Joko", "Kartika", "Lestari", "Mawar", "Nanda", "Putra", "Rani", "Sari", "Tono", "Umar", "Wulan"];
const NAMA_BELAKANG = ["Pratama", "Wijaya", "Santoso", "Lestari", "Hidayat", "Kusuma", "Saputra", "Nugroho", "Rahayu", "Setiawan", "Utami", "Permana"];

// Pembangkit acak sederhana dengan benih tetap (mulberry32).
function acak(benih: number): () => number {
  let a = benih;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = acak(BENIH);
const antara = (min: number, maks: number) => min + Math.floor(rand() * (maks - min + 1));
const pilih = <T>(daftar: readonly T[]): T => daftar[Math.floor(rand() * daftar.length)]!;
const nomor = (n: number) => `${AWALAN}${String(n).padStart(11, "0")}`;

function lahirDari(usia: number, hariIni: Date): Date {
  const hari = new Date(hariIni.getTime() - usia * 365.25 * 86_400_000 - antara(0, 364) * 86_400_000);
  return new Date(Date.UTC(hari.getUTCFullYear(), hari.getUTCMonth(), hari.getUTCDate()));
}

function pastikanAmanDijalankan(): void {
  if (process.env.NODE_ENV === "production") throw new Error("Menolak jalan saat NODE_ENV=production.");
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://x@invalid/").hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("Menolak jalan: DATABASE_URL bukan database lokal.");
  }
}

async function main(): Promise<void> {
  pastikanAmanDijalankan();
  if ((await prisma.warga.count({ where: { nik: { startsWith: AWALAN } } })) > 0) {
    throw new Error("Data uji sudah ada (NIK berawalan 99908). Tidak ada yang dibuat.");
  }
  const pembuat = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "AKTIF" } });
  if (!pembuat) throw new Error("Butuh satu Super Admin aktif: jalankan pnpm db:seed (dengan SEED_DEV_PASSWORD) lebih dulu.");
  const [wilayah, pendidikan, pekerjaan] = await Promise.all([
    prisma.wilayah.findMany(),
    prisma.refPendidikan.findMany(),
    prisma.refPekerjaan.findMany(),
  ]);
  if (!wilayah.length || !pendidikan.length || !pekerjaan.length) throw new Error("Jalankan pnpm db:seed lebih dulu.");

  const hariIni = new Date();
  const pend = (usia: number) => {
    const nama = usia < 6 ? "Tidak/Belum Sekolah" : usia < 13 ? "SD" : usia < 16 ? "SMP" : pilih(["SMA", "SMA", "SMA", "D4/S1", "SMP", "SD"]);
    return (pendidikan.find((p) => p.nama === nama) ?? pilih(pendidikan)).id;
  };
  const pek = (usia: number) => {
    const nama = usia < 17 ? "Pelajar/Mahasiswa" : pilih(["Karyawan Swasta", "Wiraswasta", "Ibu Rumah Tangga", "Belum/Tidak Bekerja", "PNS/TNI/Polri"]);
    return (pekerjaan.find((p) => p.nama === nama) ?? pilih(pekerjaan)).id;
  };

  let urut = 0;
  let dibuat = 0;
  let kkKe = 0;
  while (dibuat < JUMLAH_WARGA) {
    const kk: { id: string; no_kk: string; alamat: string; wilayah_id: string; created_by: string }[] = [];
    const warga: {
      kartu_keluarga_id: string; nik: string; nama_lengkap: string; jenis_kelamin: "L" | "P"; tanggal_lahir: Date;
      hubungan_keluarga: "KEPALA_KELUARGA" | "ISTRI" | "SUAMI" | "ANAK"; agama: "ISLAM" | "KRISTEN" | "KATOLIK";
      pendidikan_id: string | null; pekerjaan_id: string | null; status_kependudukan: "AKTIF" | "PINDAH" | "MENINGGAL";
    }[] = [];

    for (let i = 0; i < KK_PER_BATCH && dibuat < JUMLAH_WARGA; i++) {
      kkKe += 1;
      const id = randomUUID();
      kk.push({ id, no_kk: nomor(kkKe), alamat: `Jl. Uji No. ${antara(1, 99)}`, wilayah_id: pilih(wilayah).id, created_by: pembuat.id });
      const agama = pilih(["ISLAM", "ISLAM", "ISLAM", "KRISTEN", "KATOLIK"] as const);
      const kepalaLaki = rand() < 0.8;
      const usiaKepala = antara(22, 75);
      const anggota: [usia: number, jk: "L" | "P", hubungan: (typeof warga)[number]["hubungan_keluarga"]][] = [
        [usiaKepala, kepalaLaki ? "L" : "P", "KEPALA_KELUARGA"],
      ];
      if (usiaKepala > 24 && rand() < 0.75) anggota.push([Math.max(18, usiaKepala + antara(-6, 4)), kepalaLaki ? "P" : "L", kepalaLaki ? "ISTRI" : "SUAMI"]);
      if (usiaKepala > 26) for (let a = antara(0, 4); a > 0; a--) anggota.push([Math.max(0, Math.min(usiaKepala - 20, antara(0, 30))), rand() < 0.5 ? "L" : "P", "ANAK"]);

      for (const [usia, jk, hubungan] of anggota) {
        if (dibuat >= JUMLAH_WARGA) break;
        urut += 1;
        dibuat += 1;
        const r = rand();
        warga.push({
          kartu_keluarga_id: id,
          nik: nomor(urut),
          nama_lengkap: `${pilih(NAMA_DEPAN)} ${pilih(NAMA_BELAKANG)}`,
          jenis_kelamin: jk,
          tanggal_lahir: lahirDari(usia, hariIni),
          hubungan_keluarga: hubungan,
          agama,
          pendidikan_id: rand() < 0.05 ? null : pend(usia),
          pekerjaan_id: rand() < 0.05 ? null : pek(usia),
          status_kependudukan: r < 0.94 ? "AKTIF" : r < 0.98 ? "PINDAH" : "MENINGGAL",
        });
      }
    }
    await prisma.$transaction([prisma.kartuKeluarga.createMany({ data: kk }), prisma.warga.createMany({ data: warga })]);
  }
  console.info(`Dibuat ${dibuat} warga fiktif dalam ${kkKe} KK.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed uji gagal.");
    await prisma.$disconnect();
    process.exit(1);
  });
