import { describe, expect, it } from "vitest";
import type { Pengguna } from "@/lib/auth";
import { GalatKk, simpanKk } from "@/lib/data/kk";
import { daftarWarga, simpanWarga } from "@/lib/data/warga";
import { kkSchema, type KkInput } from "@/lib/validators/kk";
import { wargaSchema, type WargaInput } from "@/lib/validators/warga";
import { dalamRollback, type Tx } from "./helpers";

// NIK/No KK berawalan 999 dan email @contoh.test: bukan data nyata.
async function pengguna(tx: Tx, email: string, role: Pengguna["role"], rt?: string): Promise<Pengguna> {
  const w = rt ? await tx.wilayah.findUniqueOrThrow({ where: { rw_rt: { rw: "003", rt } } }) : null;
  const u = await tx.user.create({
    data: { nama: "Penguji", email, role, status: "AKTIF", wilayah_id: w?.id, rw: role === "ADMIN_RW" ? "003" : null },
  });
  return { id: u.id, nama: u.nama, email, role, wilayah_id: u.wilayah_id, rw: u.rw, warga_id: null };
}

async function master(tx: Tx) {
  return {
    pendidikan_id: (await tx.refPendidikan.findFirstOrThrow()).id,
    pekerjaan_id: (await tx.refPekerjaan.findFirstOrThrow()).id,
  };
}

async function buatKk(tx: Tx, admin: Pengguna, noKk: string, rt: string, nikKepala: string) {
  const m = await master(tx);
  const input = {
    no_kk: noKk, alamat: "Jl. Uji", rt, rw: "003", kode_pos: "", desa_kelurahan: "Duren Tiga", kecamatan: "Pancoran",
    kabupaten_kota: "Jakarta Selatan", provinsi: "",
    anggota: [{
      hubungan_keluarga: "KEPALA_KELUARGA", nik: nikKepala, nama_lengkap: "Kepala Uji", jenis_kelamin: "L",
      tempat_lahir: "Jakarta", tanggal_lahir: "1980-01-01", agama: "ISLAM", ...m, golongan_darah: "", status_perkawinan: "",
    }],
  } as KkInput;
  return simpanKk(admin, kkSchema.parse(input), undefined, tx);
}

function warga(kkId: string, m: { pendidikan_id: string; pekerjaan_id: string }, ubah: Partial<Record<keyof WargaInput, string>> = {}) {
  return wargaSchema.parse({
    kartu_keluarga_id: kkId, hubungan_keluarga: "ANAK", nik: "9990000000910011", nama_lengkap: "Anak Uji",
    jenis_kelamin: "P", tempat_lahir: "Jakarta", tanggal_lahir: "2010-05-05", agama: "ISLAM", ...m,
    golongan_darah: "", status_perkawinan: "", status_kependudukan: "AKTIF", tanggal_status: "", ...ubah,
  });
}

describe("Data Warga (integrasi)", () => {
  it("menyimpan warga ke KK dan bisa dicari lewat nama, NIK, dan No KK (FR-WRG-01)", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-warga-1@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const kk = await buatKk(tx, admin, "9990000000910010", "001", "9990000000910012");
      await simpanWarga(admin, warga(kk, m), undefined, tx);

      for (const q of ["Anak Uji", "9990000000910011", "9990000000910010"]) {
        const { baris } = await daftarWarga(admin, { q, halaman: 1, ukuran: 50 }, tx);
        expect(baris.some((b) => b.nik === "9990000000910011"), `pencarian ${q}`).toBe(true);
      }
      const { baris } = await daftarWarga(admin, { q: "9990000000910011", halaman: 1, ukuran: 10 }, tx);
      expect(baris[0]).toMatchObject({ nama_lengkap: "Anak Uji", no_kk: "9990000000910010", status: "AKTIF", rt: "001" });
    }));

  it("memakai pagination di server", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-warga-2@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const kk = await buatKk(tx, admin, "9990000000920010", "001", "9990000000920011");
      await simpanWarga(admin, warga(kk, m, { nik: "9990000000920012", nama_lengkap: "Anak B" }), undefined, tx);
      await simpanWarga(admin, warga(kk, m, { nik: "9990000000920013", nama_lengkap: "Anak C" }), undefined, tx);
      const hal1 = await daftarWarga(admin, { q: "9990000000920010", halaman: 1, ukuran: 2 }, tx);
      const hal2 = await daftarWarga(admin, { q: "9990000000920010", halaman: 2, ukuran: 2 }, tx);
      expect(hal1.total).toBe(3);
      expect(hal1.baris).toHaveLength(2);
      expect(hal2.baris).toHaveLength(1);
    }));

  it("menolak NIK yang sudah terdaftar (BR-03)", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-warga-3@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const kk = await buatKk(tx, admin, "9990000000930010", "001", "9990000000930011");
      await expect(simpanWarga(admin, warga(kk, m, { nik: "9990000000930011" }), undefined, tx)).rejects.toThrow(
        new GalatKk("NIK sudah terdaftar"),
      );
    }));

  it("menolak Kepala Keluarga kedua dalam satu KK (BR-02)", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-warga-4@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const kk = await buatKk(tx, admin, "9990000000940010", "001", "9990000000940011");
      await expect(
        simpanWarga(admin, warga(kk, m, { nik: "9990000000940012", hubungan_keluarga: "KEPALA_KELUARGA" }), undefined, tx),
      ).rejects.toBeInstanceOf(GalatKk);
    }));

  it("mengubah status kependudukan beserta tanggal_status dan mencatat log tanpa data pribadi (FR-WRG-04)", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-warga-5@contoh.test", "SUPER_ADMIN");
      const m = await master(tx);
      const kk = await buatKk(tx, admin, "9990000000950010", "001", "9990000000950011");
      const id = await simpanWarga(admin, warga(kk, m, { nik: "9990000000950012" }), undefined, tx);

      await simpanWarga(
        admin,
        warga(kk, m, { nik: "9990000000950012", status_kependudukan: "PINDAH", tanggal_status: "2026-03-01" }),
        id,
        tx,
      );
      const w = await tx.warga.findUniqueOrThrow({ where: { id } });
      expect(w.status_kependudukan).toBe("PINDAH");
      expect(w.tanggal_status?.toISOString().slice(0, 10)).toBe("2026-03-01");

      const log = await tx.activityLog.findFirstOrThrow({ where: { entitas_id: id, aksi: "WARGA_STATUS_DIUBAH" } });
      expect(log.perubahan).toEqual({ dari: "AKTIF", ke: "PINDAH" });
      expect(JSON.stringify(log)).not.toContain("9990000000950012");

      const { baris } = await daftarWarga(admin, { q: "9990000000950012", status: "AKTIF", halaman: 1, ukuran: 10 }, tx);
      expect(baris).toHaveLength(0);
    }));

  it("Ketua RT tidak melihat atau menambah warga di RT lain", () =>
    dalamRollback(async (tx) => {
      const admin = await pengguna(tx, "penguji-warga-6@contoh.test", "SUPER_ADMIN");
      const ketua1 = await pengguna(tx, "penguji-warga-7@contoh.test", "KETUA_RT", "001");
      const m = await master(tx);
      const kkRt2 = await buatKk(tx, admin, "9990000000960010", "002", "9990000000960011");

      const { baris } = await daftarWarga(ketua1, { q: "9990000000960011", halaman: 1, ukuran: 10 }, tx);
      expect(baris).toHaveLength(0);
      await expect(simpanWarga(ketua1, warga(kkRt2, m, { nik: "9990000000960012" }), undefined, tx)).rejects.toBeInstanceOf(GalatKk);
    }));
});
