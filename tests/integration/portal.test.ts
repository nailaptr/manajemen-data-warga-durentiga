import { describe, expect, it } from "vitest";
import type { Pengguna } from "@/lib/auth";
import { keluargaSaya, pengajuanSaya } from "@/lib/data/portal";
import { dalamRollback, type Tx } from "./helpers";

// Data di RW 089, dibatalkan. NIK 99915..., No KK 99916....
const nik = (n: number) => `99915${String(n).padStart(11, "0")}`;
const noKk = (n: number) => `99916${String(n).padStart(11, "0")}`;

async function siapkan(tx: Tx) {
  const rt = await tx.wilayah.create({ data: { rw: "089", rt: "001" } });
  const admin = await tx.user.create({
    data: { nama: "Admin Uji", email: "uji-portal-admin@contoh.test", role: "SUPER_ADMIN", status: "AKTIF", email_verified: true },
  });
  const kkBaru = async (n: number) =>
    tx.kartuKeluarga.create({ data: { no_kk: noKk(n), alamat: `Jl. Uji ${n}`, wilayah_id: rt.id, created_by: admin.id } });
  const wargaBaru = (kkId: string, n: number, hubungan: "KEPALA_KELUARGA" | "ANAK", lahir: string, o: { status?: "AKTIF" | "PINDAH"; hapus?: boolean } = {}) =>
    tx.warga.create({
      data: {
        kartu_keluarga_id: kkId, nik: nik(n), nama_lengkap: `Warga Portal ${n}`, jenis_kelamin: "L",
        tanggal_lahir: new Date(lahir), hubungan_keluarga: hubungan, status_kependudukan: o.status ?? "AKTIF",
        deleted_at: o.hapus ? new Date() : null,
      },
    });

  const kkA = await kkBaru(1);
  const kepala = await wargaBaru(kkA.id, 1, "KEPALA_KELUARGA", "1980-01-01");
  const anak = await wargaBaru(kkA.id, 2, "ANAK", "2008-06-01");
  const pindah = await wargaBaru(kkA.id, 3, "ANAK", "2000-01-01", { status: "PINDAH" });
  const dihapus = await wargaBaru(kkA.id, 4, "ANAK", "2001-01-01", { hapus: true });

  const kkB = await kkBaru(2);
  const orangLain = await wargaBaru(kkB.id, 5, "KEPALA_KELUARGA", "1975-01-01");

  const akunWarga = await tx.user.create({
    data: { nama: "Warga Portal 2", email: "uji-portal-warga@contoh.test", role: "WARGA", status: "AKTIF", email_verified: true, warga_id: anak.id },
  });
  const sebagai = (u: { id: string; nama: string; email: string; role: Pengguna["role"]; warga_id: string | null }): Pengguna => ({
    id: u.id, nama: u.nama, email: u.email, role: u.role, wilayah_id: null, rw: null, warga_id: u.warga_id,
  });
  const pengajuan = (kkId: string, wargaId: string, status: "MENUNGGU" | "DISETUJUI") =>
    tx.pengajuan.create({ data: { kartu_keluarga_id: kkId, diajukan_oleh: akunWarga.id, jenis: "UBAH_WARGA", warga_id: wargaId, status } });

  return { admin, kkA, kkB, kepala, anak, pindah, dihapus, orangLain, warga: sebagai(akunWarga), sebagai, pengajuan };
}

describe("Portal warga: cakupan KK sendiri (AC-05)", () => {
  it("warga melihat KK dari warga_id-nya dengan semua anggota aktif, kepala keluarga paling atas", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const hasil = await keluargaSaya(s.warga, tx);
      expect(hasil?.kk.id).toBe(s.kkA.id);
      expect(hasil?.kk.no_kk).toBe(s.kkA.no_kk);
      expect(hasil?.anggota.map((a) => a.id)).toEqual([s.kepala.id, s.anak.id]);
    }));

  it("anggota yang pindah atau dihapus dan KK lain tidak ikut tampil", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const hasil = await keluargaSaya(s.warga, tx);
      const id = hasil?.anggota.map((a) => a.id) ?? [];
      expect(id).not.toContain(s.pindah.id);
      expect(id).not.toContain(s.dihapus.id);
      expect(id).not.toContain(s.orangLain.id);
    }));

  it("warga yang dihapus (soft delete) atau tanpa warga_id tidak mendapat apa pun", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      expect(await keluargaSaya({ ...s.warga, warga_id: null }, tx)).toBeNull();
      await tx.warga.update({ where: { id: s.anak.id }, data: { deleted_at: new Date() } });
      expect(await keluargaSaya(s.warga, tx)).toBeNull();
      expect(await pengajuanSaya(s.warga, undefined, tx)).toEqual([]);
    }));

  it("peran selain WARGA ditolak walau warga_id terisi", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const pengurus: Pengguna = { ...s.warga, role: "SUPER_ADMIN" };
      expect(await keluargaSaya(pengurus, tx)).toBeNull();
      expect(await pengajuanSaya(pengurus, undefined, tx)).toEqual([]);
    }));
});

describe("Portal warga: pengajuan", () => {
  it("hanya pengajuan KK sendiri, terbaru dulu, dan batas jumlah dipakai", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const lama = await s.pengajuan(s.kkA.id, s.anak.id, "DISETUJUI");
      await tx.pengajuan.update({ where: { id: lama.id }, data: { created_at: new Date("2026-01-01") } });
      const baru = await s.pengajuan(s.kkA.id, s.kepala.id, "MENUNGGU");
      await s.pengajuan(s.kkB.id, s.orangLain.id, "MENUNGGU");

      const semua = await pengajuanSaya(s.warga, undefined, tx);
      expect(semua.map((p) => p.id)).toEqual([baru.id, lama.id]);
      expect(await pengajuanSaya(s.warga, 1, tx)).toHaveLength(1);
    }));

  it("anggota bertanda 'pengajuan menunggu' hanya untuk status MENUNGGU", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      await s.pengajuan(s.kkA.id, s.anak.id, "MENUNGGU");
      await s.pengajuan(s.kkA.id, s.kepala.id, "DISETUJUI");
      const hasil = await keluargaSaya(s.warga, tx);
      expect(hasil?.anggota.map((a) => [a.id, a.pengajuanMenunggu])).toEqual([
        [s.kepala.id, false],
        [s.anak.id, true],
      ]);
    }));
});
