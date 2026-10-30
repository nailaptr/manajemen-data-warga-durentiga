import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { buildWargaWhere, hariJakarta, type FilterStatistik, type OpsiFilter } from "../filters";
import { scopeWhere } from "../scope";
import { hitungUsia, kondisiCari } from "./warga";

// Agregasi Dashboard (PRD 6, FR-DSB-01 dan 03). Semua fungsi memakai buildWargaWhere, sehingga
// hitungan, daftar, dan grafik selalu memakai kondisi yang sama. `semua` = seluruh warga aktif
// dalam cakupan pengguna tanpa filter; `terfilter` = hasil filter.
type PenggunaScope = Parameters<typeof scopeWhere>[0];
type Filter = Partial<FilterStatistik>;

export interface Angka {
  semua: number;
  terfilter: number;
}

export interface BarisRingkasan {
  warga: number;
  kk: number;
  laki: number;
  perempuan: number;
  rata_anggota: number;
}

export interface BarisKategori {
  id: string | null;
  nama: string;
  semua: number;
  terfilter: number;
}

export interface BarisPiramida {
  kelompok: string;
  L: Angka;
  P: Angka;
}

export interface BarisRt {
  rw: string;
  rt: string;
  semua: number;
  terfilter: number;
}

const TOP_PEKERJAAN = 10;
const KELOMPOK_USIA = 5;
const KELOMPOK_TERAKHIR = 16; // 80 tahun ke atas

async function dua(user: PenggunaScope, f: Filter, opsi: OpsiFilter) {
  const hariIni = opsi.hariIni ?? hariJakarta();
  const o = { ...opsi, hariIni };
  const [semua, terfilter] = await Promise.all([buildWargaWhere({}, user, o), buildWargaWhere(f, user, o)]);
  return { semua, terfilter, hariIni };
}

async function ringkasanDari(where: Prisma.WargaWhereInput, db: NonNullable<OpsiFilter["db"]>): Promise<BarisRingkasan> {
  const [perJk, kk] = await Promise.all([
    db.warga.groupBy({ by: ["jenis_kelamin"], where, _count: { _all: true } }),
    db.kartuKeluarga.count({ where: { warga: { some: where } } }),
  ]);
  const hitung = (jk: "L" | "P") => perJk.find((r) => r.jenis_kelamin === jk)?._count._all ?? 0;
  const laki = hitung("L");
  const perempuan = hitung("P");
  const warga = laki + perempuan;
  return { warga, kk, laki, perempuan, rata_anggota: kk ? Math.round((warga / kk) * 10) / 10 : 0 };
}

export async function ringkasan(
  user: PenggunaScope,
  f: Filter,
  opsi: OpsiFilter = {},
): Promise<{ semua: BarisRingkasan; terfilter: BarisRingkasan }> {
  const db = opsi.db ?? prisma;
  const w = await dua(user, f, opsi);
  const [semua, terfilter] = await Promise.all([ringkasanDari(w.semua, db), ringkasanDari(w.terfilter, db)]);
  return { semua, terfilter };
}

export async function hitungWarga(user: PenggunaScope, f: Filter, opsi: OpsiFilter = {}): Promise<number> {
  const db = opsi.db ?? prisma;
  return db.warga.count({ where: await buildWargaWhere(f, user, opsi) });
}

export interface BarisDaftar {
  id: string;
  nama_lengkap: string;
  nik: string;
  no_kk: string;
  rt: string;
  rw: string;
  usia: number;
  jenis_kelamin: "L" | "P";
  pendidikan: string | null;
  pekerjaan: string | null;
}

export interface KualitasData {
  wargaTanpaPekerjaan: number;
  kkTanpaKepala: number;
  pengajuanMenunggu: number;
}

// Kartu kualitas data (FR-DSB-07, BR-06): selalu seluruh cakupan pengguna, tidak mengikuti filter.
// KK tanpa kepala = masih punya warga aktif, tetapi tidak ada Kepala Keluarga berstatus AKTIF.
export async function kualitasData(user: PenggunaScope, opsi: OpsiFilter = {}): Promise<KualitasData> {
  const db = opsi.db ?? prisma;
  const aktif = await buildWargaWhere({}, user, opsi);
  const kepalaAktif: Prisma.WargaWhereInput = {
    hubungan_keluarga: "KEPALA_KELUARGA",
    status_kependudukan: "AKTIF",
    deleted_at: null,
  };
  const [wargaTanpaPekerjaan, kkTanpaKepala, pengajuanMenunggu] = await Promise.all([
    db.warga.count({ where: { AND: [aktif, { pekerjaan_id: null }] } }),
    db.kartuKeluarga.count({
      where: {
        AND: [
          scopeWhere(user, "kartu_keluarga"),
          { deleted_at: null },
          { warga: { some: { status_kependudukan: "AKTIF", deleted_at: null } } },
          { warga: { none: kepalaAktif } },
        ],
      },
    }),
    db.pengajuan.count({ where: { AND: [scopeWhere(user, "pengajuan"), { status: "MENUNGGU" }] } }),
  ]);
  return { wargaTanpaPekerjaan, kkTanpaKepala, pengajuanMenunggu };
}

// Daftar untuk panel Hasil Filter dan Cari Warga; `total` sama dengan hitungWarga.
export async function daftarWargaTerfilter(
  user: PenggunaScope,
  f: Filter,
  { halaman = 1, ukuran = 50, q }: { halaman?: number; ukuran?: number; q?: string } = {},
  opsi: OpsiFilter = {},
): Promise<{ total: number; baris: BarisDaftar[] }> {
  const db = opsi.db ?? prisma;
  const where = await whereCariWarga(user, f, q, opsi);
  const [total, rows] = await Promise.all([
    db.warga.count({ where }),
    db.warga.findMany({
      where,
      orderBy: [{ nama_lengkap: "asc" }, { id: "asc" }],
      skip: (halaman - 1) * ukuran,
      take: ukuran,
      select: {
        id: true,
        nama_lengkap: true,
        nik: true,
        tanggal_lahir: true,
        jenis_kelamin: true,
        pendidikan: { select: { nama: true } },
        pekerjaan: { select: { nama: true } },
        kartu_keluarga: { select: { no_kk: true, wilayah: { select: { rt: true, rw: true } } } },
      },
    }),
  ]);
  return {
    total,
    baris: rows.map((r) => ({
      id: r.id,
      nama_lengkap: r.nama_lengkap,
      nik: r.nik,
      no_kk: r.kartu_keluarga.no_kk,
      rt: r.kartu_keluarga.wilayah.rt,
      rw: r.kartu_keluarga.wilayah.rw,
      usia: hitungUsia(r.tanggal_lahir, opsi.hariIni ?? hariJakarta()),
      jenis_kelamin: r.jenis_kelamin,
      pendidikan: r.pendidikan?.nama ?? null,
      pekerjaan: r.pekerjaan?.nama ?? null,
    })),
  };
}

// Kondisi Cari Warga = kondisi filter bersama (buildWargaWhere) ditambah pencarian teks bebas.
// Dipakai daftar, jumlah, dan export agar ketiganya selalu sama.
export async function whereCariWarga(
  user: PenggunaScope,
  f: Filter,
  q: string | undefined,
  opsi: OpsiFilter = {},
): Promise<Prisma.WargaWhereInput> {
  const dasar = await buildWargaWhere(f, user, opsi);
  const kata = q?.trim();
  return kata ? { AND: [dasar, kondisiCari(kata)] } : dasar;
}

// RT yang punya KK dalam cakupan pengguna, untuk pilihan filter RT.
export async function daftarRtCakupan(user: PenggunaScope, opsi: OpsiFilter = {}): Promise<{ rw: string; rt: string }[]> {
  const db = opsi.db ?? prisma;
  return db.wilayah.findMany({
    where: { kartu_keluarga: { some: { AND: [scopeWhere(user, "kartu_keluarga"), { deleted_at: null }] } } },
    orderBy: [{ rw: "asc" }, { rt: "asc" }],
    select: { rw: true, rt: true },
  });
}

async function perMaster(
  where: Prisma.WargaWhereInput,
  kolom: "pendidikan_id" | "pekerjaan_id",
  db: NonNullable<OpsiFilter["db"]>,
): Promise<Map<string | null, number>> {
  const baris = await db.warga.groupBy({ by: [kolom], where, _count: { _all: true } });
  return new Map(baris.map((r) => [r[kolom], r._count._all]));
}

export async function perPendidikan(user: PenggunaScope, f: Filter, opsi: OpsiFilter = {}): Promise<BarisKategori[]> {
  const db = opsi.db ?? prisma;
  const w = await dua(user, f, opsi);
  const [master, semua, terfilter] = await Promise.all([
    db.refPendidikan.findMany({ orderBy: { urutan: "asc" } }),
    perMaster(w.semua, "pendidikan_id", db),
    perMaster(w.terfilter, "pendidikan_id", db),
  ]);
  const baris: BarisKategori[] = master.map((m) => ({
    id: m.id,
    nama: m.nama,
    semua: semua.get(m.id) ?? 0,
    terfilter: terfilter.get(m.id) ?? 0,
  }));
  const kosong = { id: null, nama: "Tidak diisi", semua: semua.get(null) ?? 0, terfilter: terfilter.get(null) ?? 0 };
  return kosong.semua > 0 ? [...baris, kosong] : baris;
}

// 10 teratas menurut jumlah seluruh warga (urutan tetap saat filter berubah). Master "Lainnya" dan
// pekerjaan yang belum diisi digabung ke baris "Lainnya" bersama sisanya.
export async function perPekerjaan(user: PenggunaScope, f: Filter, opsi: OpsiFilter = {}): Promise<BarisKategori[]> {
  const db = opsi.db ?? prisma;
  const w = await dua(user, f, opsi);
  const [master, semua, terfilter] = await Promise.all([
    db.refPekerjaan.findMany(),
    perMaster(w.semua, "pekerjaan_id", db),
    perMaster(w.terfilter, "pekerjaan_id", db),
  ]);
  const utama: BarisKategori[] = master
    .filter((m) => m.nama !== "Lainnya")
    .map((m) => ({ id: m.id, nama: m.nama, semua: semua.get(m.id) ?? 0, terfilter: terfilter.get(m.id) ?? 0 }))
    .sort((a, b) => b.semua - a.semua || a.nama.localeCompare(b.nama, "id"));
  const teratas = utama.slice(0, TOP_PEKERJAAN).filter((b) => b.semua > 0 || b.terfilter > 0);
  const lainnya: BarisKategori = {
    id: null,
    nama: "Lainnya",
    semua: Array.from(semua.values()).reduce((a, b) => a + b, 0) - teratas.reduce((a, b) => a + b.semua, 0),
    terfilter: Array.from(terfilter.values()).reduce((a, b) => a + b, 0) - teratas.reduce((a, b) => a + b.terfilter, 0),
  };
  return lainnya.semua > 0 || lainnya.terfilter > 0 ? [...teratas, lainnya] : teratas;
}

function labelKelompok(i: number): string {
  return i >= KELOMPOK_TERAKHIR ? `${KELOMPOK_TERAKHIR * KELOMPOK_USIA}+` : `${i * KELOMPOK_USIA}–${i * KELOMPOK_USIA + KELOMPOK_USIA - 1}`;
}

async function hitungPiramida(
  where: Prisma.WargaWhereInput,
  hariIni: Date,
  db: NonNullable<OpsiFilter["db"]>,
): Promise<number[][]> {
  const baris = await db.warga.groupBy({ by: ["tanggal_lahir", "jenis_kelamin"], where, _count: { _all: true } });
  const hasil = Array.from({ length: KELOMPOK_TERAKHIR + 1 }, () => [0, 0]);
  for (const r of baris) {
    const i = Math.min(Math.floor(Math.max(hitungUsia(r.tanggal_lahir, hariIni), 0) / KELOMPOK_USIA), KELOMPOK_TERAKHIR);
    const kolom = r.jenis_kelamin === "L" ? 0 : 1;
    hasil[i]![kolom]! += r._count._all;
  }
  return hasil;
}

// Kelompok 5 tahun x jenis kelamin; usia dari tanggal_lahir dengan aturan yang sama seperti filter.
export async function piramida(user: PenggunaScope, f: Filter, opsi: OpsiFilter = {}): Promise<BarisPiramida[]> {
  const db = opsi.db ?? prisma;
  const w = await dua(user, f, opsi);
  const [semua, terfilter] = await Promise.all([
    hitungPiramida(w.semua, w.hariIni, db),
    hitungPiramida(w.terfilter, w.hariIni, db),
  ]);
  return semua.map((s, i) => ({
    kelompok: labelKelompok(i),
    L: { semua: s[0]!, terfilter: terfilter[i]![0]! },
    P: { semua: s[1]!, terfilter: terfilter[i]![1]! },
  }));
}

// Hanya RT yang punya warga dalam cakupan pengguna; RT di luar cakupan otomatis berjumlah 0.
export async function perRt(user: PenggunaScope, f: Filter, opsi: OpsiFilter = {}): Promise<BarisRt[]> {
  const db = opsi.db ?? prisma;
  const w = await dua(user, f, opsi);
  const wilayah = await db.wilayah.findMany({ orderBy: [{ rw: "asc" }, { rt: "asc" }] });
  const baris = await Promise.all(
    wilayah.map(async (x) => {
      const rt = { kartu_keluarga: { wilayah_id: x.id } };
      const [semua, terfilter] = await Promise.all([
        db.warga.count({ where: { AND: [w.semua, rt] } }),
        db.warga.count({ where: { AND: [w.terfilter, rt] } }),
      ]);
      return { rw: x.rw, rt: x.rt, semua, terfilter };
    }),
  );
  return baris.filter((b) => b.semua > 0);
}
