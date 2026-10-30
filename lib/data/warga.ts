import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { catatAktivitas } from "../activity-log";
import { hariJakarta } from "../filters";
import { maskNomor } from "../mask";
import { scopeWhere } from "../scope";
import type { WargaData } from "../validators/warga";
import { GalatKk, dataWarga } from "./kk";

// Satu-satunya tempat memanggil prisma.warga untuk modul Data Warga.
type Klien = PrismaClient | Prisma.TransactionClient;

export interface FilterWarga {
  q?: string;
  status?: "AKTIF" | "PINDAH" | "MENINGGAL";
  halaman: number;
  ukuran: number;
}

export interface BarisWarga {
  id: string;
  kartu_keluarga_id: string;
  nama_lengkap: string;
  nik: string;
  no_kk: string;
  jenis_kelamin: "L" | "P";
  usia: number;
  rt: string;
  rw: string;
  status: "AKTIF" | "PINDAH" | "MENINGGAL";
}

// Pencarian nama, NIK, atau No KK; dipakai Data Warga dan Cari Warga.
export function kondisiCari(q: string): Prisma.WargaWhereInput {
  return {
    OR: [
      { nama_lengkap: { contains: q, mode: "insensitive" } },
      { nik: { contains: q } },
      { kartu_keluarga: { no_kk: { contains: q } } },
    ],
  };
}

function whereWarga(user: Pengguna, f: Pick<FilterWarga, "q" | "status">): Prisma.WargaWhereInput {
  const q = f.q?.trim();
  const sama: Prisma.WargaWhereInput[] = [
    scopeWhere(user, "warga"),
    { deleted_at: null, kartu_keluarga: { deleted_at: null } },
  ];
  if (f.status) sama.push({ status_kependudukan: f.status });
  if (q) sama.push(kondisiCari(q));
  return { AND: sama };
}

export interface DetailWarga {
  id: string;
  nama_lengkap: string;
  nik_masked: string;
  no_kk_masked: string;
  jenis_kelamin: "L" | "P";
  tempat_lahir: string | null;
  tanggal_lahir: string;
  usia: number;
  agama: string | null;
  golongan_darah: string | null;
  hubungan_keluarga: string;
  status_perkawinan: string | null;
  status_kependudukan: string;
  pendidikan: string | null;
  pekerjaan: string | null;
  alamat: string;
  rt: string;
  rw: string;
  kartu_keluarga_id: string;
}

const sertaDetail = {
  kartu_keluarga: { select: { id: true, no_kk: true, alamat: true, wilayah: { select: { rt: true, rw: true } } } },
  pendidikan: { select: { nama: true } },
  pekerjaan: { select: { nama: true } },
} satisfies Prisma.WargaInclude;

// Detail untuk drawer Cari Warga: NIK dan No KK tetap dimasking (AC-07).
export async function detailWarga(user: Pengguna, id: string, db: Klien = prisma): Promise<DetailWarga | null> {
  const w = await db.warga.findFirst({
    where: { AND: [scopeWhere(user, "warga"), { id, deleted_at: null, kartu_keluarga: { deleted_at: null } }] },
    include: sertaDetail,
  });
  if (!w) return null;
  return {
    id: w.id,
    nama_lengkap: w.nama_lengkap,
    nik_masked: maskNomor(w.nik),
    no_kk_masked: maskNomor(w.kartu_keluarga.no_kk),
    jenis_kelamin: w.jenis_kelamin,
    tempat_lahir: w.tempat_lahir,
    tanggal_lahir: w.tanggal_lahir.toISOString().slice(0, 10),
    usia: hitungUsia(w.tanggal_lahir, hariJakarta()),
    agama: w.agama,
    golongan_darah: w.golongan_darah,
    hubungan_keluarga: w.hubungan_keluarga,
    status_perkawinan: w.status_perkawinan,
    status_kependudukan: w.status_kependudukan,
    pendidikan: w.pendidikan?.nama ?? null,
    pekerjaan: w.pekerjaan?.nama ?? null,
    alamat: w.kartu_keluarga.alamat,
    rt: w.kartu_keluarga.wilayah.rt,
    rw: w.kartu_keluarga.wilayah.rw,
    kartu_keluarga_id: w.kartu_keluarga.id,
  };
}

// Membuka NIK dan No KK penuh: hanya dalam cakupan pengguna, dan setiap pembukaan dicatat (AC-07, FR-LOG-01).
// Log hanya memuat id warga, tidak memuat nomornya.
export async function nomorLengkap(
  user: Pengguna,
  id: string,
  db: Klien = prisma,
): Promise<{ nik: string; no_kk: string } | null> {
  return jalankan(db, async (tx) => {
    const w = await tx.warga.findFirst({
      where: { AND: [scopeWhere(user, "warga"), { id, deleted_at: null, kartu_keluarga: { deleted_at: null } }] },
      select: { id: true, nik: true, kartu_keluarga: { select: { no_kk: true } } },
    });
    if (!w) return null;
    await catatAktivitas({ userId: user.id, aksi: "NIK_DITAMPILKAN", entitas: "warga", entitasId: w.id }, tx);
    return { nik: w.nik, no_kk: w.kartu_keluarga.no_kk };
  });
}

// Usia dihitung dari tanggal_lahir (tidak disimpan), memakai tanggal UTC karena kolomnya @db.Date.
export function hitungUsia(lahir: Date, hariIni: Date = new Date()): number {
  let usia = hariIni.getUTCFullYear() - lahir.getUTCFullYear();
  const belumUlangTahun =
    hariIni.getUTCMonth() < lahir.getUTCMonth() ||
    (hariIni.getUTCMonth() === lahir.getUTCMonth() && hariIni.getUTCDate() < lahir.getUTCDate());
  if (belumUlangTahun) usia -= 1;
  return usia;
}

export async function daftarWarga(user: Pengguna, f: FilterWarga, db: Klien = prisma) {
  const where = whereWarga(user, f);
  const [total, rows] = await Promise.all([
    db.warga.count({ where }),
    db.warga.findMany({
      where,
      orderBy: [{ nama_lengkap: "asc" }, { id: "asc" }],
      skip: (f.halaman - 1) * f.ukuran,
      take: f.ukuran,
      include: { kartu_keluarga: { select: { id: true, no_kk: true, wilayah: { select: { rt: true, rw: true } } } } },
    }),
  ]);
  const baris: BarisWarga[] = rows.map((w) => ({
    id: w.id,
    kartu_keluarga_id: w.kartu_keluarga.id,
    nama_lengkap: w.nama_lengkap,
    nik: w.nik,
    no_kk: w.kartu_keluarga.no_kk,
    jenis_kelamin: w.jenis_kelamin,
    usia: hitungUsia(w.tanggal_lahir),
    rt: w.kartu_keluarga.wilayah.rt,
    rw: w.kartu_keluarga.wilayah.rw,
    status: w.status_kependudukan,
  }));
  return { baris, total };
}

export async function ambilWarga(user: Pengguna, id: string, db: Klien = prisma) {
  return db.warga.findFirst({
    where: { AND: [scopeWhere(user, "warga"), { id, deleted_at: null }] },
  });
}

export interface OpsiKk {
  id: string;
  no_kk: string;
  kepala_keluarga: string | null;
}

// Pencarian combobox KK: hanya KK dalam cakupan pengguna, maksimal 20 hasil.
export async function cariKk(user: Pengguna, q: string, db: Klien = prisma): Promise<OpsiKk[]> {
  const kata = q.trim();
  const kepala = { hubungan_keluarga: "KEPALA_KELUARGA", status_kependudukan: "AKTIF", deleted_at: null } as const;
  const sama: Prisma.KartuKeluargaWhereInput[] = [scopeWhere(user, "kartu_keluarga"), { deleted_at: null }];
  if (kata) {
    sama.push({
      OR: [
        { no_kk: { contains: kata } },
        { warga: { some: { ...kepala, nama_lengkap: { contains: kata, mode: "insensitive" } } } },
      ],
    });
  }
  const kk = await db.kartuKeluarga.findMany({
    where: { AND: sama },
    orderBy: { created_at: "desc" },
    take: 20,
    select: { id: true, no_kk: true, warga: { where: kepala, select: { nama_lengkap: true }, take: 1 } },
  });
  return kk.map((k) => ({ id: k.id, no_kk: k.no_kk, kepala_keluarga: k.warga[0]?.nama_lengkap ?? null }));
}

export async function ambilOpsiKk(user: Pengguna, id: string, db: Klien = prisma): Promise<OpsiKk | null> {
  const k = await db.kartuKeluarga.findFirst({
    where: { AND: [scopeWhere(user, "kartu_keluarga"), { id, deleted_at: null }] },
    select: {
      id: true,
      no_kk: true,
      warga: { where: { hubungan_keluarga: "KEPALA_KELUARGA", status_kependudukan: "AKTIF", deleted_at: null }, select: { nama_lengkap: true }, take: 1 },
    },
  });
  return k && { id: k.id, no_kk: k.no_kk, kepala_keluarga: k.warga[0]?.nama_lengkap ?? null };
}

function jalankan<T>(db: Klien, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

export async function simpanWarga(user: Pengguna, data: WargaData, id?: string, db: Klien = prisma): Promise<string> {
  try {
    return await jalankan(db, async (tx) => {
      const kk = await tx.kartuKeluarga.findFirst({
        where: { AND: [scopeWhere(user, "kartu_keluarga"), { id: data.kartu_keluarga_id, deleted_at: null }] },
        select: { id: true },
      });
      if (!kk) throw new GalatKk("Kartu Keluarga tidak ditemukan");

      const lama = id ? await tx.warga.findFirst({ where: { AND: [scopeWhere(user, "warga"), { id, deleted_at: null }] } }) : null;
      if (id && !lama) throw new GalatKk("Warga tidak ditemukan");

      if (data.hubungan_keluarga === "KEPALA_KELUARGA") {
        const kepalaLain = await tx.warga.count({
          where: { kartu_keluarga_id: kk.id, hubungan_keluarga: "KEPALA_KELUARGA", deleted_at: null, ...(id ? { id: { not: id } } : {}) },
        });
        if (kepalaLain > 0) {
          throw new GalatKk("KK ini sudah punya Kepala Keluarga (termasuk yang berstatus Pindah/Meninggal); ubah hubungannya dulu");
        }
      }

      const kolom = {
        ...dataWarga(data),
        kartu_keluarga_id: kk.id,
        status_kependudukan: data.status_kependudukan,
        tanggal_status: data.tanggal_status ? new Date(`${data.tanggal_status}T00:00:00Z`) : null,
      };
      const wargaId = lama
        ? (await tx.warga.update({ where: { id: lama.id }, data: kolom })).id
        : (await tx.warga.create({ data: kolom })).id;

      // Log hanya berisi id dan perubahan status, tanpa NIK, nama, atau tanggal lahir.
      const statusBerubah = lama && lama.status_kependudukan !== data.status_kependudukan;
      await catatAktivitas(
        {
          userId: user.id,
          aksi: !lama ? "WARGA_DIBUAT" : statusBerubah ? "WARGA_STATUS_DIUBAH" : "WARGA_DIUBAH",
          entitas: "warga",
          entitasId: wargaId,
          perubahan: statusBerubah ? { dari: lama.status_kependudukan, ke: data.status_kependudukan } : undefined,
        },
        tx,
      );
      return wargaId;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new GalatKk("NIK sudah terdaftar");
    }
    throw e;
  }
}
