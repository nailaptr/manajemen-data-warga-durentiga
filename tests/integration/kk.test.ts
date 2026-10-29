import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pengguna } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GalatKk, ambilKk, daftarKk, hapusKk, simpanKk } from "@/lib/data/kk";
import { kkSchema, type KkData, type KkInput } from "@/lib/validators/kk";
import { dalamRollback, type Tx } from "./helpers";

// NIK/No KK berawalan 999 dan email @contoh.test: bukan data nyata.
const EMAIL_ATOMIK = "penguji-kk-atomik@contoh.test";

async function master(tx: Tx | typeof prisma) {
  const pendidikan = await tx.refPendidikan.findFirstOrThrow();
  const pekerjaan = await tx.refPekerjaan.findFirstOrThrow();
  return { pendidikan_id: pendidikan.id, pekerjaan_id: pekerjaan.id };
}

function anggota(m: { pendidikan_id: string; pekerjaan_id: string }, nik: string, hubungan: string): KkInput["anggota"][number] {
  return {
    hubungan_keluarga: hubungan, nik, nama_lengkap: "Warga Uji", jenis_kelamin: "P",
    tempat_lahir: "Jakarta", tanggal_lahir: "1990-01-01", agama: "ISLAM", ...m,
    golongan_darah: "", status_perkawinan: "",
  } as KkInput["anggota"][number];
}

function data(noKk: string, rt: string, list: KkInput["anggota"]): KkData {
  return kkSchema.parse({
    no_kk: noKk, alamat: "Jl. Uji", rt, rw: "003", kode_pos: "", desa_kelurahan: "Duren Tiga",
    kecamatan: "Pancoran", kabupaten_kota: "Jakarta Selatan", provinsi: "", anggota: list,
  });
}

async function buatPengguna(tx: Tx | typeof prisma, email: string, role: Pengguna["role"], rt?: string) {
  const w = rt ? await tx.wilayah.findUniqueOrThrow({ where: { rw_rt: { rw: "003", rt } } }) : null;
  const u = await tx.user.create({
    data: { nama: "Penguji", email, role, status: "AKTIF", wilayah_id: w?.id, rw: role === "ADMIN_RW" ? "003" : null },
  });
  return { id: u.id, nama: u.nama, email: u.email, role, wilayah_id: u.wilayah_id, rw: u.rw, warga_id: null } satisfies Pengguna;
}

describe("simpan KK (integrasi)", () => {
  it("menyimpan KK beserta semua anggota dan ringkasannya muncul di view (BR-01, BR-02)", () =>
    dalamRollback(async (tx) => {
      const admin = await buatPengguna(tx, "penguji-kk-1@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const id = await simpanKk(
        admin,
        data("9990000000010010", "001", [anggota(m, "9990000000010011", "KEPALA_KELUARGA"), anggota(m, "9990000000010012", "ANAK")]),
        undefined,
        tx,
      );
      const { baris } = await daftarKk(admin, { q: "9990000000010010", halaman: 1, ukuran: 10 }, tx);
      expect(baris).toHaveLength(1);
      expect(baris[0]).toMatchObject({ id, kepala_keluarga: "Warga Uji", jumlah_anggota: 2, rt: "001" });
    }));

  it("menolak Kepala Keluarga kedua lewat partial unique index (BR-02)", () =>
    dalamRollback(async (tx) => {
      const admin = await buatPengguna(tx, "penguji-kk-2@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const kk = await tx.kartuKeluarga.create({
        data: { no_kk: "9990000000020010", alamat: "Jl. Uji", wilayah_id: (await tx.wilayah.findFirstOrThrow()).id, created_by: admin.id },
      });
      const baru = (nik: string) => ({
        kartu_keluarga_id: kk.id, nik, nama_lengkap: "X", jenis_kelamin: "L" as const,
        tanggal_lahir: new Date("1990-01-01"), hubungan_keluarga: "KEPALA_KELUARGA" as const, ...m,
      });
      await tx.warga.create({ data: baru("9990000000020011") });
      await expect(tx.warga.create({ data: baru("9990000000020012") })).rejects.toThrow();
    }));

  it("menolak NIK yang sudah terdaftar dengan pesan generik (BR-03)", () =>
    dalamRollback(async (tx) => {
      const admin = await buatPengguna(tx, "penguji-kk-3@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      await simpanKk(admin, data("9990000000030010", "001", [anggota(m, "9990000000030011", "KEPALA_KELUARGA")]), undefined, tx);
      await expect(
        simpanKk(admin, data("9990000000030020", "001", [anggota(m, "9990000000030011", "KEPALA_KELUARGA")]), undefined, tx),
      ).rejects.toThrow(new GalatKk("No KK atau NIK sudah terdaftar"));
    }));

  it("mengganti kepala keluarga saat ubah tanpa bentrok one_head_per_kk", () =>
    dalamRollback(async (tx) => {
      const admin = await buatPengguna(tx, "penguji-kk-4@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const id = await simpanKk(
        admin,
        data("9990000000040010", "001", [anggota(m, "9990000000040011", "KEPALA_KELUARGA"), anggota(m, "9990000000040012", "ISTRI")]),
        undefined,
        tx,
      );
      const kk = await ambilKk(admin, id, tx);
      const [kepala, istri] = [kk!.warga.find((w) => w.nik.endsWith("11"))!, kk!.warga.find((w) => w.nik.endsWith("12"))!];
      // Istri naik menjadi kepala (urutan pertama), kepala lama turun jadi Suami.
      const ubah = data("9990000000040010", "001", [
        { ...anggota(m, istri.nik, "KEPALA_KELUARGA"), id: istri.id },
        { ...anggota(m, kepala.nik, "SUAMI"), id: kepala.id },
      ]);
      await simpanKk(admin, ubah, id, tx);
      const sesudah = await ambilKk(admin, id, tx);
      expect(sesudah!.warga.filter((w) => w.hubungan_keluarga === "KEPALA_KELUARGA").map((w) => w.id)).toEqual([istri.id]);
    }));
});

describe("atomisitas simpan KK", () => {
  let admin: Pengguna;
  const NIK_ADA = "9990000000050011";
  const NO_KK_ADA = "9990000000050010";

  async function bersihkan() {
    const u = await prisma.user.findUnique({ where: { email: EMAIL_ATOMIK } });
    if (!u) return;
    const kk = await prisma.kartuKeluarga.findMany({ where: { created_by: u.id }, select: { id: true } });
    const ids = kk.map((k) => k.id);
    await prisma.warga.deleteMany({ where: { kartu_keluarga_id: { in: ids } } });
    await prisma.kartuKeluarga.deleteMany({ where: { id: { in: ids } } });
    await prisma.activityLog.deleteMany({ where: { user_id: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }

  beforeAll(async () => {
    await bersihkan();
    admin = await buatPengguna(prisma, EMAIL_ATOMIK, "SUPER_ADMIN");
    const m = await master(prisma);
    await simpanKk(admin, data(NO_KK_ADA, "001", [anggota(m, NIK_ADA, "KEPALA_KELUARGA")]));
  });
  afterAll(bersihkan);

  it("tidak menyimpan KK maupun anggota mana pun bila satu anggota gagal di tengah transaksi", async () => {
    const m = await master(prisma);
    const gagal = data("9990000000050020", "001", [
      anggota(m, "9990000000050021", "KEPALA_KELUARGA"),
      anggota(m, "9990000000050022", "ANAK"),
      anggota(m, NIK_ADA, "ANAK"), // NIK sudah dipakai KK lain: DB menolak setelah dua anggota pertama masuk
    ]);
    await expect(simpanKk(admin, gagal)).rejects.toBeInstanceOf(GalatKk);
    expect(await prisma.kartuKeluarga.count({ where: { no_kk: "9990000000050020" } })).toBe(0);
    expect(await prisma.warga.count({ where: { nik: { in: ["9990000000050021", "9990000000050022"] } } })).toBe(0);
  });

  it("tidak mengubah KK lama bila ubah gagal di tengah transaksi", async () => {
    const m = await master(prisma);
    const kk = await prisma.kartuKeluarga.findUniqueOrThrow({ where: { no_kk: NO_KK_ADA } });
    const kepala = await prisma.warga.findUniqueOrThrow({ where: { nik: NIK_ADA } });
    const kk2 = await simpanKk(admin, data("9990000000050030", "001", [anggota(m, "9990000000050031", "KEPALA_KELUARGA")]));
    const gagal = data("9990000000050030", "001", [
      { ...anggota(m, "9990000000050031", "KEPALA_KELUARGA"), id: (await prisma.warga.findUniqueOrThrow({ where: { nik: "9990000000050031" } })).id },
      anggota(m, "9990000000050032", "ANAK"),
      anggota(m, NIK_ADA, "ANAK"),
    ]);
    gagal.alamat = "Alamat yang tidak boleh tersimpan";
    await expect(simpanKk(admin, gagal, kk2)).rejects.toBeInstanceOf(GalatKk);
    expect((await prisma.kartuKeluarga.findUniqueOrThrow({ where: { id: kk2 } })).alamat).toBe("Jl. Uji");
    expect(await prisma.warga.count({ where: { nik: "9990000000050032" } })).toBe(0);
    expect(kk.id).toBeTruthy();
    expect(kepala.kartu_keluarga_id).toBe(kk.id);
  });
});

describe("cakupan dan hapus KK (integrasi)", () => {
  it("Ketua RT tidak bisa melihat, mengubah, menghapus, atau membuat KK di RT lain", () =>
    dalamRollback(async (tx) => {
      const admin = await buatPengguna(tx, "penguji-kk-5@contoh.test", "SUPER_ADMIN");
      const ketua1 = await buatPengguna(tx, "penguji-kk-6@contoh.test", "KETUA_RT", "001");
      const m = await master(tx);
      const idRt2 = await simpanKk(admin, data("9990000000060010", "002", [anggota(m, "9990000000060011", "KEPALA_KELUARGA")]), undefined, tx);

      expect(await ambilKk(ketua1, idRt2, tx)).toBeNull();
      const { baris } = await daftarKk(ketua1, { q: "9990000000060010", halaman: 1, ukuran: 10 }, tx);
      expect(baris).toHaveLength(0);
      await expect(hapusKk(ketua1, idRt2, tx)).rejects.toBeInstanceOf(GalatKk);
      await expect(
        simpanKk(ketua1, data("9990000000060020", "002", [anggota(m, "9990000000060021", "KEPALA_KELUARGA")]), undefined, tx),
      ).rejects.toBeInstanceOf(GalatKk);
    }));

  it("menolak hapus KK yang masih punya anggota aktif, lalu soft delete setelah kosong (BR-09)", () =>
    dalamRollback(async (tx) => {
      const admin = await buatPengguna(tx, "penguji-kk-7@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const id = await simpanKk(admin, data("9990000000070010", "001", [anggota(m, "9990000000070011", "KEPALA_KELUARGA")]), undefined, tx);

      await expect(hapusKk(admin, id, tx)).rejects.toBeInstanceOf(GalatKk);
      expect((await tx.kartuKeluarga.findUniqueOrThrow({ where: { id } })).deleted_at).toBeNull();

      await tx.warga.updateMany({ where: { kartu_keluarga_id: id }, data: { deleted_at: new Date() } });
      await hapusKk(admin, id, tx);
      const baris = await tx.kartuKeluarga.findUniqueOrThrow({ where: { id } });
      expect(baris.deleted_at).not.toBeNull();
      expect(await ambilKk(admin, id, tx)).toBeNull();
    }));
});
