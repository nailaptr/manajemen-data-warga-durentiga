import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { catatAktivitas } from "../activity-log";
import type { KategoriUsiaData, PekerjaanData, PendidikanData, WilayahData } from "../validators/pengaturan";

// Master data (pendidikan, pekerjaan, kategori usia, wilayah) bukan data pribadi; log hanya memuat id dan nama master.
type Klien = PrismaClient | Prisma.TransactionClient;

export class GalatPengaturan extends Error {}

function jalankan<T>(db: Klien, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

function bacaAlias(nilai: Prisma.JsonValue): string[] {
  return Array.isArray(nilai) ? nilai.filter((a): a is string => typeof a === "string") : [];
}

function tolakDuplikat<T>(fn: () => Promise<T>, pesan: string): Promise<T> {
  return fn().catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new GalatPengaturan(pesan);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new GalatPengaturan("Data tidak ditemukan. Muat ulang halaman.");
    }
    throw e;
  });
}

export interface BarisReferensi {
  id: string;
  nama: string;
  urutan: number | null;
  alias: string[];
  dipakai: number;
}

export async function daftarPendidikan(db: Klien = prisma): Promise<BarisReferensi[]> {
  const baris = await db.refPendidikan.findMany({
    orderBy: { urutan: "asc" },
    include: { _count: { select: { warga: true } } },
  });
  return baris.map((b) => ({ id: b.id, nama: b.nama, urutan: b.urutan, alias: bacaAlias(b.alias), dipakai: b._count.warga }));
}

export async function daftarPekerjaan(db: Klien = prisma): Promise<BarisReferensi[]> {
  const baris = await db.refPekerjaan.findMany({
    orderBy: { nama: "asc" },
    include: { _count: { select: { warga: true } } },
  });
  return baris.map((b) => ({ id: b.id, nama: b.nama, urutan: null, alias: bacaAlias(b.alias), dipakai: b._count.warga }));
}

export async function simpanPendidikan(user: Pengguna, data: PendidikanData, id?: string, db: Klien = prisma): Promise<string> {
  return tolakDuplikat(
    () =>
      jalankan(db, async (tx) => {
        const hasil = id
          ? await tx.refPendidikan.update({ where: { id }, data })
          : await tx.refPendidikan.create({ data });
        await catatAktivitas(
          { userId: user.id, aksi: id ? "PENDIDIKAN_DIUBAH" : "PENDIDIKAN_DIBUAT", entitas: "ref_pendidikan", entitasId: hasil.id, perubahan: { nama: data.nama } },
          tx,
        );
        return hasil.id;
      }),
    "Nama pendidikan sudah ada",
  );
}

export async function hapusPendidikan(user: Pengguna, id: string, db: Klien = prisma): Promise<void> {
  await jalankan(db, async (tx) => {
    const ada = await tx.refPendidikan.findUnique({ where: { id } });
    if (!ada) throw new GalatPengaturan("Pendidikan tidak ditemukan");
    const dipakai = await tx.warga.count({ where: { pendidikan_id: id } });
    if (dipakai > 0) throw new GalatPengaturan(`Pendidikan masih dipakai ${dipakai} warga`);
    await tx.refPendidikan.delete({ where: { id } });
    await catatAktivitas({ userId: user.id, aksi: "PENDIDIKAN_DIHAPUS", entitas: "ref_pendidikan", entitasId: id, perubahan: { nama: ada.nama } }, tx);
  });
}

export async function simpanPekerjaan(user: Pengguna, data: PekerjaanData, id?: string, db: Klien = prisma): Promise<string> {
  return tolakDuplikat(
    () =>
      jalankan(db, async (tx) => {
        const hasil = id ? await tx.refPekerjaan.update({ where: { id }, data }) : await tx.refPekerjaan.create({ data });
        await catatAktivitas(
          { userId: user.id, aksi: id ? "PEKERJAAN_DIUBAH" : "PEKERJAAN_DIBUAT", entitas: "ref_pekerjaan", entitasId: hasil.id, perubahan: { nama: data.nama } },
          tx,
        );
        return hasil.id;
      }),
    "Nama pekerjaan sudah ada",
  );
}

export async function hapusPekerjaan(user: Pengguna, id: string, db: Klien = prisma): Promise<void> {
  await jalankan(db, async (tx) => {
    const ada = await tx.refPekerjaan.findUnique({ where: { id } });
    if (!ada) throw new GalatPengaturan("Pekerjaan tidak ditemukan");
    const dipakai = await tx.warga.count({ where: { pekerjaan_id: id } });
    if (dipakai > 0) throw new GalatPengaturan(`Pekerjaan masih dipakai ${dipakai} warga`);
    await tx.refPekerjaan.delete({ where: { id } });
    await catatAktivitas({ userId: user.id, aksi: "PEKERJAAN_DIHAPUS", entitas: "ref_pekerjaan", entitasId: id, perubahan: { nama: ada.nama } }, tx);
  });
}

export interface BarisKategoriUsia {
  id: string;
  nama: string;
  usia_min: number;
  usia_maks: number | null;
  jenis_kelamin: "L" | "P" | null;
}

// Satu-satunya sumber kategori usia: filter Dashboard dan Cari Warga membaca tabel ini, bukan konstanta di kode.
export async function daftarKategoriUsia(db: Klien = prisma): Promise<BarisKategoriUsia[]> {
  const baris = await db.kategoriUsia.findMany({ orderBy: { urutan: "asc" } });
  return baris.map(({ id, nama, usia_min, usia_maks, jenis_kelamin }) => ({ id, nama, usia_min, usia_maks, jenis_kelamin }));
}

// Simpan seluruh daftar dalam satu transaksi: baris yang hilang dari daftar dihapus, urutan mengikuti posisi.
export async function simpanKategoriUsia(user: Pengguna, daftar: KategoriUsiaData, db: Klien = prisma): Promise<void> {
  await tolakDuplikat(
    () =>
      jalankan(db, async (tx) => {
        const idDipertahankan = daftar.flatMap((k) => (k.id ? [k.id] : []));
        await tx.kategoriUsia.deleteMany({ where: { id: { notIn: idDipertahankan } } });
        for (const [i, { id, ...k }] of daftar.entries()) {
          const isi = { ...k, urutan: i + 1 };
          if (id) await tx.kategoriUsia.update({ where: { id }, data: isi });
          else await tx.kategoriUsia.create({ data: isi });
        }
        await catatAktivitas(
          { userId: user.id, aksi: "KATEGORI_USIA_DIUBAH", entitas: "kategori_usia", entitasId: "semua", perubahan: { jumlah: daftar.length } },
          tx,
        );
      }),
    "Nama kategori sudah ada",
  );
}

export interface BarisWilayah {
  id: string;
  rw: string;
  rt: string;
  keterangan: string | null;
  jumlahKk: number;
}

function bolehRw(user: Pengguna, rw: string): boolean {
  return user.role === "SUPER_ADMIN" || (user.role === "ADMIN_RW" && !!user.rw && user.rw === rw);
}

// Admin RW hanya mengelola RW-nya sendiri; Super Admin semua RW.
export async function daftarWilayah(user: Pengguna, db: Klien = prisma): Promise<BarisWilayah[]> {
  const where: Prisma.WilayahWhereInput = user.role === "SUPER_ADMIN" ? {} : { rw: user.rw ?? "" };
  const baris = await db.wilayah.findMany({
    where,
    orderBy: [{ rw: "asc" }, { rt: "asc" }],
    include: { _count: { select: { kartu_keluarga: true } } },
  });
  return baris.map((b) => ({ id: b.id, rw: b.rw, rt: b.rt, keterangan: b.keterangan, jumlahKk: b._count.kartu_keluarga }));
}

export async function simpanWilayah(user: Pengguna, data: WilayahData, id?: string, db: Klien = prisma): Promise<string> {
  if (!bolehRw(user, data.rw)) throw new GalatPengaturan("Anda hanya boleh mengelola RW Anda sendiri");
  return tolakDuplikat(
    () =>
      jalankan(db, async (tx) => {
        if (id) {
          const lama = await tx.wilayah.findUnique({ where: { id } });
          if (!lama || !bolehRw(user, lama.rw)) throw new GalatPengaturan("RT/RW tidak ditemukan");
          // RW/RT dirujuk KK dan pengguna lewat id, jadi hanya mengubah nomor tetap konsisten; ganti nomor hanya bila tidak ada KK.
          if ((lama.rw !== data.rw || lama.rt !== data.rt) && (await tx.kartuKeluarga.count({ where: { wilayah_id: id } })) > 0) {
            throw new GalatPengaturan("Nomor RT/RW tidak bisa diubah karena sudah dipakai KK");
          }
        }
        const hasil = id ? await tx.wilayah.update({ where: { id }, data }) : await tx.wilayah.create({ data });
        await catatAktivitas(
          { userId: user.id, aksi: id ? "WILAYAH_DIUBAH" : "WILAYAH_DIBUAT", entitas: "wilayah", entitasId: hasil.id, perubahan: { rw: data.rw, rt: data.rt } },
          tx,
        );
        return hasil.id;
      }),
    "RT/RW tersebut sudah ada",
  );
}

export async function hapusWilayah(user: Pengguna, id: string, db: Klien = prisma): Promise<void> {
  await jalankan(db, async (tx) => {
    const ada = await tx.wilayah.findUnique({ where: { id } });
    if (!ada || !bolehRw(user, ada.rw)) throw new GalatPengaturan("RT/RW tidak ditemukan");
    const [kk, pengguna] = await Promise.all([
      tx.kartuKeluarga.count({ where: { wilayah_id: id } }),
      tx.user.count({ where: { wilayah_id: id } }),
    ]);
    if (kk > 0 || pengguna > 0) throw new GalatPengaturan(`RT/RW masih dipakai ${kk} KK dan ${pengguna} pengguna`);
    await tx.wilayah.delete({ where: { id } });
    await catatAktivitas({ userId: user.id, aksi: "WILAYAH_DIHAPUS", entitas: "wilayah", entitasId: id, perubahan: { rw: ada.rw, rt: ada.rt } }, tx);
  });
}
