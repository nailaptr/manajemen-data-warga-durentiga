import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { catatAktivitas } from "../activity-log";
import { scopeWhere } from "../scope";
import type { KkData } from "../validators/kk";

// Satu-satunya tempat memanggil prisma.kartuKeluarga / prisma.warga untuk modul KK.
type Klien = PrismaClient | Prisma.TransactionClient;

export class GalatKk extends Error {}

const AKTIF = { status_kependudukan: "AKTIF", deleted_at: null } as const;
const KEPALA_AKTIF = { hubungan_keluarga: "KEPALA_KELUARGA", ...AKTIF } as const;

function bolehDiWilayah(user: Pengguna, w: { id: string; rw: string }): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "ADMIN_RW") return !!user.rw && user.rw === w.rw;
  if (user.role === "KETUA_RT") return !!user.wilayah_id && user.wilayah_id === w.id;
  return false;
}

export interface FilterKk {
  q?: string;
  rt?: string;
  halaman: number;
  ukuran: number;
}

function whereKk(user: Pengguna, f: Pick<FilterKk, "q" | "rt">): Prisma.KartuKeluargaWhereInput {
  const q = f.q?.trim();
  const sama: Prisma.KartuKeluargaWhereInput[] = [scopeWhere(user, "kartu_keluarga"), { deleted_at: null }];
  if (f.rt) sama.push({ wilayah: { rt: f.rt } });
  if (q) {
    sama.push({
      OR: [
        { no_kk: { contains: q } },
        { alamat: { contains: q, mode: "insensitive" } },
        { warga: { some: { ...KEPALA_AKTIF, nama_lengkap: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  return { AND: sama };
}

export interface BarisKk {
  id: string;
  no_kk: string;
  kepala_keluarga: string | null;
  alamat: string;
  rt: string;
  rw: string;
  jumlah_anggota: number;
}

// Dua tahap: Prisma + scopeWhere menentukan id dan halaman, lalu view v_kk_ringkasan
// mengisi kepala keluarga dan jumlah anggota (scopeWhere tidak bisa dipakai di SQL mentah).
export async function daftarKk(user: Pengguna, f: FilterKk, db: Klien = prisma) {
  const where = whereKk(user, f);
  const [total, kk] = await Promise.all([
    db.kartuKeluarga.count({ where }),
    db.kartuKeluarga.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: (f.halaman - 1) * f.ukuran,
      take: f.ukuran,
      select: { id: true, no_kk: true, alamat: true, wilayah: { select: { rt: true, rw: true } } },
    }),
  ]);
  const ids = kk.map((k) => k.id);
  const ringkasan = ids.length
    ? await db.$queryRaw<{ kartu_keluarga_id: string; kepala_keluarga: string | null; jumlah_anggota: number }[]>(
        Prisma.sql`SELECT kartu_keluarga_id, kepala_keluarga, jumlah_anggota FROM v_kk_ringkasan WHERE kartu_keluarga_id = ANY(${ids}::uuid[])`,
      )
    : [];
  const peta = new Map(ringkasan.map((r) => [r.kartu_keluarga_id, r]));
  const baris: BarisKk[] = kk.map((k) => ({
    id: k.id,
    no_kk: k.no_kk,
    kepala_keluarga: peta.get(k.id)?.kepala_keluarga ?? null,
    alamat: k.alamat,
    rt: k.wilayah.rt,
    rw: k.wilayah.rw,
    jumlah_anggota: peta.get(k.id)?.jumlah_anggota ?? 0,
  }));
  return { baris, total };
}

export async function statistikKk(user: Pengguna, db: Klien = prisma) {
  const kkScope: Prisma.KartuKeluargaWhereInput = { AND: [scopeWhere(user, "kartu_keluarga"), { deleted_at: null }] };
  const [totalKk, anggotaAktif, tanpaKepala] = await Promise.all([
    db.kartuKeluarga.count({ where: kkScope }),
    db.warga.count({ where: { AND: [scopeWhere(user, "warga"), AKTIF, { kartu_keluarga: { deleted_at: null } }] } }),
    db.kartuKeluarga.count({ where: { AND: [kkScope, { warga: { none: KEPALA_AKTIF } }] } }),
  ]);
  return { totalKk, anggotaAktif, tanpaKepala };
}

export async function daftarRt(user: Pengguna, db: Klien = prisma) {
  const w = await db.wilayah.findMany({ orderBy: [{ rw: "asc" }, { rt: "asc" }] });
  return w.filter((x) => bolehDiWilayah(user, x)).map((x) => ({ id: x.id, rw: x.rw, rt: x.rt }));
}

export async function opsiMaster(db: Klien = prisma) {
  const [pendidikan, pekerjaan] = await Promise.all([
    db.refPendidikan.findMany({ orderBy: { urutan: "asc" }, select: { id: true, nama: true } }),
    db.refPekerjaan.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);
  return { pendidikan, pekerjaan };
}

export async function ambilKk(user: Pengguna, id: string, db: Klien = prisma) {
  return db.kartuKeluarga.findFirst({
    where: { AND: [scopeWhere(user, "kartu_keluarga"), { id, deleted_at: null }] },
    include: {
      wilayah: true,
      warga: {
        where: { deleted_at: null },
        orderBy: [{ tanggal_lahir: "asc" }],
        include: { pendidikan: true, pekerjaan: true },
      },
    },
  });
}

function dataWarga(a: KkData["anggota"][number]) {
  return {
    nik: a.nik,
    nama_lengkap: a.nama_lengkap,
    jenis_kelamin: a.jenis_kelamin,
    tempat_lahir: a.tempat_lahir,
    tanggal_lahir: new Date(`${a.tanggal_lahir}T00:00:00Z`),
    agama: a.agama,
    pendidikan_id: a.pendidikan_id,
    pekerjaan_id: a.pekerjaan_id,
    golongan_darah: a.golongan_darah ?? null,
    hubungan_keluarga: a.hubungan_keluarga,
    status_perkawinan: a.status_perkawinan ?? null,
  };
}

function jalankan<T>(db: Klien, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

async function simpanDalamTx(tx: Prisma.TransactionClient, user: Pengguna, data: KkData, id?: string) {
  const wilayah = await tx.wilayah.findUnique({ where: { rw_rt: { rw: data.rw, rt: data.rt } } });
  if (!wilayah || !bolehDiWilayah(user, wilayah)) throw new GalatKk("RT/RW tidak ada atau di luar cakupan Anda");

  const kolom = {
    no_kk: data.no_kk,
    alamat: data.alamat,
    wilayah_id: wilayah.id,
    desa_kelurahan: data.desa_kelurahan,
    kecamatan: data.kecamatan,
    kabupaten_kota: data.kabupaten_kota,
    provinsi: data.provinsi ?? null,
    kode_pos: data.kode_pos ?? null,
  };

  if (!id) {
    const kk = await tx.kartuKeluarga.create({ data: { ...kolom, created_by: user.id } });
    for (const a of data.anggota) await tx.warga.create({ data: { ...dataWarga(a), kartu_keluarga_id: kk.id } });
    await catatAktivitas({ userId: user.id, aksi: "KK_DIBUAT", entitas: "kartu_keluarga", entitasId: kk.id, perubahan: { anggota: data.anggota.length } }, tx);
    return kk.id;
  }

  const ada = await tx.kartuKeluarga.findFirst({ where: { AND: [scopeWhere(user, "kartu_keluarga"), { id, deleted_at: null }] } });
  if (!ada) throw new GalatKk("KK tidak ditemukan");
  await tx.kartuKeluarga.update({ where: { id }, data: kolom });

  const lama = await tx.warga.findMany({ where: { kartu_keluarga_id: id, deleted_at: null }, select: { id: true } });
  const idBaru = new Set(data.anggota.flatMap((a) => (a.id ? [a.id] : [])));
  if ([...idBaru].some((x) => !lama.some((l) => l.id === x))) throw new GalatKk("Anggota tidak ditemukan di KK ini");
  const hapus = lama.filter((l) => !idBaru.has(l.id)).map((l) => l.id);
  if (hapus.length) await tx.warga.updateMany({ where: { id: { in: hapus } }, data: { deleted_at: new Date() } });

  // Kepala keluarga diproses terakhir agar partial unique index one_head_per_kk tidak bentrok saat kepala diganti.
  const urut = [...data.anggota].sort(
    (x, y) => Number(x.hubungan_keluarga === "KEPALA_KELUARGA") - Number(y.hubungan_keluarga === "KEPALA_KELUARGA"),
  );
  for (const a of urut) {
    if (a.id) await tx.warga.update({ where: { id: a.id }, data: dataWarga(a) });
  }
  for (const a of urut) {
    if (!a.id) await tx.warga.create({ data: { ...dataWarga(a), kartu_keluarga_id: id } });
  }
  await catatAktivitas({ userId: user.id, aksi: "KK_DIUBAH", entitas: "kartu_keluarga", entitasId: id, perubahan: { anggota: data.anggota.length, dihapus: hapus.length } }, tx);
  return id;
}

// KK dan semua anggota dalam satu transaksi: satu anggota gagal, tidak ada yang tersimpan.
export async function simpanKk(user: Pengguna, data: KkData, id?: string, db: Klien = prisma): Promise<string> {
  try {
    return await jalankan(db, (tx) => simpanDalamTx(tx, user, data, id));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new GalatKk("No KK atau NIK sudah terdaftar");
    }
    throw e;
  }
}

export async function hapusKk(user: Pengguna, id: string, db: Klien = prisma): Promise<void> {
  await jalankan(db, async (tx) => {
    const kk = await tx.kartuKeluarga.findFirst({ where: { AND: [scopeWhere(user, "kartu_keluarga"), { id, deleted_at: null }] } });
    if (!kk) throw new GalatKk("KK tidak ditemukan");
    const aktif = await tx.warga.count({ where: { kartu_keluarga_id: id, ...AKTIF } });
    if (aktif > 0) throw new GalatKk("KK masih punya anggota aktif; pindahkan atau hapus anggotanya dulu");
    await tx.kartuKeluarga.update({ where: { id }, data: { deleted_at: new Date() } });
    await catatAktivitas({ userId: user.id, aksi: "KK_DIHAPUS", entitas: "kartu_keluarga", entitasId: id }, tx);
  });
}
