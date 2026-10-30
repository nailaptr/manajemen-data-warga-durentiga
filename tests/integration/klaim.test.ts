import { describe, expect, it } from "vitest";
import { BATAS_PERCOBAAN } from "@/lib/klaim-limit";
import { klaimAkun, PESAN_KLAIM_DIBATASI, PESAN_KLAIM_GAGAL, type HasilKlaim } from "@/lib/data/klaim";
import type { KlaimData } from "@/lib/validators/klaim";
import { dalamRollback, type Tx } from "./helpers";

// Data di RW 094 dan dibatalkan. NIK 99911..., No KK 99912..., email @contoh.test.
const SANDI = "sandi-uji-klaim-1";
const HARI = new Date(Date.UTC(2026, 9, 30));
const DEWASA = "1990-05-15";

const nik = (n: number) => `99911${String(n).padStart(11, "0")}`;
const noKk = (n: number) => `99912${String(n).padStart(11, "0")}`;

interface OpsiWarga {
  lahir?: string;
  status?: "AKTIF" | "PINDAH";
  warga_dihapus?: boolean;
  kk_dihapus?: boolean;
}

async function siapkan(tx: Tx) {
  const rt = await tx.wilayah.create({ data: { rw: "094", rt: "001" } });
  const admin = await tx.user.create({
    data: { nama: "Penguji", email: "uji-klaim-admin@contoh.test", role: "ADMIN_RW", rw: "094", status: "AKTIF" },
  });
  const buatWarga = async (n: number, o: OpsiWarga = {}) => {
    const kk = await tx.kartuKeluarga.create({
      data: {
        no_kk: noKk(n),
        alamat: "Jl. Uji",
        wilayah_id: rt.id,
        created_by: admin.id,
        deleted_at: o.kk_dihapus ? new Date() : null,
      },
    });
    return tx.warga.create({
      data: {
        kartu_keluarga_id: kk.id,
        nik: nik(n),
        nama_lengkap: `Warga Uji ${n}`,
        jenis_kelamin: "L",
        tanggal_lahir: new Date(o.lahir ?? DEWASA),
        hubungan_keluarga: "KEPALA_KELUARGA",
        status_kependudukan: o.status ?? "AKTIF",
        deleted_at: o.warga_dihapus ? new Date() : null,
      },
    });
  };
  return { rt, admin, buatWarga };
}

const data = (n: number, o: Partial<KlaimData> = {}): KlaimData => ({
  email: `uji-klaim-${n}@contoh.test`,
  kata_sandi: SANDI,
  nik: nik(n),
  no_kk: noKk(n),
  tanggal_lahir: DEWASA,
  setuju: true,
  ...o,
});

const klaim = (tx: Tx, input: KlaimData, ip: string) => klaimAkun(input, ip, tx, HARI);
const GAGAL: HasilKlaim = { ok: false, kode: "GAGAL", pesan: PESAN_KLAIM_GAGAL };

describe("Klaim akun warga (PRD 3.1)", () => {
  it("data cocok membuat akun MENUNGGU_VERIFIKASI yang tertaut ke warga dan belum terverifikasi", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const w = await s.buatWarga(1);
      const hasil = await klaim(tx, data(1), "ip-1");
      expect(hasil).toEqual({ ok: true, email: "uji-klaim-1@contoh.test" });

      const user = await tx.user.findFirstOrThrow({ where: { warga_id: w.id }, include: { accounts: true } });
      expect(user).toMatchObject({ role: "WARGA", status: "MENUNGGU_VERIFIKASI", email_verified: false, nama: "Warga Uji 1" });
      expect(user.accounts).toHaveLength(1);
      expect(user.accounts[0]?.providerId).toBe("credential");
      expect(user.accounts[0]?.password).not.toContain(SANDI);

      const log = await tx.activityLog.findFirstOrThrow({ where: { aksi: "KLAIM_DIAJUKAN", user_id: user.id } });
      expect(JSON.stringify(log)).not.toContain(nik(1));
    }));

  it("usia tepat 17 tahun diterima, kurang sehari ditolak", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      await s.buatWarga(1, { lahir: "2009-10-30" });
      await s.buatWarga(2, { lahir: "2009-10-31" });
      expect((await klaim(tx, data(1, { tanggal_lahir: "2009-10-30" }), "ip-1")).ok).toBe(true);
      expect(await klaim(tx, data(2, { tanggal_lahir: "2009-10-31" }), "ip-2")).toEqual(GAGAL);
    }));
});

describe("Klaim akun: pesan galat sama untuk semua kegagalan (AC-09)", () => {
  it("semua sebab gagal menghasilkan hasil dan pesan yang sama persis", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      await s.buatWarga(1); // dipakai kasus NIK/No KK/tanggal salah
      await s.buatWarga(2, { status: "PINDAH" });
      await s.buatWarga(3, { warga_dihapus: true });
      await s.buatWarga(4, { lahir: "2012-01-01" });
      const diklaim = await s.buatWarga(5);
      await tx.user.create({
        data: { nama: "Pemilik", email: "uji-klaim-pemilik@contoh.test", role: "WARGA", status: "AKTIF", warga_id: diklaim.id },
      });
      await s.buatWarga(6); // email sudah dipakai
      await s.buatWarga(7, { kk_dihapus: true });

      const kasus: [string, KlaimData][] = [
        ["NIK salah", data(1, { nik: nik(90) })],
        ["No KK salah", data(1, { no_kk: noKk(90) })],
        ["tanggal lahir salah", data(1, { tanggal_lahir: "1990-05-16" })],
        ["status bukan AKTIF", data(2)],
        ["warga dihapus", data(3)],
        ["di bawah 17 tahun", data(4, { tanggal_lahir: "2012-01-01" })],
        ["sudah diklaim", data(5)],
        ["email sudah terdaftar", data(6, { email: "uji-klaim-admin@contoh.test" })],
        ["KK dihapus", data(7)],
      ];
      const hasil: HasilKlaim[] = [];
      for (const [i, [, input]] of kasus.entries()) hasil.push(await klaim(tx, input, `ip-gagal-${i}`));

      kasus.forEach(([nama], i) => expect(hasil[i], nama).toEqual(GAGAL));
      expect(new Set(hasil.map((h) => JSON.stringify(h))).size).toBe(1);
      expect(await tx.user.count({ where: { email: { startsWith: "uji-klaim-" }, role: "WARGA", status: "MENUNGGU_VERIFIKASI" } })).toBe(0);
    }));
});

describe("Klaim akun: pembatasan 5 percobaan per jam (AC-09, SEC-05)", () => {
  it("percobaan ke-6 dari satu IP diblokir walau datanya cocok, dan tidak membuat akun", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const w = await s.buatWarga(1);
      for (let i = 0; i < BATAS_PERCOBAAN; i += 1) {
        expect(await klaim(tx, data(1, { nik: nik(80 + i) }), "ip-sama")).toEqual(GAGAL);
      }
      const keenam = await klaim(tx, data(1), "ip-sama");
      expect(keenam).toEqual({ ok: false, kode: "DIBATASI", pesan: PESAN_KLAIM_DIBATASI });
      expect(await tx.user.count({ where: { warga_id: w.id } })).toBe(0);

      // IP dan NIK lain tidak ikut terblokir.
      expect((await klaim(tx, data(1), "ip-lain")).ok).toBe(true);
    }));

  it("percobaan ke-6 untuk satu NIK diblokir walau datang dari IP berbeda", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const w = await s.buatWarga(1);
      for (let i = 0; i < BATAS_PERCOBAAN; i += 1) {
        expect(await klaim(tx, data(1, { tanggal_lahir: "1990-05-16" }), `ip-nik-${i}`)).toEqual(GAGAL);
      }
      expect(await klaim(tx, data(1), "ip-nik-baru")).toEqual({ ok: false, kode: "DIBATASI", pesan: PESAN_KLAIM_DIBATASI });
      expect(await tx.user.count({ where: { warga_id: w.id } })).toBe(0);
    }));

  it("percobaan dicatat tanpa NIK atau IP apa adanya", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      await s.buatWarga(1);
      await klaim(tx, data(1), "203.0.113.7");
      const log = await tx.activityLog.findMany({ where: { aksi: "KLAIM_PERCOBAAN" } });
      expect(log).toHaveLength(2);
      const teks = JSON.stringify(log);
      expect(teks).not.toContain(nik(1));
      expect(teks).not.toContain("203.0.113.7");
    }));
});

describe("Klaim akun: satu data warga hanya untuk satu akun (PRD 3.1)", () => {
  it("klaim kedua atas warga yang sama ditolak dengan pesan generik", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const w = await s.buatWarga(1);
      expect((await klaim(tx, data(1), "ip-1")).ok).toBe(true);
      expect(await klaim(tx, data(1, { email: "uji-klaim-kedua@contoh.test" }), "ip-2")).toEqual(GAGAL);
      expect(await tx.user.count({ where: { warga_id: w.id } })).toBe(1);
    }));

  it("database menolak dua akun dengan warga_id yang sama", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const w = await s.buatWarga(1);
      const baru = (email: string) =>
        tx.user.create({ data: { nama: "Dobel", email, role: "WARGA", status: "MENUNGGU_VERIFIKASI", warga_id: w.id } });
      await baru("uji-klaim-a@contoh.test");
      await expect(baru("uji-klaim-b@contoh.test")).rejects.toThrow();
    }));
});
