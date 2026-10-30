import { describe, expect, it } from "vitest";
import type { Pengguna } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { simpanKk } from "@/lib/data/kk";
import {
  GalatPengaturan,
  daftarKategoriUsia,
  daftarPekerjaan,
  daftarPendidikan,
  daftarWilayah,
  hapusPendidikan,
  hapusWilayah,
  simpanKategoriUsia,
  simpanPendidikan,
  simpanWilayah,
} from "@/lib/data/pengaturan";
import { kkSchema, type KkInput } from "@/lib/validators/kk";
import { kategoriUsiaSchema, pendidikanSchema, wilayahSchema } from "@/lib/validators/pengaturan";
import { dalamRollback, type Tx } from "./helpers";

// NIK/No KK berawalan 999 dan email @contoh.test: bukan data nyata.
async function pengguna(tx: Tx, email: string, role: Pengguna["role"], rw?: string): Promise<Pengguna> {
  const u = await tx.user.create({ data: { nama: "Penguji", email, role, status: "AKTIF", rw: rw ?? null } });
  return { id: u.id, nama: u.nama, email, role, wilayah_id: null, rw: u.rw, warga_id: null };
}

async function buatKkDiRt(tx: Tx, admin: Pengguna, noKk: string, nik: string, pendidikanId: string) {
  const pekerjaan = await tx.refPekerjaan.findFirstOrThrow();
  const input = {
    no_kk: noKk, alamat: "Jl. Uji", rt: "001", rw: "003", kode_pos: "", desa_kelurahan: "Duren Tiga", kecamatan: "Pancoran",
    kabupaten_kota: "Jakarta Selatan", provinsi: "",
    anggota: [{
      hubungan_keluarga: "KEPALA_KELUARGA", nik, nama_lengkap: "Kepala Uji", jenis_kelamin: "L", tempat_lahir: "Jakarta",
      tanggal_lahir: "1980-01-01", agama: "ISLAM", pendidikan_id: pendidikanId, pekerjaan_id: pekerjaan.id,
      golongan_darah: "", status_perkawinan: "",
    }],
  } as KkInput;
  return simpanKk(admin, kkSchema.parse(input), undefined, tx);
}

const kategori = (nama: string, min: number, maks: number | null, jk: "" | "L" | "P" = "", id?: string) => ({
  id, nama, usia_min: min, usia_maks: maks, jenis_kelamin: jk,
});

describe("Pengaturan (integrasi)", () => {
  it("menyimpan pendidikan dengan urutan dan alias, lalu membacanya urut (FR-MST-01)", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-set-1@contoh.test", "ADMIN_RW", "003");
      await simpanPendidikan(admin, pendidikanSchema.parse({ nama: "Pendidikan Uji", urutan: 999, alias: ["Uji A", "uji a", "Uji B"] }), undefined, tx);
      const baris = (await daftarPendidikan(tx)).find((b) => b.nama === "Pendidikan Uji");
      expect(baris).toMatchObject({ urutan: 999, alias: ["Uji A", "Uji B"], dipakai: 0 });
      const urutan = (await daftarPendidikan(tx)).map((b) => b.urutan);
      expect(urutan).toEqual([...urutan].sort((a, b) => (a ?? 0) - (b ?? 0)));
    }));

  it("menolak menghapus pendidikan yang masih dipakai warga dan mencatat log saat berhasil", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-set-2@contoh.test", "SUPER_ADMIN");
      // Master milik tes sendiri: master seed bisa sudah dipakai ribuan warga (db:seed:uji).
      const dipakai = await tx.refPendidikan.create({ data: { nama: "Pendidikan Dipakai Uji", urutan: 997 } });
      await buatKkDiRt(tx, admin, "9990000000970010", "9990000000970011", dipakai.id);
      await expect(hapusPendidikan(admin, dipakai.id, tx)).rejects.toThrow(new GalatPengaturan("Pendidikan masih dipakai 1 warga"));

      const baru = await simpanPendidikan(admin, pendidikanSchema.parse({ nama: "Sementara Uji", urutan: 998, alias: [] }), undefined, tx);
      await hapusPendidikan(admin, baru, tx);
      const log = await tx.activityLog.findFirstOrThrow({ where: { entitas_id: baru, aksi: "PENDIDIKAN_DIHAPUS" } });
      expect(log.perubahan).toEqual({ nama: "Sementara Uji" });
    }));

  it("menolak nama pendidikan ganda", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-set-3@contoh.test", "SUPER_ADMIN");
      const ada = await tx.refPendidikan.findFirstOrThrow();
      await expect(
        simpanPendidikan(admin, pendidikanSchema.parse({ nama: ada.nama, urutan: 50, alias: [] }), undefined, tx),
      ).rejects.toThrow(new GalatPengaturan("Nama pendidikan sudah ada"));
    }));

  it("membaca pekerjaan dari tabel dengan jumlah pemakaian (FR-MST-01)", async () => {
    const daftar = await daftarPekerjaan();
    expect(daftar.length).toBeGreaterThan(0);
    expect(daftar[0]).toMatchObject({ urutan: null });
  });

  it("kategori usia dibaca dari tabel: daftar baru menggantikan seluruhnya, urutan mengikuti posisi (FR-MST-02)", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-set-4@contoh.test", "ADMIN_RW", "003");
      await simpanKategoriUsia(
        admin,
        kategoriUsiaSchema.parse([kategori("Kategori Uji B", 20, 30), kategori("Kategori Uji A", 25, null, "P")]),
        tx,
      );
      const hasil = await daftarKategoriUsia(tx);
      expect(hasil.map((k) => k.nama)).toEqual(["Kategori Uji B", "Kategori Uji A"]);
      expect(hasil[1]).toMatchObject({ usia_min: 25, usia_maks: null, jenis_kelamin: "P" });
      const urutan = await tx.kategoriUsia.findMany({ orderBy: { urutan: "asc" }, select: { urutan: true } });
      expect(urutan.map((u) => u.urutan)).toEqual([1, 2]);
    }));

  it("mengubah kategori yang ada tanpa mengganti id dan menghapus yang hilang dari daftar", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-set-5@contoh.test", "SUPER_ADMIN");
      const awal = await daftarKategoriUsia(tx);
      const [pertama] = awal;
      await simpanKategoriUsia(admin, kategoriUsiaSchema.parse([kategori("Nama Baru", 1, 2, "", pertama.id)]), tx);
      const hasil = await daftarKategoriUsia(tx);
      expect(hasil).toHaveLength(1);
      expect(hasil[0]).toMatchObject({ id: pertama.id, nama: "Nama Baru", usia_min: 1, usia_maks: 2 });
    }));

  it("simpan kategori usia atomik: satu baris gagal, tidak ada perubahan tersimpan", async () => {
    const sebelum = await daftarKategoriUsia();
    const [pertama] = sebelum;
    const idTakAda = "00000000-0000-4000-8000-000000000999";
    await expect(
      simpanKategoriUsia(
        { id: "00000000-0000-4000-8000-000000000001" } as Pengguna,
        kategoriUsiaSchema.parse([kategori("Diubah", 1, 2, "", pertama.id), kategori("Hantu", 3, 4, "", idTakAda)]),
      ),
    ).rejects.toBeInstanceOf(GalatPengaturan);
    expect(await daftarKategoriUsia()).toEqual(sebelum);
  });

  it("Admin RW hanya melihat dan mengelola RW-nya sendiri; Super Admin semua RW", () =>
    dalamRollback(async (tx) => {
      const adminRw = await pengguna(tx, "penguji-set-6@contoh.test", "ADMIN_RW", "003");
      const superAdmin = await pengguna(tx, "penguji-set-7@contoh.test", "SUPER_ADMIN");
      await simpanWilayah(superAdmin, wilayahSchema.parse({ rw: "998", rt: "001", keterangan: "" }), undefined, tx);

      expect((await daftarWilayah(adminRw, tx)).every((w) => w.rw === "003")).toBe(true);
      expect((await daftarWilayah(superAdmin, tx)).some((w) => w.rw === "998")).toBe(true);
      await expect(
        simpanWilayah(adminRw, wilayahSchema.parse({ rw: "998", rt: "002", keterangan: "" }), undefined, tx),
      ).rejects.toThrow(new GalatPengaturan("Anda hanya boleh mengelola RW Anda sendiri"));
    }));

  it("menambah RT baru dan menolak RT/RW ganda", () =>
    dalamRollback(async (tx) => {
      const adminRw = await pengguna(tx, "penguji-set-8@contoh.test", "ADMIN_RW", "003");
      const id = await simpanWilayah(adminRw, wilayahSchema.parse({ rw: "003", rt: "090", keterangan: "RT uji" }), undefined, tx);
      expect((await daftarWilayah(adminRw, tx)).find((w) => w.id === id)).toMatchObject({ rt: "090", keterangan: "RT uji", jumlahKk: 0 });
      await expect(
        simpanWilayah(adminRw, wilayahSchema.parse({ rw: "003", rt: "090", keterangan: "" }), undefined, tx),
      ).rejects.toThrow(new GalatPengaturan("RT/RW tersebut sudah ada"));
    }));

  it("menolak menghapus RT yang sudah dipakai KK", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-set-9@contoh.test", "SUPER_ADMIN");
      const pendidikan = await tx.refPendidikan.findFirstOrThrow();
      await buatKkDiRt(tx, admin, "9990000000980010", "9990000000980011", pendidikan.id);
      const rt001 = await tx.wilayah.findUniqueOrThrow({ where: { rw_rt: { rw: "003", rt: "001" } } });
      await expect(hapusWilayah(admin, rt001.id, tx)).rejects.toBeInstanceOf(GalatPengaturan);
      expect(await prisma.wilayah.count({ where: { id: rt001.id } })).toBe(1);
    }));
});
