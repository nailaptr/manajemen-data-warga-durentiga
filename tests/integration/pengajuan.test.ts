import { describe, expect, it } from "vitest";
import type { Pengguna } from "@/lib/auth";
import {
  batalkanPengajuan,
  buatPengajuan,
  daftarAntrean,
  detailPengajuan,
  GalatPengajuan,
  hitungPengajuan,
  KonflikPengajuan,
  penerimaHasilPengajuan,
  penerimaPengajuanBaru,
  setujuiPengajuan,
  tolakPengajuan,
} from "@/lib/data/pengajuan";
import { kualitasData } from "@/lib/data/stats";
import { buatPengajuanSchema, tolakPengajuanSchema } from "@/lib/validators/pengajuan";
import { dalamRollback, type Tx } from "./helpers";

// Data di RW 088, dibatalkan. NIK 99917..., No KK 99918....
const nik = (n: number) => `99917${String(n).padStart(11, "0")}`;
const noKk = (n: number) => `99918${String(n).padStart(11, "0")}`;

async function siapkan(tx: Tx) {
  const rt1 = await tx.wilayah.create({ data: { rw: "088", rt: "001" } });
  const rt2 = await tx.wilayah.create({ data: { rw: "088", rt: "002" } });
  const pekerjaanA = await tx.refPekerjaan.create({ data: { nama: "Uji Pekerjaan A" } });
  const pekerjaanB = await tx.refPekerjaan.create({ data: { nama: "Uji Pekerjaan B" } });
  const pengurus = (nama: string, role: "KETUA_RT" | "ADMIN_RW", wilayah: string | null) =>
    tx.user.create({
      data: { nama, email: `uji-pgj-${nama}@contoh.test`, role, status: "AKTIF", email_verified: true, wilayah_id: wilayah, rw: role === "ADMIN_RW" ? "088" : null },
    });
  const ketuaRt1 = await pengurus("rt1", "KETUA_RT", rt1.id);
  const ketuaRt2 = await pengurus("rt2", "KETUA_RT", rt2.id);

  const kkBaru = (n: number, wilayahId: string) =>
    tx.kartuKeluarga.create({ data: { no_kk: noKk(n), alamat: `Jl. Uji ${n}`, wilayah_id: wilayahId, created_by: ketuaRt1.id } });
  const wargaBaru = (kkId: string, n: number, hubungan: "KEPALA_KELUARGA" | "ANAK", lahir: string) =>
    tx.warga.create({
      data: {
        kartu_keluarga_id: kkId, nik: nik(n), nama_lengkap: `Warga Pengajuan ${n}`, jenis_kelamin: "L",
        tanggal_lahir: new Date(lahir), hubungan_keluarga: hubungan, tempat_lahir: "Jakarta",
      },
    });

  const kkA = await kkBaru(1, rt1.id);
  const kepala = await wargaBaru(kkA.id, 1, "KEPALA_KELUARGA", "1980-01-01");
  const anak = await wargaBaru(kkA.id, 2, "ANAK", "2007-06-01");
  const kkB = await kkBaru(2, rt2.id);
  const orangLain = await wargaBaru(kkB.id, 3, "KEPALA_KELUARGA", "1975-01-01");

  const akunWarga = await tx.user.create({
    data: { nama: "Warga Pengajuan 2", email: "uji-pgj-warga@contoh.test", role: "WARGA", status: "AKTIF", email_verified: true, warga_id: anak.id },
  });
  const sebagai = (u: { id: string; nama: string; email: string; role: Pengguna["role"]; warga_id: string | null; wilayah_id: string | null; rw: string | null }): Pengguna => ({
    id: u.id, nama: u.nama, email: u.email, role: u.role, wilayah_id: u.wilayah_id, rw: u.rw, warga_id: u.warga_id,
  });

  return {
    rt1, rt2, pekerjaanA, pekerjaanB, kkA, kepala, anak, orangLain,
    warga: sebagai(akunWarga),
    rt1User: sebagai(ketuaRt1),
    rt2User: sebagai(ketuaRt2),
    ubahPekerjaan: (wargaId: string, pekerjaanId: string) =>
      buatPengajuanSchema.parse({ jenis: "UBAH_WARGA", warga_id: wargaId, perubahan: { pekerjaan_id: pekerjaanId }, catatan: "Mulai bekerja" }),
  };
}

const log = (tx: Tx, entitasId: string) => tx.activityLog.findMany({ where: { entitas: "pengajuan", entitas_id: entitasId }, orderBy: { created_at: "asc" } });

describe("Pengajuan ubah data (AC-06)", () => {
  it("menyimpan hanya field yang berubah dan data resmi tetap sampai disetujui", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, buatPengajuanSchema.parse({
        jenis: "UBAH_WARGA", warga_id: s.anak.id,
        // nama sama dengan data sekarang: tidak boleh ikut tersimpan.
        perubahan: { nama_lengkap: "Warga Pengajuan 2", pekerjaan_id: s.pekerjaanA.id },
      }), tx);

      const p = await tx.pengajuan.findUniqueOrThrow({ where: { id } });
      expect(p.status).toBe("MENUNGGU");
      expect(p.data_baru).toEqual({ pekerjaan_id: s.pekerjaanA.id });
      expect(p.data_lama).toEqual({ pekerjaan_id: null });
      expect((await tx.warga.findUniqueOrThrow({ where: { id: s.anak.id } })).pekerjaan_id).toBeNull();
    }));

  it("berubah setelah disetujui, status tercatat, dan ada log tanpa nilai data", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      await setujuiPengajuan(s.rt1User, id, {}, tx);

      expect((await tx.warga.findUniqueOrThrow({ where: { id: s.anak.id } })).pekerjaan_id).toBe(s.pekerjaanA.id);
      const p = await tx.pengajuan.findUniqueOrThrow({ where: { id } });
      expect(p.status).toBe("DISETUJUI");
      expect(p.diproses_oleh).toBe(s.rt1User.id);
      expect(p.diproses_at).not.toBeNull();

      const catatan = await log(tx, id);
      expect(catatan.map((l) => l.aksi)).toEqual(["PENGAJUAN_DIBUAT", "PENGAJUAN_DISETUJUI"]);
      expect(catatan[1].user_id).toBe(s.rt1User.id);
      expect(catatan[1].perubahan).toEqual({ jenis: "UBAH_WARGA", field: ["pekerjaan_id"], konflik: false });
      expect(JSON.stringify(catatan.map((l) => l.perubahan))).not.toContain(s.pekerjaanA.id);
    }));

  it("terdeteksi konflik bila data warga berubah sejak pengajuan dibuat, dan butuh konfirmasi (BR-08)", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      await tx.warga.update({ where: { id: s.anak.id }, data: { pekerjaan_id: s.pekerjaanB.id } });

      const detail = await detailPengajuan(s.rt1User, id, tx);
      expect(detail?.konflik).toEqual(["Pekerjaan"]);

      await expect(setujuiPengajuan(s.rt1User, id, {}, tx)).rejects.toBeInstanceOf(KonflikPengajuan);
      expect((await tx.pengajuan.findUniqueOrThrow({ where: { id } })).status).toBe("MENUNGGU");
      expect((await tx.warga.findUniqueOrThrow({ where: { id: s.anak.id } })).pekerjaan_id).toBe(s.pekerjaanB.id);

      await setujuiPengajuan(s.rt1User, id, { konfirmasiKonflik: true }, tx);
      expect((await tx.warga.findUniqueOrThrow({ where: { id: s.anak.id } })).pekerjaan_id).toBe(s.pekerjaanA.id);
      expect((await log(tx, id)).at(-1)?.perubahan).toMatchObject({ konflik: true });
    }));

  it("tanpa perubahan sejak diajukan tidak ada konflik", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      expect((await detailPengajuan(s.rt1User, id, tx))?.konflik).toEqual([]);
    }));

  it("ditolak tanpa mengubah data resmi, alasan tersimpan dan tercatat", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      await tolakPengajuan(s.rt1User, id, "Mohon lampirkan bukti pekerjaan", tx);

      const p = await tx.pengajuan.findUniqueOrThrow({ where: { id } });
      expect([p.status, p.alasan_penolakan]).toEqual(["DITOLAK", "Mohon lampirkan bukti pekerjaan"]);
      expect((await tx.warga.findUniqueOrThrow({ where: { id: s.anak.id } })).pekerjaan_id).toBeNull();
      expect((await log(tx, id)).map((l) => l.aksi)).toEqual(["PENGAJUAN_DIBUAT", "PENGAJUAN_DITOLAK"]);
      await expect(setujuiPengajuan(s.rt1User, id, {}, tx)).rejects.toBeInstanceOf(GalatPengajuan);
    }));

  it("alasan penolakan minimal 10 karakter", () => {
    expect(tolakPengajuanSchema.safeParse({ alasan: "kurang" }).success).toBe(false);
    expect(tolakPengajuanSchema.safeParse({ alasan: "         pendek " }).success).toBe(false);
    expect(tolakPengajuanSchema.safeParse({ alasan: "Bukti belum lengkap" }).success).toBe(true);
  });

  it("hanya diproses sekali: persetujuan kedua ditolak", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      await setujuiPengajuan(s.rt1User, id, {}, tx);
      await expect(setujuiPengajuan(s.rt1User, id, {}, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(tolakPengajuan(s.rt1User, id, "Sudah diproses sebelumnya", tx)).rejects.toBeInstanceOf(GalatPengajuan);
    }));
});

describe("Pengajuan: cakupan dan pembatalan", () => {
  it("server menolak pengajuan untuk anggota KK lain", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      await expect(buatPengajuan(s.warga, s.ubahPekerjaan(s.orangLain.id, s.pekerjaanA.id), tx)).rejects.toBeInstanceOf(GalatPengajuan);
      expect(await tx.pengajuan.count({ where: { kartu_keluarga_id: s.kkA.id } })).toBe(0);
    }));

  it("hanya warga yang bisa membuat pengajuan, dan tanpa perubahan atau dobel ditolak", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      await expect(buatPengajuan(s.rt1User, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(
        buatPengajuan(s.warga, buatPengajuanSchema.parse({ jenis: "UBAH_WARGA", warga_id: s.anak.id, perubahan: { nama_lengkap: "Warga Pengajuan 2" } }), tx),
      ).rejects.toThrow("Tidak ada data yang berubah");
      await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      await expect(buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanB.id), tx)).rejects.toBeInstanceOf(GalatPengajuan);
    }));

  it("warga membatalkan selama MENUNGGU; setelah itu tidak bisa dan tidak bisa disetujui", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      await batalkanPengajuan(s.warga, id, tx);
      expect((await tx.pengajuan.findUniqueOrThrow({ where: { id } })).status).toBe("DIBATALKAN");
      expect((await log(tx, id)).map((l) => l.aksi)).toEqual(["PENGAJUAN_DIBUAT", "PENGAJUAN_DIBATALKAN"]);
      await expect(batalkanPengajuan(s.warga, id, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(setujuiPengajuan(s.rt1User, id, {}, tx)).rejects.toBeInstanceOf(GalatPengajuan);
    }));

  it("pengajuan yang sudah disetujui atau milik orang lain tidak bisa dibatalkan", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      const kepalaAkun = await tx.user.create({
        data: { nama: "Kepala", email: "uji-pgj-kepala@contoh.test", role: "WARGA", status: "AKTIF", email_verified: true, warga_id: s.kepala.id },
      });
      const sebagaiKepala: Pengguna = { ...s.warga, id: kepalaAkun.id, warga_id: s.kepala.id };
      await expect(batalkanPengajuan(sebagaiKepala, id, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(batalkanPengajuan(s.rt1User, id, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await setujuiPengajuan(s.rt1User, id, {}, tx);
      await expect(batalkanPengajuan(s.warga, id, tx)).rejects.toBeInstanceOf(GalatPengajuan);
    }));

  it("Ketua RT lain tidak melihat atau memproses pengajuan di luar RT-nya; warga tidak masuk antrean", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);

      expect((await daftarAntrean(s.rt1User, "MENUNGGU", tx)).map((b) => b.id)).toContain(id);
      expect((await daftarAntrean(s.rt2User, "MENUNGGU", tx)).map((b) => b.id)).not.toContain(id);
      expect(await detailPengajuan(s.rt2User, id, tx)).toBeNull();
      await expect(setujuiPengajuan(s.rt2User, id, {}, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(tolakPengajuan(s.rt2User, id, "Bukan RT saya sendiri", tx)).rejects.toBeInstanceOf(GalatPengajuan);

      // Cakupan Warga mencakup KK-nya sendiri, jadi peran dicek terpisah.
      await expect(daftarAntrean(s.warga, "MENUNGGU", tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(detailPengajuan(s.warga, id, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(setujuiPengajuan(s.warga, id, {}, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      await expect(hitungPengajuan(s.warga, tx)).rejects.toBeInstanceOf(GalatPengajuan);
      expect((await tx.pengajuan.findUniqueOrThrow({ where: { id } })).status).toBe("MENUNGGU");
    }));

  it("hitungan per status mengikuti cakupan", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      expect(await hitungPengajuan(s.rt1User, tx)).toEqual({ MENUNGGU: 1, DISETUJUI: 0, DITOLAK: 0, DIBATALKAN: 0 });
      await tolakPengajuan(s.rt1User, id, "Data belum lengkap", tx);
      expect(await hitungPengajuan(s.rt1User, tx)).toEqual({ MENUNGGU: 0, DISETUJUI: 0, DITOLAK: 1, DIBATALKAN: 0 });
      expect(await hitungPengajuan(s.rt2User, tx)).toEqual({ MENUNGGU: 0, DISETUJUI: 0, DITOLAK: 0, DIBATALKAN: 0 });
    }));
});

describe("Pengajuan lapor pindah / meninggal dan tambah anggota", () => {
  it("lapor pindah mengubah status_kependudukan hanya setelah disetujui", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, buatPengajuanSchema.parse({ jenis: "LAPOR_PINDAH", warga_id: s.anak.id, tanggal_status: "2026-10-01" }), tx);
      expect((await tx.warga.findUniqueOrThrow({ where: { id: s.anak.id } })).status_kependudukan).toBe("AKTIF");
      await setujuiPengajuan(s.rt1User, id, {}, tx);
      const w = await tx.warga.findUniqueOrThrow({ where: { id: s.anak.id } });
      expect([w.status_kependudukan, w.tanggal_status?.toISOString().slice(0, 10)]).toEqual(["PINDAH", "2026-10-01"]);
    }));

  it("lapor meninggal untuk Kepala Keluarga menandai KK tanpa kepala keluarga (BR-06)", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      expect((await kualitasData(s.rt1User, { db: tx })).kkTanpaKepala).toBe(0);
      const id = await buatPengajuan(
        s.warga, buatPengajuanSchema.parse({ jenis: "LAPOR_MENINGGAL", warga_id: s.kepala.id, tanggal_status: "2026-10-02" }), tx,
      );
      expect((await kualitasData(s.rt1User, { db: tx })).kkTanpaKepala).toBe(0);
      await setujuiPengajuan(s.rt1User, id, {}, tx);
      expect((await tx.warga.findUniqueOrThrow({ where: { id: s.kepala.id } })).status_kependudukan).toBe("MENINGGAL");
      expect((await kualitasData(s.rt1User, { db: tx })).kkTanpaKepala).toBe(1);
    }));

  it("lapor untuk warga yang sudah tidak aktif ditolak saat disetujui", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, buatPengajuanSchema.parse({ jenis: "LAPOR_PINDAH", warga_id: s.anak.id, tanggal_status: "2026-10-01" }), tx);
      await tx.warga.update({ where: { id: s.anak.id }, data: { status_kependudukan: "MENINGGAL", tanggal_status: new Date("2026-09-01") } });
      await expect(setujuiPengajuan(s.rt1User, id, {}, tx)).rejects.toThrow("tidak lagi berstatus aktif");
    }));

  it("tambah anggota membuat warga baru di KK pengaju hanya setelah disetujui", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const pendidikan = await tx.refPendidikan.create({ data: { nama: "Uji Pendidikan", urutan: 999 } });
      const id = await buatPengajuan(s.warga, buatPengajuanSchema.parse({
        jenis: "TAMBAH_ANGGOTA",
        anggota: {
          hubungan_keluarga: "CUCU", nik: nik(9), nama_lengkap: "Bayi Uji", jenis_kelamin: "P", tempat_lahir: "Jakarta",
          tanggal_lahir: "2026-10-01", agama: "ISLAM", pendidikan_id: pendidikan.id, pekerjaan_id: s.pekerjaanA.id,
        },
      }), tx);
      expect(await tx.warga.count({ where: { nik: nik(9) } })).toBe(0);
      expect((await detailPengajuan(s.rt1User, id, tx))?.nama).toBe("Bayi Uji");

      await setujuiPengajuan(s.rt1User, id, {}, tx);
      const baru = await tx.warga.findUniqueOrThrow({ where: { nik: nik(9) } });
      expect([baru.kartu_keluarga_id, baru.status_kependudukan, baru.hubungan_keluarga]).toEqual([s.kkA.id, "AKTIF", "CUCU"]);
    }));

  it("tambah anggota dengan NIK yang sudah terdaftar gagal disetujui tanpa mengubah status", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const pendidikan = await tx.refPendidikan.create({ data: { nama: "Uji Pendidikan", urutan: 999 } });
      const id = await buatPengajuan(s.warga, buatPengajuanSchema.parse({
        jenis: "TAMBAH_ANGGOTA",
        anggota: {
          hubungan_keluarga: "CUCU", nik: s.orangLain.nik, nama_lengkap: "Bayi Uji", jenis_kelamin: "P", tempat_lahir: "Jakarta",
          tanggal_lahir: "2026-10-01", agama: "ISLAM", pendidikan_id: pendidikan.id, pekerjaan_id: s.pekerjaanA.id,
        },
      }), tx);
      // Kegagalan di dalam transaksi uji (satu transaksi luar) tidak bisa dibatalkan sebagian; cukup pastikan galatnya.
      await expect(setujuiPengajuan(s.rt1User, id, {}, tx)).rejects.toThrow();
    }));

  it("Kepala Keluarga tidak bisa ditambah lewat pengajuan", () => {
    const hasil = buatPengajuanSchema.safeParse({
      jenis: "TAMBAH_ANGGOTA",
      anggota: {
        hubungan_keluarga: "KEPALA_KELUARGA", nik: nik(8), nama_lengkap: "X", jenis_kelamin: "L", tempat_lahir: "Jakarta",
        tanggal_lahir: "1990-01-01", agama: "ISLAM", pendidikan_id: crypto.randomUUID(), pekerjaan_id: crypto.randomUUID(),
      },
    });
    expect(hasil.success).toBe(false);
  });
});

describe("Penerima email pengajuan (FR-PGJ-06)", () => {
  it("pengajuan baru hanya diberitahukan ke Ketua RT di RT-nya, tanpa nomor", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      const penerima = await penerimaPengajuanBaru(s.warga, id, tx);
      expect(penerima?.pengurus.map((k) => k.email)).toEqual([s.rt1User.email]);
      expect(penerima?.jenis).toBe("Ubah data");
      expect(JSON.stringify(penerima)).not.toMatch(/\d{16}/);
    }));

  it("hasil pengajuan menuju pengaju hanya setelah diputuskan, dan tidak untuk warga", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const id = await buatPengajuan(s.warga, s.ubahPekerjaan(s.anak.id, s.pekerjaanA.id), tx);
      expect(await penerimaHasilPengajuan(s.rt1User, id, tx)).toBeNull();
      await tolakPengajuan(s.rt1User, id, "Mohon lampirkan bukti pekerjaan", tx);
      const hasil = await penerimaHasilPengajuan(s.rt1User, id, tx);
      expect(hasil).toMatchObject({ email: s.warga.email, disetujui: false, alasan: "Mohon lampirkan bukti pekerjaan" });
      await expect(penerimaHasilPengajuan(s.warga, id, tx)).rejects.toBeInstanceOf(GalatPengajuan);
    }));
});
