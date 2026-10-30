import { describe, expect, it } from "vitest";
import type { Pengguna } from "@/lib/auth";
import {
  daftarKlaim,
  daftarPengurus,
  GalatPengguna,
  setujuiKlaim,
  statistikPengguna,
  tambahPengurus,
  tolakKlaim,
  ubahPengurus,
  ubahStatusPengurus,
} from "@/lib/data/pengguna";
import { dalamRollback, type Tx } from "./helpers";

// Data di RW 092 dan 091, dibatalkan. NIK 99913..., No KK 99914..., email uji-pengguna-*@contoh.test.
const nik = (n: number) => `99913${String(n).padStart(11, "0")}`;
const noKk = (n: number) => `99914${String(n).padStart(11, "0")}`;

async function siapkan(tx: Tx) {
  const rt1 = await tx.wilayah.create({ data: { rw: "092", rt: "001" } });
  const rt2 = await tx.wilayah.create({ data: { rw: "092", rt: "002" } });
  const rwLain = await tx.wilayah.create({ data: { rw: "091", rt: "001" } });
  const akun = (nama: string, role: "SUPER_ADMIN" | "ADMIN_RW" | "KETUA_RT", o: { wilayah_id?: string; rw?: string } = {}) =>
    tx.user.create({
      data: { nama, email: `uji-pengguna-${nama.toLowerCase().replace(/\s/g, "-")}@contoh.test`, role, status: "AKTIF", email_verified: true, ...o },
    });
  const superAdmin = await akun("Super", "SUPER_ADMIN");
  const adminRw = await akun("Admin Rw", "ADMIN_RW", { rw: "092" });
  const ketua1 = await akun("Ketua Satu", "KETUA_RT", { wilayah_id: rt1.id, rw: "092" });
  const ketua2 = await akun("Ketua Dua", "KETUA_RT", { wilayah_id: rt2.id, rw: "092" });
  const ketuaLain = await akun("Ketua Lain", "KETUA_RT", { wilayah_id: rwLain.id, rw: "091" });
  const sebagai = (u: { id: string; nama: string; email: string; role: Pengguna["role"]; wilayah_id: string | null; rw: string | null }): Pengguna => ({
    id: u.id, nama: u.nama, email: u.email, role: u.role, wilayah_id: u.wilayah_id, rw: u.rw, warga_id: null,
  });

  const klaim = async (n: number, wilayahId: string, o: { verif?: boolean } = {}) => {
    const kk = await tx.kartuKeluarga.create({ data: { no_kk: noKk(n), alamat: "Jl. Uji", wilayah_id: wilayahId, created_by: superAdmin.id } });
    const warga = await tx.warga.create({
      data: {
        kartu_keluarga_id: kk.id, nik: nik(n), nama_lengkap: `Warga Klaim ${n}`, jenis_kelamin: "L",
        tanggal_lahir: new Date("1990-05-15"), hubungan_keluarga: "KEPALA_KELUARGA", status_kependudukan: "AKTIF",
      },
    });
    const user = await tx.user.create({
      data: {
        nama: `Warga Klaim ${n}`, email: `uji-pengguna-klaim-${n}@contoh.test`, role: "WARGA", status: "MENUNGGU_VERIFIKASI",
        email_verified: o.verif ?? true, warga_id: warga.id,
      },
    });
    return { warga, user };
  };

  return { rt1, rt2, rwLain, superAdmin, adminRw, ketua1, ketua2, ketuaLain, sebagai, klaim };
}

const tolakBila = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(GalatPengguna);

describe("Akun pengurus: hak kelola (FR-USR-01, PRD 2.2)", () => {
  it("Admin RW hanya melihat Ketua RT di RW-nya; Super Admin melihat Admin RW dan Ketua RT", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const admin = s.sebagai(s.adminRw);
      const emailAdmin = (await daftarPengurus(admin, {}, tx)).map((b) => b.email);
      expect(emailAdmin).toContain(s.ketua1.email);
      expect(emailAdmin).toContain(s.ketua2.email);
      expect(emailAdmin).not.toContain(s.ketuaLain.email);
      expect(emailAdmin).not.toContain(s.adminRw.email);

      const semua = (await daftarPengurus(s.sebagai(s.superAdmin), {}, tx)).map((b) => b.email);
      expect(semua).toEqual(expect.arrayContaining([s.adminRw.email, s.ketua1.email, s.ketuaLain.email]));
      expect(semua).not.toContain(s.superAdmin.email);

      expect(await daftarPengurus(s.sebagai(s.ketua1), {}, tx)).toEqual([]);
    }));

  it("Admin RW hanya bisa membuat Ketua RT di RW-nya, bukan Admin RW atau RT di RW lain", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const admin = s.sebagai(s.adminRw);
      const dasar = { nama: "Ketua Baru", email: "uji-pengguna-baru@contoh.test" };
      await tolakBila(tambahPengurus(admin, { ...dasar, role: "ADMIN_RW", rw: "092" }, tx));
      await tolakBila(tambahPengurus(admin, { ...dasar, role: "KETUA_RT", wilayah_id: s.rwLain.id }, tx));
      const { id } = await tambahPengurus(admin, { ...dasar, role: "KETUA_RT", wilayah_id: s.rt2.id }, tx);
      const baru = await tx.user.findUniqueOrThrow({ where: { id }, include: { accounts: true } });
      expect(baru).toMatchObject({ role: "KETUA_RT", status: "AKTIF", email_verified: true, wilayah_id: s.rt2.id, rw: "092" });
      expect(baru.accounts[0]?.providerId).toBe("credential");
      expect(await tx.activityLog.count({ where: { aksi: "PENGGUNA_DIBUAT", entitas_id: id, user_id: admin.id } })).toBe(1);
    }));

  it("Super Admin membuat Admin RW; RW harus sudah terdaftar dan email tidak boleh ganda", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const su = s.sebagai(s.superAdmin);
      const data = { nama: "Admin Baru", email: "uji-pengguna-admin-baru@contoh.test", role: "ADMIN_RW" as const, rw: "092" };
      await tolakBila(tambahPengurus(su, { ...data, rw: "089" }, tx));
      const { id } = await tambahPengurus(su, data, tx);
      expect((await tx.user.findUniqueOrThrow({ where: { id } })).rw).toBe("092");
      await tolakBila(tambahPengurus(su, data, tx));
    }));

  it("Ketua RT dan Warga tidak bisa mengelola siapa pun", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const ketua = s.sebagai(s.ketua1);
      await tolakBila(tambahPengurus(ketua, { nama: "X", email: "uji-pengguna-x@contoh.test", role: "KETUA_RT", wilayah_id: s.rt1.id }, tx));
      await tolakBila(ubahStatusPengurus(ketua, s.ketua2.id, "NONAKTIF", tx));
    }));

  it("ubah peran dan RT: Admin RW tidak bisa menyentuh Ketua RT di RW lain atau menaikkan peran", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const admin = s.sebagai(s.adminRw);
      await ubahPengurus(admin, s.ketua1.id, { nama: "Ketua Satu", role: "KETUA_RT", wilayah_id: s.rt2.id }, tx);
      expect((await tx.user.findUniqueOrThrow({ where: { id: s.ketua1.id } })).wilayah_id).toBe(s.rt2.id);
      await tolakBila(ubahPengurus(admin, s.ketuaLain.id, { nama: "Ketua Lain", role: "KETUA_RT", wilayah_id: s.rt1.id }, tx));
      await tolakBila(ubahPengurus(admin, s.ketua1.id, { nama: "Ketua Satu", role: "ADMIN_RW", rw: "092" }, tx));
      await tolakBila(ubahPengurus(admin, s.adminRw.id, { nama: "Diri Sendiri", role: "KETUA_RT", wilayah_id: s.rt1.id }, tx));
    }));

  it("nonaktif mengakhiri sesi akun; aktifkan kembali; akun di luar cakupan ditolak", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const admin = s.sebagai(s.adminRw);
      await tx.session.create({ data: { token: "uji-pengguna-token", expiresAt: new Date(Date.now() + 60_000), userId: s.ketua1.id } });
      await ubahStatusPengurus(admin, s.ketua1.id, "NONAKTIF", tx);
      expect((await tx.user.findUniqueOrThrow({ where: { id: s.ketua1.id } })).status).toBe("NONAKTIF");
      expect(await tx.session.count({ where: { userId: s.ketua1.id } })).toBe(0);
      await ubahStatusPengurus(admin, s.ketua1.id, "AKTIF", tx);
      expect((await tx.user.findUniqueOrThrow({ where: { id: s.ketua1.id } })).status).toBe("AKTIF");
      await tolakBila(ubahStatusPengurus(admin, s.ketuaLain.id, "NONAKTIF", tx));
    }));
});

describe("Antrean klaim akun warga (FR-USR-02)", () => {
  it("Ketua RT hanya melihat klaim RT-nya; Admin RW satu RW; Super Admin semua", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const k1 = await s.klaim(1, s.rt1.id);
      const k2 = await s.klaim(2, s.rt2.id);
      const k3 = await s.klaim(3, s.rwLain.id);
      const idDari = async (u: Pengguna) => (await daftarKlaim(u, tx)).map((b) => b.id).filter((id) => [k1, k2, k3].some((k) => k.user.id === id));
      expect(await idDari(s.sebagai(s.ketua1))).toEqual([k1.user.id]);
      expect((await idDari(s.sebagai(s.adminRw))).sort()).toEqual([k1.user.id, k2.user.id].sort());
      expect(await idDari(s.sebagai(s.superAdmin))).toHaveLength(3);

      const baris = (await daftarKlaim(s.sebagai(s.ketua1), tx)).find((b) => b.id === k1.user.id);
      expect(baris).toMatchObject({ nama: "Warga Klaim 1", rt: "RT 001", emailTerverifikasi: true });
      expect(baris?.nik).not.toContain(nik(1));
      expect(baris?.nik).toBe(`${nik(1).slice(0, 4)}${"●".repeat(8)}${nik(1).slice(12)}`);

      const stat = await statistikPengguna(s.sebagai(s.ketua1), tx);
      expect(stat.klaimMenunggu).toBeGreaterThanOrEqual(1);
    }));

  it("setujui: status AKTIF, tercatat di log, dan tidak bisa diproses dua kali", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const k = await s.klaim(1, s.rt1.id);
      const ketua = s.sebagai(s.ketua1);
      const hasil = await setujuiKlaim(ketua, k.user.id, tx);
      expect(hasil).toEqual({ email: k.user.email, nama: "Warga Klaim 1" });
      expect((await tx.user.findUniqueOrThrow({ where: { id: k.user.id } })).status).toBe("AKTIF");
      const log = await tx.activityLog.findFirstOrThrow({ where: { aksi: "KLAIM_DISETUJUI", entitas_id: k.user.id } });
      expect(log.user_id).toBe(ketua.id);
      expect(JSON.stringify(log)).not.toContain(nik(1));
      await tolakBila(setujuiKlaim(ketua, k.user.id, tx));
    }));

  it("Ketua RT lain tidak bisa menyetujui atau menolak klaim di luar RT-nya", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const k = await s.klaim(1, s.rt1.id);
      await tolakBila(setujuiKlaim(s.sebagai(s.ketua2), k.user.id, tx));
      await tolakBila(tolakKlaim(s.sebagai(s.ketua2), k.user.id, { alasan: undefined }, tx));
      expect((await tx.user.findUniqueOrThrow({ where: { id: k.user.id } })).status).toBe("MENUNGGU_VERIFIKASI");
    }));

  it("klaim dengan email belum terverifikasi tidak bisa disetujui", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const k = await s.klaim(1, s.rt1.id, { verif: false });
      await tolakBila(setujuiKlaim(s.sebagai(s.ketua1), k.user.id, tx));
    }));

  it("tolak: status DITOLAK, warga_id dikosongkan sehingga data bisa diklaim lagi, alasan di log", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const k = await s.klaim(1, s.rt1.id);
      const ketua = s.sebagai(s.ketua1);
      await tolakKlaim(ketua, k.user.id, { alasan: "Bukan warga RT ini" }, tx);
      const user = await tx.user.findUniqueOrThrow({ where: { id: k.user.id } });
      expect(user).toMatchObject({ status: "DITOLAK", warga_id: null });
      const log = await tx.activityLog.findFirstOrThrow({ where: { aksi: "KLAIM_DITOLAK", entitas_id: k.user.id } });
      expect(log.perubahan).toEqual({ alasan: "Bukan warga RT ini" });
      expect(await tx.user.count({ where: { warga_id: k.warga.id } })).toBe(0);
      expect((await daftarKlaim(ketua, tx)).some((b) => b.id === k.user.id)).toBe(false);
    }));
});
