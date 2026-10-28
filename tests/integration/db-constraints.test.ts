import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class Rollback extends Error {}

// Setiap kasus berjalan di transaksi yang selalu dibatalkan, sehingga database tetap bersih.
async function dalamRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

async function tangkap(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "error";
  }
}

async function siapkanKk(tx: Tx, noKk: string) {
  const wilayah = await tx.wilayah.findFirstOrThrow();
  const user = await tx.user.create({
    data: {
      nama: "Penguji",
      email: `penguji-${noKk}@contoh.test`,
     
      role: "SUPER_ADMIN",
      status: "AKTIF",
    },
  });
  return tx.kartuKeluarga.create({
    data: { no_kk: noKk, alamat: "Jl. Uji No. 1", wilayah_id: wilayah.id, created_by: user.id },
  });
}

function dataWarga(kkId: string, nik: string, hubungan: "KEPALA_KELUARGA" | "ANAK") {
  return {
    kartu_keluarga_id: kkId,
    nik,
    nama_lengkap: "Warga Uji",
    jenis_kelamin: "L" as const,
    tanggal_lahir: new Date("1990-01-01"),
    hubungan_keluarga: hubungan,
  };
}

describe("constraint database", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("menolak dua Kepala Keluarga aktif di satu KK (BR-02)", async () => {
    await dalamRollback(async (tx) => {
      const kk = await siapkanKk(tx, "9990000000000001");
      await tx.warga.create({ data: dataWarga(kk.id, "9990000000000011", "KEPALA_KELUARGA") });
      const pesan = await tangkap(() =>
        tx.warga.create({ data: dataWarga(kk.id, "9990000000000012", "KEPALA_KELUARGA") }),
      );
      expect(pesan).not.toBeNull();
    });
  });

  it("mengizinkan Kepala Keluarga baru jika yang lama sudah dihapus (soft delete)", async () => {
    await dalamRollback(async (tx) => {
      const kk = await siapkanKk(tx, "9990000000000002");
      const lama = await tx.warga.create({
        data: dataWarga(kk.id, "9990000000000021", "KEPALA_KELUARGA"),
      });
      await tx.warga.update({ where: { id: lama.id }, data: { deleted_at: new Date() } });
      const baru = await tx.warga.create({
        data: dataWarga(kk.id, "9990000000000022", "KEPALA_KELUARGA"),
      });
      expect(baru.id).toBeTruthy();
    });
  });

  it("menolak warga tanpa KK (BR-01)", async () => {
    await dalamRollback(async (tx) => {
      const pesan = await tangkap(
        () =>
          tx.$executeRawUnsafe(
            `INSERT INTO warga (nik, nama_lengkap, jenis_kelamin, tanggal_lahir, hubungan_keluarga, updated_at)
             VALUES ('9990000000000031', 'Tanpa KK', 'L', '1990-01-01', 'ANAK', now())`,
          ),
      );
      expect(pesan).toMatch(/kartu_keluarga_id|null/i);
    });
  });

  it("menolak NIK ganda (BR-03)", async () => {
    await dalamRollback(async (tx) => {
      const kk = await siapkanKk(tx, "9990000000000004");
      await tx.warga.create({ data: dataWarga(kk.id, "9990000000000041", "KEPALA_KELUARGA") });
      const pesan = await tangkap(() =>
        tx.warga.create({ data: dataWarga(kk.id, "9990000000000041", "ANAK") }),
      );
      expect(pesan).not.toBeNull();
    });
  });

  it("menolak NIK yang bukan 16 digit angka (BR-03)", async () => {
    for (const nik of ["999000000000005", "99900000000000051", "99900000000005AB"]) {
      await dalamRollback(async (tx) => {
        const kk = await siapkanKk(tx, "9990000000000005");
        const pesan = await tangkap(
          () =>
            tx.$executeRawUnsafe(
              `INSERT INTO warga (kartu_keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, hubungan_keluarga, updated_at)
               VALUES ('${kk.id}', '${nik}', 'NIK Salah', 'L', '1990-01-01', 'ANAK', now())`,
            ),
        );
        expect(pesan).not.toBeNull();
      });
    }
  });

  it("menolak No KK ganda dan No KK yang bukan 16 digit (BR-03)", async () => {
    await dalamRollback(async (tx) => {
      const kk = await siapkanKk(tx, "9990000000000006");
      const wilayah = await tx.wilayah.findFirstOrThrow();
      const ganda = await tangkap(() =>
        tx.kartuKeluarga.create({
          data: { no_kk: "9990000000000006", alamat: "x", wilayah_id: wilayah.id, created_by: kk.created_by },
        }),
      );
      expect(ganda).not.toBeNull();
    });
    await dalamRollback(async (tx) => {
      const wilayah = await tx.wilayah.findFirstOrThrow();
      const user = await tx.user.create({
        data: { nama: "Penguji", email: "penguji-nokk@contoh.test", role: "SUPER_ADMIN", status: "AKTIF" },
      });
      const pendek = await tangkap(() =>
        tx.kartuKeluarga.create({
          data: { no_kk: "99900000000007", alamat: "x", wilayah_id: wilayah.id, created_by: user.id },
        }),
      );
      expect(pendek).not.toBeNull();
    });
  });
});
