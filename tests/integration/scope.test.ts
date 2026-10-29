import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { scopeWhere } from "@/lib/scope";
import { dalamRollback, type Tx } from "./helpers";

type PenggunaUji = Parameters<typeof scopeWhere>[0];

interface Data {
  rt1: string;
  rt2: string;
  kkA: string; // RT 001
  kkB: string; // RT 001
  kkC: string; // RT 002
  wargaA: string;
  wargaB: string;
  wargaC: string;
  pengajuan: { A: string; B: string; C: string };
}

// Tiga KK: A dan B di RT 001, C di RT 002. Masing-masing satu warga dan satu pengajuan.
async function siapkan(tx: Tx): Promise<Data> {
  const rt1 = await tx.wilayah.findUniqueOrThrow({ where: { rw_rt: { rw: "003", rt: "001" } } });
  const rt2 = await tx.wilayah.findUniqueOrThrow({ where: { rw_rt: { rw: "003", rt: "002" } } });
  const user = await tx.user.create({
    data: { nama: "Penguji", email: "penguji-scope@contoh.test", role: "SUPER_ADMIN", status: "AKTIF" },
  });

  async function buat(huruf: "A" | "B" | "C", wilayahId: string, urut: number) {
    const kk = await tx.kartuKeluarga.create({
      data: { no_kk: `99900000000008${urut}0`, alamat: "Jl. Uji", wilayah_id: wilayahId, created_by: user.id },
    });
    const warga = await tx.warga.create({
      data: {
        kartu_keluarga_id: kk.id,
        nik: `99900000000008${urut}1`,
        nama_lengkap: `Warga ${huruf}`,
        jenis_kelamin: "L",
        tanggal_lahir: new Date("1990-01-01"),
        hubungan_keluarga: "KEPALA_KELUARGA",
      },
    });
    const pengajuan = await tx.pengajuan.create({
      data: { kartu_keluarga_id: kk.id, diajukan_oleh: user.id, jenis: "UBAH_WARGA", warga_id: warga.id },
    });
    return { kk: kk.id, warga: warga.id, pengajuan: pengajuan.id };
  }

  const a = await buat("A", rt1.id, 1);
  const b = await buat("B", rt1.id, 2);
  const c = await buat("C", rt2.id, 3);
  return {
    rt1: rt1.id,
    rt2: rt2.id,
    kkA: a.kk,
    kkB: b.kk,
    kkC: c.kk,
    wargaA: a.warga,
    wargaB: b.warga,
    wargaC: c.warga,
    pengajuan: { A: a.pengajuan, B: b.pengajuan, C: c.pengajuan },
  };
}

// Data uji dibatasi ke id yang baru dibuat supaya data seed tidak ikut terhitung.
async function lihat(tx: Tx, d: Data, user: PenggunaUji) {
  const batas = (ids: string[]) => ({ id: { in: ids } });
  const [warga, kk, pengajuan] = await Promise.all([
    tx.warga.findMany({
      where: { AND: [scopeWhere(user, "warga"), batas([d.wargaA, d.wargaB, d.wargaC])] },
      select: { id: true },
    }),
    tx.kartuKeluarga.findMany({
      where: { AND: [scopeWhere(user, "kartu_keluarga"), batas([d.kkA, d.kkB, d.kkC])] },
      select: { id: true },
    }),
    tx.pengajuan.findMany({
      where: { AND: [scopeWhere(user, "pengajuan"), batas(Object.values(d.pengajuan))] },
      select: { id: true },
    }),
  ]);
  return {
    warga: warga.map((x) => x.id).sort(),
    kk: kk.map((x) => x.id).sort(),
    pengajuan: pengajuan.map((x) => x.id).sort(),
  };
}

const urut = (...ids: string[]) => ids.sort();

describe("scopeWhere (SEC-04, AC-04)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Super Admin melihat semua data", async () => {
    await dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      const hasil = await lihat(tx, d, { role: "SUPER_ADMIN", wilayah_id: null, rw: null, warga_id: null });
      expect(hasil.warga).toEqual(urut(d.wargaA, d.wargaB, d.wargaC));
      expect(hasil.kk).toEqual(urut(d.kkA, d.kkB, d.kkC));
      expect(hasil.pengajuan).toEqual(urut(...Object.values(d.pengajuan)));
    });
  });

  it("Admin RW melihat semua RT di RW-nya, tidak RW lain", async () => {
    await dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      const rw3 = await lihat(tx, d, { role: "ADMIN_RW", wilayah_id: null, rw: "003", warga_id: null });
      expect(rw3.kk).toEqual(urut(d.kkA, d.kkB, d.kkC));
      const rw4 = await lihat(tx, d, { role: "ADMIN_RW", wilayah_id: null, rw: "004", warga_id: null });
      expect(rw4).toEqual({ warga: [], kk: [], pengajuan: [] });
    });
  });

  it("Ketua RT A tidak mendapat data RT B", async () => {
    await dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      const ketuaRt1 = await lihat(tx, d, { role: "KETUA_RT", wilayah_id: d.rt1, rw: "003", warga_id: null });
      expect(ketuaRt1.warga).toEqual(urut(d.wargaA, d.wargaB));
      expect(ketuaRt1.kk).toEqual(urut(d.kkA, d.kkB));
      expect(ketuaRt1.pengajuan).toEqual(urut(d.pengajuan.A, d.pengajuan.B));
      expect(ketuaRt1.warga).not.toContain(d.wargaC);
      expect(ketuaRt1.kk).not.toContain(d.kkC);
      expect(ketuaRt1.pengajuan).not.toContain(d.pengajuan.C);

      const ketuaRt2 = await lihat(tx, d, { role: "KETUA_RT", wilayah_id: d.rt2, rw: "003", warga_id: null });
      expect(ketuaRt2.warga).toEqual([d.wargaC]);
      expect(ketuaRt2.kk).toEqual([d.kkC]);
      expect(ketuaRt2.pengajuan).toEqual([d.pengajuan.C]);
    });
  });

  it("Warga hanya mendapat KK-nya sendiri, bukan KK lain di RT yang sama", async () => {
    await dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      const hasil = await lihat(tx, d, { role: "WARGA", wilayah_id: null, rw: null, warga_id: d.wargaA });
      expect(hasil.kk).toEqual([d.kkA]);
      expect(hasil.warga).toEqual([d.wargaA]);
      expect(hasil.pengajuan).toEqual([d.pengajuan.A]);
      expect(hasil.kk).not.toContain(d.kkB);
      expect(hasil.kk).not.toContain(d.kkC);
    });
  });

  it("Warga yang sudah dihapus (soft delete) tidak mendapat apa pun", async () => {
    await dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await tx.warga.update({ where: { id: d.wargaA }, data: { deleted_at: new Date() } });
      const hasil = await lihat(tx, d, { role: "WARGA", wilayah_id: null, rw: null, warga_id: d.wargaA });
      expect(hasil).toEqual({ warga: [], kk: [], pengajuan: [] });
    });
  });

  it("data pengguna tidak lengkap tidak mendapat apa pun (bukan semuanya)", async () => {
    await dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      const kosong = { warga: [], kk: [], pengajuan: [] };
      expect(await lihat(tx, d, { role: "KETUA_RT", wilayah_id: null, rw: "003", warga_id: null })).toEqual(kosong);
      expect(await lihat(tx, d, { role: "ADMIN_RW", wilayah_id: null, rw: null, warga_id: null })).toEqual(kosong);
      expect(await lihat(tx, d, { role: "WARGA", wilayah_id: null, rw: null, warga_id: null })).toEqual(kosong);
    });
  });
});
