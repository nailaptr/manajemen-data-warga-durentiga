import { describe, expect, it } from "vitest";
import { buildWargaWhere } from "@/lib/filters";
import { daftarWargaTerfilter, hitungWarga, perPekerjaan, perPendidikan, perRt, piramida, ringkasan } from "@/lib/data/stats";
import type { scopeWhere } from "@/lib/scope";
import { dalamRollback, type Tx } from "./helpers";

// Semua data dibuat di transaksi yang dibatalkan, di RW 096 yang hanya dilihat pengguna ujinya.
// NIK berawalan 99907 dan No KK berawalan 99906: bukan data nyata.
type PenggunaUji = Parameters<typeof scopeWhere>[0];

const HARI_INI = new Date(Date.UTC(2026, 5, 15));
let urut = 0;

interface DataUji {
  rt1: string;
  rt2: string;
  admin: PenggunaUji;
  ketuaRt1: PenggunaUji;
  m: { sma: string; sd: string; bb: string; wira: string };
  kat: { remaja: string; dewasa: string; subur: string; lansia: string };
  tambah: (o: Tambah) => Promise<string>;
}

interface Tambah {
  nama: string;
  jk: "L" | "P";
  lahir: string;
  pend?: string;
  pek?: string;
  rt?: string;
  status?: "AKTIF" | "PINDAH" | "MENINGGAL";
  dihapus?: boolean;
}

async function siapkan(tx: Tx, rw = "096"): Promise<DataUji> {
  const r1 = await tx.wilayah.create({ data: { rw, rt: "001" } });
  const r2 = await tx.wilayah.create({ data: { rw, rt: "002" } });
  const user = await tx.user.create({
    data: { nama: "Penguji", email: `penguji-filter-${rw}@contoh.test`, role: "ADMIN_RW", status: "AKTIF", rw },
  });
  const pend = (nama: string) => tx.refPendidikan.create({ data: { nama, urutan: 99 } });
  const pek = (nama: string) => tx.refPekerjaan.create({ data: { nama } });
  const kat = (nama: string, usia_min: number, usia_maks: number | null, jenis_kelamin: "P" | null = null) =>
    tx.kategoriUsia.create({ data: { nama, usia_min, usia_maks, jenis_kelamin, urutan: 99 } });
  const [sma, sd, bb, wira, remaja, dewasa, subur, lansia] = await Promise.all([
    pend("Uji SMA"), pend("Uji SD"), pek("Uji Belum Bekerja"), pek("Uji Wiraswasta"),
    kat("Uji Remaja", 12, 17), kat("Uji Dewasa", 18, 59), kat("Uji Usia subur", 15, 49, "P"), kat("Uji Lansia", 60, null),
  ]);

  async function tambah(o: Tambah): Promise<string> {
    urut += 1;
    const nomor = String(urut).padStart(11, "0");
    const kk = await tx.kartuKeluarga.create({
      data: { no_kk: `99906${nomor}`, alamat: "Jl. Uji", wilayah_id: o.rt ?? r1.id, created_by: user.id },
    });
    const w = await tx.warga.create({
      data: {
        kartu_keluarga_id: kk.id,
        nik: `99907${nomor}`,
        nama_lengkap: o.nama,
        jenis_kelamin: o.jk,
        tanggal_lahir: new Date(o.lahir),
        hubungan_keluarga: "KEPALA_KELUARGA",
        pendidikan_id: o.pend,
        pekerjaan_id: o.pek,
        status_kependudukan: o.status ?? "AKTIF",
        deleted_at: o.dihapus ? new Date() : null,
      },
    });
    return w.id;
  }

  return {
    rt1: r1.id,
    rt2: r2.id,
    admin: { role: "ADMIN_RW", rw, wilayah_id: null, warga_id: null },
    ketuaRt1: { role: "KETUA_RT", rw: null, wilayah_id: r1.id, warga_id: null },
    m: { sma: sma.id, sd: sd.id, bb: bb.id, wira: wira.id },
    kat: { remaja: remaja.id, dewasa: dewasa.id, subur: subur.id, lansia: lansia.id },
    tambah,
  };
}

const opsi = (tx: Tx, hariIni = HARI_INI) => ({ db: tx, hariIni });
const semuaNama = async (tx: Tx, u: PenggunaUji, f: Parameters<typeof buildWargaWhere>[0]) =>
  (await daftarWargaTerfilter(u, f, { ukuran: 1000 }, opsi(tx))).baris.map((b) => b.nama_lengkap).sort();

describe("filter Dashboard dan Cari Warga (PRD 6.3)", () => {
  // Tanggal lahir terhadap hari uji 2026-06-15: 2007-03-01 = 19 tahun, 2008-06-15 = 18, 2005-06-16 = 20,
  // 2005-06-15 = 21, 2008-06-16 = 17.
  async function dataKasusPrd(tx: Tx, d: DataUji) {
    const { sma, sd, bb, wira } = d.m;
    await d.tambah({ nama: "Cocok 19", jk: "P", lahir: "2007-03-01", pend: sma, pek: bb });
    await d.tambah({ nama: "Cocok 18", jk: "P", lahir: "2008-06-15", pend: sma, pek: bb });
    await d.tambah({ nama: "Cocok 20", jk: "P", lahir: "2005-06-16", pend: sma, pek: bb, rt: d.rt2 });
    await d.tambah({ nama: "Usia 21", jk: "P", lahir: "2005-06-15", pend: sma, pek: bb });
    await d.tambah({ nama: "Usia 17", jk: "P", lahir: "2008-06-16", pend: sma, pek: bb });
    await d.tambah({ nama: "Laki-laki", jk: "L", lahir: "2007-03-01", pend: sma, pek: bb });
    await d.tambah({ nama: "Pendidikan SD", jk: "P", lahir: "2007-03-01", pend: sd, pek: bb });
    await d.tambah({ nama: "Pekerjaan lain", jk: "P", lahir: "2007-03-01", pend: sma, pek: wira });
    await d.tambah({ nama: "Pindah", jk: "P", lahir: "2007-03-01", pend: sma, pek: bb, status: "PINDAH" });
    await d.tambah({ nama: "Dihapus", jk: "P", lahir: "2007-03-01", pend: sma, pek: bb, dihapus: true });
  }

  it("contoh kasus: SMA, Belum Bekerja, Perempuan, Dewasa, usia 18-20; COUNT sama dengan panjang daftar", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataKasusPrd(tx, d);
      const f = { pendidikan: [d.m.sma], pekerjaan: [d.m.bb], jk: ["P" as const], kategori: [d.kat.dewasa], usia_min: 18, usia_max: 20 };

      const total = await hitungWarga(d.admin, f, opsi(tx));
      const { total: totalDaftar, baris } = await daftarWargaTerfilter(d.admin, f, { ukuran: 1000 }, opsi(tx));

      expect(total).toBe(3);
      expect(totalDaftar).toBe(total);
      expect(baris).toHaveLength(total);
      expect(baris.map((b) => b.nama_lengkap).sort()).toEqual(["Cocok 18", "Cocok 19", "Cocok 20"]);
    }));

  it("hanya menghitung warga AKTIF yang belum dihapus", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataKasusPrd(tx, d);
      expect(await hitungWarga(d.admin, {}, opsi(tx))).toBe(8);
    }));

  it("OR di dalam satu filter, AND antar filter", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataKasusPrd(tx, d);
      const sdAtauSma = await hitungWarga(d.admin, { pendidikan: [d.m.sd, d.m.sma] }, opsi(tx));
      const sdSaja = await hitungWarga(d.admin, { pendidikan: [d.m.sd] }, opsi(tx));
      const sdDanWira = await hitungWarga(d.admin, { pendidikan: [d.m.sd], pekerjaan: [d.m.wira] }, opsi(tx));
      expect(sdAtauSma).toBe(8);
      expect(sdSaja).toBe(1);
      expect(sdDanWira).toBe(0);
    }));

  it("filter RT memakai kode RT dan tetap di dalam cakupan pengguna", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataKasusPrd(tx, d);
      expect(await hitungWarga(d.admin, { rt: ["002"] }, opsi(tx))).toBe(1);
      expect(await hitungWarga(d.admin, { rt: ["001", "002"] }, opsi(tx))).toBe(8);
      // Ketua RT 001 tidak pernah melihat RT 002, apa pun filternya.
      expect(await hitungWarga(d.ketuaRt1, {}, opsi(tx))).toBe(7);
      expect(await hitungWarga(d.ketuaRt1, { rt: ["002"] }, opsi(tx))).toBe(0);
    }));

  it("pengguna tanpa cakupan tidak mendapat warga", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataKasusPrd(tx, d);
      const tanpaWilayah: PenggunaUji = { role: "KETUA_RT", rw: null, wilayah_id: null, warga_id: null };
      expect(await hitungWarga(tanpaWilayah, {}, opsi(tx))).toBe(0);
    }));
});

describe("kategori usia dari tabel (PRD 6.2)", () => {
  // Terhadap 2026-06-15: nama berisi usia sebenarnya. Dua tanggal per batas: sehari sebelum dan tepat pada ulang tahun.
  const BATAS: [number, string][] = [
    [16, "2009-06-16"], [17, "2009-06-15"], [17, "2008-06-16"], [18, "2008-06-15"], [18, "2007-06-16"],
    [59, "1966-06-16"], [59, "1967-06-15"], [60, "1966-06-15"], [60, "1965-06-16"], [61, "1965-06-15"],
  ];

  async function dataBatas(d: DataUji) {
    for (const [usia, lahir] of BATAS) await d.tambah({ nama: `u${usia} ${lahir}`, jk: "L", lahir });
  }
  const usiaDari = (nama: string[]) => nama.map((n) => Number(/^u(\d+)/.exec(n)?.[1])).sort((a, b) => a - b);

  it("batas usia 17, 18, 59, dan 60 jatuh ke kategori yang benar", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataBatas(d);
      expect(usiaDari(await semuaNama(tx, d.admin, { kategori: [d.kat.remaja] }))).toEqual([16, 17, 17]);
      expect(usiaDari(await semuaNama(tx, d.admin, { kategori: [d.kat.dewasa] }))).toEqual([18, 18, 59, 59]);
      expect(usiaDari(await semuaNama(tx, d.admin, { kategori: [d.kat.lansia] }))).toEqual([60, 60, 61]);
    }));

  it("rentang usia manual memakai batas yang sama", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataBatas(d);
      expect(usiaDari(await semuaNama(tx, d.admin, { usia_min: 17, usia_max: 18 }))).toEqual([17, 17, 18, 18]);
      expect(usiaDari(await semuaNama(tx, d.admin, { usia_min: 60 }))).toEqual([60, 60, 61]);
      expect(usiaDari(await semuaNama(tx, d.admin, { usia_max: 16 }))).toEqual([16]);
    }));

  it("kategori dan rentang manual bekerja bersamaan (AND)", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataBatas(d);
      const f = { kategori: [d.kat.dewasa], usia_min: 59 };
      expect(usiaDari(await semuaNama(tx, d.admin, f))).toEqual([59, 59]);
    }));

  it("kategori yang tumpang tindih digabung tanpa menggandakan warga", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await d.tambah({ nama: "P16", jk: "P", lahir: "2010-01-01" }); // Remaja dan Usia subur
      await d.tambah({ nama: "L16", jk: "L", lahir: "2010-01-01" }); // Remaja saja
      await d.tambah({ nama: "P30", jk: "P", lahir: "1996-01-01" }); // Dewasa dan Usia subur
      await d.tambah({ nama: "L30", jk: "L", lahir: "1996-01-01" }); // Dewasa saja

      expect(await semuaNama(tx, d.admin, { kategori: [d.kat.remaja, d.kat.subur] })).toEqual(["L16", "P16", "P30"]);
      expect(await semuaNama(tx, d.admin, { kategori: [d.kat.subur] })).toEqual(["P16", "P30"]);
      expect(await semuaNama(tx, d.admin, { kategori: [d.kat.dewasa, d.kat.subur] })).toEqual(["L30", "P16", "P30"]);
    }));

  it("kategori yang tidak ada lagi tidak cocok dengan siapa pun", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await d.tambah({ nama: "Warga", jk: "L", lahir: "1990-01-01" });
      const f = { kategori: ["33333333-3333-4333-8333-333333333333"] };
      expect(await hitungWarga(d.admin, f, opsi(tx))).toBe(0);
    }));

  it("29 Februari: usia dihitung sama dengan age() PostgreSQL", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      const kabisat = new Date(Date.UTC(2024, 1, 29));
      await d.tambah({ nama: "u24 2000-02-29", jk: "L", lahir: "2000-02-29" });
      await d.tambah({ nama: "u24 2000-02-28", jk: "L", lahir: "2000-02-28" });
      await d.tambah({ nama: "u24 1999-03-01", jk: "L", lahir: "1999-03-01" });
      await d.tambah({ nama: "u23 2000-03-01", jk: "L", lahir: "2000-03-01" });
      await d.tambah({ nama: "u25 1999-02-28", jk: "L", lahir: "1999-02-28" });
      const dua4 = await daftarWargaTerfilter(d.admin, { usia_min: 24, usia_max: 24 }, { ukuran: 100 }, opsi(tx, kabisat));
      expect(usiaDari(dua4.baris.map((b) => b.nama_lengkap))).toEqual([24, 24, 24]);

      // Tahun biasa: pembanding adalah age() PostgreSQL pada tanggal yang sama.
      for (const hari of [new Date(Date.UTC(2025, 1, 28)), new Date(Date.UTC(2025, 2, 1))]) {
        const tgl = hari.toISOString().slice(0, 10);
        const acuan = await tx.$queryRaw<{ nama_lengkap: string }[]>`
          SELECT w.nama_lengkap FROM warga w JOIN kartu_keluarga k ON k.id = w.kartu_keluarga_id
          JOIN wilayah l ON l.id = k.wilayah_id
          WHERE l.rw = '096' AND date_part('year', age(${tgl}::date, w.tanggal_lahir)) = 25`;
        const hasil = await daftarWargaTerfilter(d.admin, { usia_min: 25, usia_max: 25 }, { ukuran: 100 }, opsi(tx, hari));
        expect(hasil.baris.map((b) => b.nama_lengkap).sort(), tgl).toEqual(acuan.map((r) => r.nama_lengkap).sort());
      }
    }));
});

describe("agregasi Dashboard (FR-DSB-01, 03)", () => {
  async function dataRingkas(tx: Tx, d: DataUji) {
    await d.tambah({ nama: "A", jk: "P", lahir: "2007-03-01", pend: d.m.sma, pek: d.m.bb });
    await d.tambah({ nama: "B", jk: "P", lahir: "2007-03-01", pend: d.m.sma, pek: d.m.bb, rt: d.rt2 });
    await d.tambah({ nama: "C", jk: "L", lahir: "1980-03-01", pend: d.m.sd, pek: d.m.wira });
    await d.tambah({ nama: "D", jk: "L", lahir: "1980-03-01", pend: d.m.sd, pek: d.m.wira, status: "MENINGGAL" });
    void tx;
  }

  it("ringkasan mengembalikan angka seluruh warga dan angka hasil filter", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataRingkas(tx, d);
      const r = await ringkasan(d.admin, { jk: ["P"] }, opsi(tx));
      expect(r.semua).toEqual({ warga: 3, kk: 3, laki: 1, perempuan: 2, rata_anggota: 1 });
      expect(r.terfilter).toEqual({ warga: 2, kk: 2, laki: 0, perempuan: 2, rata_anggota: 1 });
    }));

  it("per pendidikan: dua angka per baris dan filter tidak mengubah angka seluruh warga", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataRingkas(tx, d);
      const baris = await perPendidikan(d.admin, { jk: ["P"] }, opsi(tx));
      expect(baris.find((b) => b.id === d.m.sma)).toMatchObject({ semua: 2, terfilter: 2 });
      expect(baris.find((b) => b.id === d.m.sd)).toMatchObject({ semua: 1, terfilter: 0 });
    }));

  it("per pekerjaan: 10 teratas ditambah Lainnya", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx, "095");
      for (let i = 1; i <= 12; i++) {
        const p = await tx.refPekerjaan.create({ data: { nama: `Uji P${String(i).padStart(2, "0")}` } });
        await d.tambah({ nama: `W${i}`, jk: "L", lahir: "1990-01-01", pek: p.id });
      }
      const baris = await perPekerjaan(d.admin, {}, opsi(tx));
      expect(baris).toHaveLength(11);
      expect(baris.at(-1)).toMatchObject({ id: null, nama: "Lainnya", semua: 2, terfilter: 2 });
      expect(baris.slice(0, 10).every((b) => b.semua === 1)).toBe(true);
    }));

  it("piramida: kelompok 5 tahun x jenis kelamin, jumlah sama dengan total", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      // 2008-06-15 berusia 18 (15–19); 1966-06-15 berusia 60 (60–64); 1966-06-16 berusia 59 (55–59).
      await d.tambah({ nama: "a", jk: "L", lahir: "2008-06-15" });
      await d.tambah({ nama: "b", jk: "P", lahir: "2008-06-15" });
      await d.tambah({ nama: "c", jk: "L", lahir: "1966-06-15" });
      await d.tambah({ nama: "d", jk: "L", lahir: "1966-06-16" });
      await d.tambah({ nama: "e", jk: "P", lahir: "1930-01-01" });
      const baris = await piramida(d.admin, { jk: ["L"] }, opsi(tx));
      const kelompok = (k: string) => baris.find((b) => b.kelompok === k);
      expect(kelompok("15–19")).toMatchObject({ L: { semua: 1, terfilter: 1 }, P: { semua: 1, terfilter: 0 } });
      expect(kelompok("55–59")?.L).toEqual({ semua: 1, terfilter: 1 });
      expect(kelompok("60–64")?.L).toEqual({ semua: 1, terfilter: 1 });
      expect(kelompok("80+")?.P).toEqual({ semua: 1, terfilter: 0 });
      const jumlah = baris.reduce((n, b) => n + b.L.semua + b.P.semua, 0);
      expect(jumlah).toBe(await hitungWarga(d.admin, {}, opsi(tx)));
    }));

  it("per RT: hanya RT dalam cakupan pengguna", () =>
    dalamRollback(async (tx) => {
      const d = await siapkan(tx);
      await dataRingkas(tx, d);
      const admin = await perRt(d.admin, { jk: ["P"] }, opsi(tx));
      expect(admin.filter((b) => b.rw === "096")).toEqual([
        { rw: "096", rt: "001", semua: 2, terfilter: 1 },
        { rw: "096", rt: "002", semua: 1, terfilter: 1 },
      ]);
      const ketua = await perRt(d.ketuaRt1, {}, opsi(tx));
      expect(ketua).toEqual([{ rw: "096", rt: "001", semua: 2, terfilter: 2 }]);
    }));
});
