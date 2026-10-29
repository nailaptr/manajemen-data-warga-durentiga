import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { catatAktivitas } from "../activity-log";
import type { BarisImpor, GagalImpor, HasilBatch, MulaiImpor, RingkasanImpor } from "../validators/impor";

// Satu-satunya tempat menulis hasil import (PRD 7.5). Pemanggil (Route Handler) sudah memastikan peran ADMIN.
// Log aktivitas dan import_batches.errors hanya memuat nomor baris, alasan, dan jumlah: tidak pernah NIK, No KK, atau tanggal lahir.
type Klien = PrismaClient | Prisma.TransactionClient;

export class GalatBatch extends Error {}

const STATUS_BERJALAN = "BERJALAN";
const PESAN_BATCH_BATAL = "Batch dibatalkan karena kesalahan di server; tidak ada data dari batch ini yang tersimpan";

function jalankan<T>(db: Klien, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

interface IsiGalat {
  gagal: GagalImpor[];
  dilewati: number;
}

function bacaGalat(nilai: Prisma.JsonValue | null): IsiGalat {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) return { gagal: [], dilewati: 0 };
  const gagal = Array.isArray(nilai.gagal)
    ? nilai.gagal.flatMap((g) =>
        g && typeof g === "object" && !Array.isArray(g) && typeof g.nomor === "number" && typeof g.pesan === "string"
          ? [{ nomor: g.nomor, pesan: g.pesan }]
          : [],
      )
    : [];
  return { gagal, dilewati: typeof nilai.dilewati === "number" ? nilai.dilewati : 0 };
}

function bolehRw(user: Pengguna, rw: string): boolean {
  return user.role === "SUPER_ADMIN" || (user.role === "ADMIN_RW" && !!user.rw && user.rw === rw);
}

const ukuranKodePos = /^\d{5}$/;
const atauNull = (teks: string) => (teks === "" ? null : teks);

// Mapping import terakhir yang selesai, dipakai wizard sebagai pemetaan tersimpan (PRD 7.1 langkah 2).
export async function mappingTerakhir(db: Klien = prisma): Promise<Record<string, string> | null> {
  const batch = await db.importBatch.findFirst({
    where: { status: "SELESAI", mapping: { not: Prisma.AnyNull } },
    orderBy: { created_at: "desc" },
    select: { mapping: true },
  });
  const m = batch?.mapping;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const hasil: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) if (typeof v === "string") hasil[k] = v;
  return hasil;
}

async function tambahAlias(tx: Prisma.TransactionClient, alias: MulaiImpor["alias"]): Promise<number> {
  let ditambah = 0;
  for (const a of alias) {
    const ref = a.jenis === "pendidikan"
      ? await tx.refPendidikan.findUnique({ where: { id: a.id }, select: { nama: true, alias: true } })
      : await tx.refPekerjaan.findUnique({ where: { id: a.id }, select: { nama: true, alias: true } });
    if (!ref) continue;
    const lama = Array.isArray(ref.alias) ? ref.alias.filter((x): x is string => typeof x === "string") : [];
    const sama = (x: string) => x.trim().toLowerCase() === a.teks.toLowerCase();
    if (sama(ref.nama) || lama.some(sama)) continue;
    const data = { alias: [...lama, a.teks] };
    if (a.jenis === "pendidikan") await tx.refPendidikan.update({ where: { id: a.id }, data });
    else await tx.refPekerjaan.update({ where: { id: a.id }, data });
    ditambah += 1;
  }
  return ditambah;
}

export async function mulaiImpor(user: Pengguna, data: MulaiImpor, db: Klien = prisma): Promise<string> {
  return jalankan(db, async (tx) => {
    const isi: IsiGalat = { gagal: data.gagal_klien, dilewati: 0 };
    const batch = await tx.importBatch.create({
      data: {
        user_id: user.id,
        nama_file: data.nama_file,
        status: STATUS_BERJALAN,
        total_baris: data.total_baris,
        baris_gagal: data.gagal_klien.length,
        mapping: data.mapping,
        errors: isi as unknown as Prisma.InputJsonValue,
      },
    });
    const aliasDitambah = await tambahAlias(tx, data.alias);
    await catatAktivitas(
      { userId: user.id, aksi: "IMPORT_MULAI", entitas: "import_batches", entitasId: batch.id, perubahan: { total_baris: data.total_baris, alias_ditambah: aliasDitambah } },
      tx,
    );
    return batch.id;
  });
}

interface Konteks {
  tx: Prisma.TransactionClient;
  user: Pengguna;
  mode: "lewati" | "perbarui";
  hasil: HasilBatch;
  wilayah: Map<string, string | null>;
}

// Wilayah (RW/RT) untuk KK baru; dibuat bila belum ada (peringatan PRD 7.4, baris tetap diimpor). null = di luar cakupan.
async function idWilayah(k: Konteks, rw: string, rt: string): Promise<string | null> {
  const kunci = `${rw}/${rt}`;
  const ada = k.wilayah.get(kunci);
  if (ada !== undefined) return ada;
  let id: string | null = null;
  if (bolehRw(k.user, rw)) {
    const w = await k.tx.wilayah.findUnique({ where: { rw_rt: { rw, rt } }, select: { id: true } });
    id = w?.id ?? (await k.tx.wilayah.create({ data: { rw, rt }, select: { id: true } })).id;
  }
  k.wilayah.set(kunci, id);
  return id;
}

const gagalSemua = (k: Konteks, baris: BarisImpor[], pesan: string) => {
  for (const b of baris) k.hasil.gagal.push({ nomor: b.nomor, pesan });
};

function dataWarga(b: BarisImpor) {
  return {
    nama_lengkap: b.nama_lengkap,
    jenis_kelamin: b.jenis_kelamin,
    tanggal_lahir: new Date(`${b.tanggal_lahir}T00:00:00Z`),
    hubungan_keluarga: b.hubungan_keluarga,
  };
}

// Kolom opsional yang kosong di file tidak menghapus nilai yang sudah ada saat "perbarui".
function kolomOpsional(b: BarisImpor) {
  return {
    ...(b.tempat_lahir ? { tempat_lahir: b.tempat_lahir } : {}),
    ...(b.agama ? { agama: b.agama } : {}),
    ...(b.pendidikan_id ? { pendidikan_id: b.pendidikan_id } : {}),
    ...(b.pekerjaan_id ? { pekerjaan_id: b.pekerjaan_id } : {}),
    ...(b.golongan_darah ? { golongan_darah: b.golongan_darah } : {}),
    ...(b.status_perkawinan ? { status_perkawinan: b.status_perkawinan } : {}),
  };
}

// Mengembalikan KK untuk satu kelompok baris; null bila seluruh kelompok ditolak (sudah dicatat sebagai gagal).
async function siapkanKk(k: Konteks, baris: BarisImpor[]) {
  const pertama = baris[0];
  if (!pertama) return null;
  const kk = await k.tx.kartuKeluarga.findUnique({
    where: { no_kk: pertama.no_kk },
    select: { id: true, deleted_at: true, wilayah: { select: { rw: true } } },
  });
  if (kk) {
    if (kk.deleted_at) return void gagalSemua(k, baris, "KK ini sudah dihapus; pulihkan atau pakai No KK lain");
    if (!bolehRw(k.user, kk.wilayah.rw)) return void gagalSemua(k, baris, "KK berada di luar RW Anda");
    return { id: kk.id, baru: false };
  }
  const wilayahId = await idWilayah(k, pertama.rw, pertama.rt);
  if (!wilayahId) return void gagalSemua(k, baris, `RW ${pertama.rw} di luar cakupan Anda`);
  const baru = await k.tx.kartuKeluarga.create({
    data: {
      no_kk: pertama.no_kk,
      alamat: pertama.alamat || "-",
      wilayah_id: wilayahId,
      desa_kelurahan: atauNull(pertama.desa_kelurahan),
      kecamatan: atauNull(pertama.kecamatan),
      kabupaten_kota: atauNull(pertama.kabupaten_kota),
      provinsi: atauNull(pertama.provinsi),
      kode_pos: ukuranKodePos.test(pertama.kode_pos) ? pertama.kode_pos : null,
      created_by: k.user.id,
    },
    select: { id: true },
  });
  return { id: baru.id, baru: true };
}

async function prosesAnggota(k: Konteks, kkId: string, baruDibuat: boolean, baris: BarisImpor[]) {
  const kepala = baruDibuat
    ? null
    : await k.tx.warga.findFirst({
        where: { kartu_keluarga_id: kkId, hubungan_keluarga: "KEPALA_KELUARGA", status_kependudukan: "AKTIF", deleted_at: null },
        select: { nik: true },
      });
  let nikKepala = kepala?.nik ?? null;
  // Kepala Keluarga diproses terakhir agar penggantian kepala tidak bentrok dengan one_head_per_kk.
  const urut = [...baris].sort((a, b) => Number(a.hubungan_keluarga === "KEPALA_KELUARGA") - Number(b.hubungan_keluarga === "KEPALA_KELUARGA"));

  for (const b of urut) {
    const kepalaBaris = b.hubungan_keluarga === "KEPALA_KELUARGA";
    const ada = await k.tx.warga.findUnique({
      where: { nik: b.nik },
      select: { id: true, kartu_keluarga_id: true, kartu_keluarga: { select: { wilayah: { select: { rw: true } } } } },
    });

    if (ada) {
      if (!bolehRw(k.user, ada.kartu_keluarga.wilayah.rw)) {
        k.hasil.gagal.push({ nomor: b.nomor, pesan: "NIK sudah terdaftar di luar RW Anda" });
        continue;
      }
      if (k.mode === "lewati") {
        k.hasil.dilewati += 1;
        continue;
      }
      const diKkIni = ada.kartu_keluarga_id === kkId;
      if (diKkIni && kepalaBaris && nikKepala && nikKepala !== b.nik) {
        k.hasil.gagal.push({ nomor: b.nomor, pesan: "KK ini sudah punya Kepala Keluarga lain" });
        continue;
      }
      const { hubungan_keluarga, ...tanpaHubungan } = dataWarga(b);
      // Warga yang sudah ada di KK lain tidak dipindah dan hubungannya tidak diubah.
      await k.tx.warga.update({ where: { id: ada.id }, data: { ...(diKkIni ? { hubungan_keluarga } : {}), ...tanpaHubungan, ...kolomOpsional(b) } });
      if (diKkIni) {
        if (kepalaBaris) nikKepala = b.nik;
        else if (nikKepala === b.nik) nikKepala = null;
      }
      k.hasil.berhasil += 1;
      continue;
    }

    if (kepalaBaris && nikKepala) {
      k.hasil.gagal.push({ nomor: b.nomor, pesan: "KK ini sudah punya Kepala Keluarga lain" });
      continue;
    }
    await k.tx.warga.create({ data: { nik: b.nik, kartu_keluarga_id: kkId, ...dataWarga(b), ...kolomOpsional(b) } });
    if (kepalaBaris) nikKepala = b.nik;
    k.hasil.berhasil += 1;
  }
}

async function ambilBatch(user: Pengguna, id: string, db: Klien) {
  const batch = await db.importBatch.findFirst({ where: { id, user_id: user.id, status: STATUS_BERJALAN } });
  if (!batch) throw new GalatBatch("Import tidak ditemukan atau sudah selesai");
  return batch;
}

async function catatHasil(tx: Prisma.TransactionClient, id: string, lama: Prisma.JsonValue | null, hasil: HasilBatch) {
  const isi = bacaGalat(lama);
  const baru: IsiGalat = { gagal: [...isi.gagal, ...hasil.gagal], dilewati: isi.dilewati + hasil.dilewati };
  await tx.importBatch.update({
    where: { id },
    data: {
      baris_berhasil: { increment: hasil.berhasil },
      baris_gagal: { increment: hasil.gagal.length },
      errors: baru as unknown as Prisma.InputJsonValue,
    },
  });
}

// Satu batch = satu transaksi. Kegagalan baris karena aturan bisnis hanya melewati baris itu; kesalahan tak terduga
// (database, bentrok) membatalkan seluruh batch sehingga tidak ada data setengah jadi.
export async function prosesBatch(user: Pengguna, id: string, mode: "lewati" | "perbarui", baris: BarisImpor[], db: Klien = prisma): Promise<HasilBatch> {
  const batch = await ambilBatch(user, id, db);
  try {
    return await jalankan(db, async (tx) => {
      const k: Konteks = { tx, user, mode, hasil: { berhasil: 0, dilewati: 0, gagal: [] }, wilayah: new Map() };
      const perKk = new Map<string, BarisImpor[]>();
      for (const b of baris) perKk.set(b.no_kk, [...(perKk.get(b.no_kk) ?? []), b]);
      for (const kelompok of perKk.values()) {
        const kk = await siapkanKk(k, kelompok);
        if (kk) await prosesAnggota(k, kk.id, kk.baru, kelompok);
      }
      await catatHasil(tx, id, batch.errors, k.hasil);
      return k.hasil;
    });
  } catch (e) {
    if (e instanceof GalatBatch) throw e;
    console.error("Batch import dibatalkan", e instanceof Error ? e.name : "galat");
    const hasil: HasilBatch = { berhasil: 0, dilewati: 0, gagal: baris.map((b) => ({ nomor: b.nomor, pesan: PESAN_BATCH_BATAL })) };
    await jalankan(db, (tx) => catatHasil(tx, id, batch.errors, hasil));
    return hasil;
  }
}

export async function selesaiImpor(user: Pengguna, id: string, db: Klien = prisma): Promise<RingkasanImpor> {
  return jalankan(db, async (tx) => {
    const batch = await ambilBatch(user, id, tx);
    const { dilewati } = bacaGalat(batch.errors);
    const status = batch.baris_berhasil === 0 && batch.baris_gagal > 0 ? "GAGAL" : "SELESAI";
    await tx.importBatch.update({ where: { id }, data: { status } });
    const ringkasan = { berhasil: batch.baris_berhasil, dilewati, gagal: batch.baris_gagal };
    await catatAktivitas({ userId: user.id, aksi: "IMPORT_SELESAI", entitas: "import_batches", entitasId: id, perubahan: { ...ringkasan, status } }, tx);
    return ringkasan;
  });
}
