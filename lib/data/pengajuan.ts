import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { catatAktivitas } from "../activity-log";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { maskNomor } from "../mask";
import { scopeWhere } from "../scope";
import { anggotaSchema } from "../validators/kk";
import { FIELD_UBAH, ubahSchema, type BuatPengajuanData, type FieldUbah } from "../validators/pengajuan";
import { dataWarga } from "./kk";
import { LABEL_HUBUNGAN, LABEL_JENIS_PENGAJUAN, LABEL_PERKAWINAN } from "./portal";
import { hitungUsia } from "./warga";

// Pengajuan perubahan data (PRD 3.3, 4.4). Warga hanya mengusulkan; data resmi berubah hanya saat
// pengurus menyetujui, dalam satu transaksi dengan perubahan status dan log. Log memuat nama field,
// tidak pernah nilainya (NIK, tanggal lahir).
type Klien = PrismaClient | Prisma.TransactionClient;

export class GalatPengajuan extends Error {}

// Dilempar saat data warga sudah berubah sejak pengajuan dibuat (BR-08); disetujui ulang dengan konfirmasi.
export class KonflikPengajuan extends Error {
  constructor(public readonly field: string[]) {
    super("Data warga sudah berubah sejak pengajuan dibuat");
  }
}

const PESAN_HILANG = "Pengajuan tidak ditemukan atau sudah diproses.";
const BATAS_ANTREAN = 100;

type Nilai = Record<string, string | null>;
type StatusPengajuan = "MENUNGGU" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN";
export const STATUS_PENGAJUAN: StatusPengajuan[] = ["MENUNGGU", "DISETUJUI", "DITOLAK", "DIBATALKAN"];

const LABEL_FIELD: Record<string, string> = {
  nama_lengkap: "Nama lengkap", nik: "NIK", tempat_lahir: "Tempat lahir", tanggal_lahir: "Tanggal lahir",
  agama: "Agama", pendidikan_id: "Pendidikan", pekerjaan_id: "Pekerjaan", golongan_darah: "Golongan darah",
  status_perkawinan: "Status perkawinan", hubungan_keluarga: "Hubungan keluarga", jenis_kelamin: "Jenis kelamin",
  status_kependudukan: "Status kependudukan", tanggal_status: "Tanggal kejadian",
};
const LABEL_NILAI: Record<string, Record<string, string>> = {
  agama: { ISLAM: "Islam", KRISTEN: "Kristen", KATOLIK: "Katolik", HINDU: "Hindu", BUDDHA: "Buddha", KONGHUCU: "Konghucu", LAINNYA: "Lainnya" },
  golongan_darah: { A: "A", B: "B", AB: "AB", O: "O", TIDAK_TAHU: "Tidak tahu" },
  status_perkawinan: LABEL_PERKAWINAN,
  hubungan_keluarga: LABEL_HUBUNGAN,
  jenis_kelamin: { L: "Laki-laki", P: "Perempuan" },
  status_kependudukan: { AKTIF: "Aktif", PINDAH: "Pindah", MENINGGAL: "Meninggal" },
};

function jalankan<T>(db: Klien, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

function pastikanPengurus(user: Pengguna) {
  // scopeWhere memberi Warga cakupan KK-nya sendiri; antrean tetap hanya untuk pengurus.
  if (user.role === "WARGA") throw new GalatPengajuan("Tidak berwenang");
}

const isoTanggal = (d: Date) => d.toISOString().slice(0, 10);

// Bentuk baku nilai warga untuk disimpan di data_lama/data_baru dan dibandingkan.
function nilaiWarga(w: Record<string, unknown>, kunci: readonly string[]): Nilai {
  const hasil: Nilai = {};
  for (const k of kunci) {
    const v = w[k];
    hasil[k] = v instanceof Date ? isoTanggal(v) : v == null ? null : String(v);
  }
  return hasil;
}

const bacaNilai = (j: Prisma.JsonValue | null): Nilai =>
  j && typeof j === "object" && !Array.isArray(j)
    ? Object.fromEntries(Object.entries(j).map(([k, v]) => [k, v == null ? null : String(v)]))
    : {};

const tglIndo = (iso: string) => iso.split("-").reverse().join("/");

// ---------- Warga ----------

export interface AnggotaForm {
  id: string;
  nama: string;
  hubungan: string;
  usia: number;
  nilai: Nilai;
  // Nilai yang sama dalam bentuk tampilan ("Saat ini: ..."): nama master dan label enum.
  tampil: Nilai;
}
export interface OpsiMaster {
  id: string;
  nama: string;
}
export interface DataFormPengajuan {
  rt: string;
  anggota: AnggotaForm[];
  pendidikan: OpsiMaster[];
  pekerjaan: OpsiMaster[];
}

// Nilai saat ini anggota KK sendiri, untuk mengisi form "Ubah data".
export async function dataFormPengajuan(user: Pengguna, db: Klien = prisma): Promise<DataFormPengajuan | null> {
  if (user.role !== "WARGA") return null;
  const kk = await db.kartuKeluarga.findFirst({
    where: { AND: [scopeWhere(user, "kartu_keluarga"), { deleted_at: null }] },
    select: { wilayah: { select: { rt: true } }, warga: { where: { deleted_at: null, status_kependudukan: "AKTIF" }, orderBy: { tanggal_lahir: "asc" } } },
  });
  if (!kk) return null;
  const [pendidikan, pekerjaan] = await Promise.all([
    db.refPendidikan.findMany({ orderBy: { urutan: "asc" }, select: { id: true, nama: true } }),
    db.refPekerjaan.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);
  const namaMaster = new Map([...pendidikan, ...pekerjaan].map((m) => [m.id, m.nama]));
  const tampil = (k: string, v: string | null): string => {
    if (!v) return "-";
    if (k === "tanggal_lahir") return tglIndo(v);
    return namaMaster.get(v) ?? LABEL_NILAI[k]?.[v] ?? v;
  };
  return {
    rt: kk.wilayah.rt,
    anggota: kk.warga.map((w) => {
      const nilai = nilaiWarga(w, FIELD_UBAH);
      return {
        id: w.id,
        nama: w.nama_lengkap,
        hubungan: LABEL_HUBUNGAN[w.hubungan_keluarga] ?? w.hubungan_keluarga,
        usia: hitungUsia(w.tanggal_lahir),
        nilai,
        tampil: Object.fromEntries(Object.entries(nilai).map(([k, v]) => [k, k === "nik" ? (v ? maskNomor(v) : "-") : tampil(k, v)])),
      };
    }),
    pendidikan,
    pekerjaan,
  };
}

export async function buatPengajuan(user: Pengguna, data: BuatPengajuanData, db: Klien = prisma): Promise<string> {
  if (user.role !== "WARGA") throw new GalatPengajuan("Hanya warga yang dapat membuat pengajuan");
  return jalankan(db, async (tx) => {
    const kk = await tx.kartuKeluarga.findFirst({
      where: { AND: [scopeWhere(user, "kartu_keluarga"), { deleted_at: null }] },
      select: { id: true },
    });
    if (!kk) throw new GalatPengajuan("Data keluarga tidak ditemukan");

    let wargaId: string | null = null;
    let lama: Nilai | null = null;
    let baru: Nilai;
    let field: string[];

    if (data.jenis === "TAMBAH_ANGGOTA") {
      // Field kosong dibuang agar data_baru lolos anggotaSchema lagi saat disetujui.
      baru = Object.fromEntries(Object.entries(nilaiWarga(data.anggota, Object.keys(data.anggota))).filter(([, v]) => v !== null));
      field = Object.keys(baru);
    } else {
      // Anggota harus dari KK pengaju: id KK lain diperlakukan sama seperti tidak ada.
      const w = await tx.warga.findFirst({
        where: { id: data.warga_id, kartu_keluarga_id: kk.id, deleted_at: null, status_kependudukan: "AKTIF" },
      });
      if (!w) throw new GalatPengajuan("Anggota keluarga tidak ditemukan");
      if ((await tx.pengajuan.count({ where: { warga_id: w.id, status: "MENUNGGU" } })) > 0) {
        throw new GalatPengajuan("Masih ada pengajuan yang menunggu untuk anggota ini");
      }
      wargaId = w.id;

      if (data.jenis === "UBAH_WARGA") {
        const sekarang = nilaiWarga(w, FIELD_UBAH);
        const usulan = nilaiWarga(data.perubahan, Object.keys(data.perubahan).filter((k) => data.perubahan[k as FieldUbah] !== undefined));
        field = Object.keys(usulan).filter((k) => usulan[k] !== sekarang[k]);
        if (field.length === 0) throw new GalatPengajuan("Tidak ada data yang berubah");
        lama = Object.fromEntries(field.map((k) => [k, sekarang[k]]));
        baru = Object.fromEntries(field.map((k) => [k, usulan[k]]));
      } else {
        lama = nilaiWarga(w, ["status_kependudukan", "tanggal_status"]);
        baru = { status_kependudukan: data.jenis === "LAPOR_PINDAH" ? "PINDAH" : "MENINGGAL", tanggal_status: data.tanggal_status };
        field = ["status_kependudukan"];
      }
    }

    const idMaster = (k: string) => (baru[k] ? [baru[k] as string] : []);
    if (
      (await tx.refPendidikan.count({ where: { id: { in: idMaster("pendidikan_id") } } })) !== idMaster("pendidikan_id").length ||
      (await tx.refPekerjaan.count({ where: { id: { in: idMaster("pekerjaan_id") } } })) !== idMaster("pekerjaan_id").length
    ) {
      throw new GalatPengajuan("Pilihan pendidikan atau pekerjaan tidak valid");
    }

    const p = await tx.pengajuan.create({
      data: {
        kartu_keluarga_id: kk.id,
        diajukan_oleh: user.id,
        jenis: data.jenis,
        warga_id: wargaId,
        data_lama: lama ?? undefined,
        data_baru: baru,
        catatan: data.catatan,
      },
      select: { id: true },
    });
    await catatAktivitas({ userId: user.id, aksi: "PENGAJUAN_DIBUAT", entitas: "pengajuan", entitasId: p.id, perubahan: { jenis: data.jenis, field } }, tx);
    return p.id;
  });
}

// Hanya pengaju sendiri, hanya selama MENUNGGU (FR-PGJ-05).
export async function batalkanPengajuan(user: Pengguna, id: string, db: Klien = prisma): Promise<void> {
  if (user.role !== "WARGA") throw new GalatPengajuan("Tidak berwenang");
  await jalankan(db, async (tx) => {
    const hasil = await tx.pengajuan.updateMany({
      where: { AND: [scopeWhere(user, "pengajuan"), { id, diajukan_oleh: user.id, status: "MENUNGGU" }] },
      data: { status: "DIBATALKAN", diproses_at: new Date() },
    });
    if (hasil.count === 0) throw new GalatPengajuan(PESAN_HILANG);
    await catatAktivitas({ userId: user.id, aksi: "PENGAJUAN_DIBATALKAN", entitas: "pengajuan", entitasId: id }, tx);
  });
}

// ---------- Pengurus ----------

export interface BarisAntrean {
  id: string;
  jenis: string;
  nama: string;
  pengaju: string;
  rt: string;
  tanggal: Date;
}

export async function hitungPengajuan(user: Pengguna, db: Klien = prisma): Promise<Record<StatusPengajuan, number>> {
  pastikanPengurus(user);
  const baris = await db.pengajuan.groupBy({ by: ["status"], where: scopeWhere(user, "pengajuan"), _count: { _all: true } });
  const hasil: Record<StatusPengajuan, number> = { MENUNGGU: 0, DISETUJUI: 0, DITOLAK: 0, DIBATALKAN: 0 };
  for (const b of baris) hasil[b.status] = b._count._all;
  return hasil;
}

export async function daftarAntrean(user: Pengguna, status: StatusPengajuan, db: Klien = prisma): Promise<BarisAntrean[]> {
  pastikanPengurus(user);
  const baris = await db.pengajuan.findMany({
    where: { AND: [scopeWhere(user, "pengajuan"), { status }] },
    orderBy: { created_at: "desc" },
    take: BATAS_ANTREAN,
    select: {
      id: true, jenis: true, created_at: true, data_baru: true,
      warga: { select: { nama_lengkap: true } },
      pengaju: { select: { nama: true } },
      kartu_keluarga: { select: { wilayah: { select: { rt: true } } } },
    },
  });
  return baris.map((p) => ({
    id: p.id,
    jenis: LABEL_JENIS_PENGAJUAN[p.jenis] ?? p.jenis,
    nama: p.warga?.nama_lengkap ?? bacaNilai(p.data_baru).nama_lengkap ?? "-",
    pengaju: p.pengaju.nama,
    rt: p.kartu_keluarga.wilayah.rt,
    tanggal: p.created_at,
  }));
}

export interface BarisPerbedaan {
  label: string;
  lama: string;
  baru: string;
}
export interface DetailPengajuan {
  id: string;
  jenis: string;
  jenisKode: string;
  status: StatusPengajuan;
  nama: string;
  noKk: string;
  rt: string;
  rw: string;
  pengaju: string;
  waktu: Date;
  catatan: string | null;
  alasanPenolakan: string | null;
  perbedaan: BarisPerbedaan[];
  // Label field yang berubah sejak pengajuan dibuat; hanya terisi saat MENUNGGU (BR-08).
  konflik: string[];
}

// Field warga saat ini yang beda dari data_lama. Warga yang sudah dihapus atau (untuk ubah data)
// tidak lagi aktif tidak bisa diterapkan sama sekali, jadi itu galat, bukan konflik.
function cariKonflik(p: { jenis: string; data_lama: Prisma.JsonValue | null }, warga: Record<string, unknown> | null): string[] {
  if (p.jenis === "TAMBAH_ANGGOTA") return [];
  if (!warga || warga.deleted_at) throw new GalatPengajuan("Data warga sudah dihapus");
  if (warga.status_kependudukan !== "AKTIF") throw new GalatPengajuan("Warga ini tidak lagi berstatus aktif");
  const lama = bacaNilai(p.data_lama);
  const sekarang = nilaiWarga(warga, Object.keys(lama));
  return Object.keys(lama).filter((k) => sekarang[k] !== lama[k]);
}

export async function detailPengajuan(user: Pengguna, id: string, db: Klien = prisma): Promise<DetailPengajuan | null> {
  pastikanPengurus(user);
  const p = await db.pengajuan.findFirst({
    where: { AND: [scopeWhere(user, "pengajuan"), { id }] },
    include: {
      warga: true,
      pengaju: { select: { nama: true, warga: { select: { hubungan_keluarga: true } } } },
      kartu_keluarga: { select: { no_kk: true, wilayah: { select: { rt: true, rw: true } } } },
    },
  });
  if (!p) return null;

  const lama = bacaNilai(p.data_lama);
  const baru = bacaNilai(p.data_baru);
  const kunci = Object.keys(baru);
  const idPendidikan = [...kunci.includes("pendidikan_id") ? [lama.pendidikan_id, baru.pendidikan_id] : []].filter((x): x is string => !!x);
  const idPekerjaan = [...kunci.includes("pekerjaan_id") ? [lama.pekerjaan_id, baru.pekerjaan_id] : []].filter((x): x is string => !!x);
  const [pendidikan, pekerjaan] = await Promise.all([
    db.refPendidikan.findMany({ where: { id: { in: idPendidikan } }, select: { id: true, nama: true } }),
    db.refPekerjaan.findMany({ where: { id: { in: idPekerjaan } }, select: { id: true, nama: true } }),
  ]);
  const master: Record<string, Map<string, string>> = {
    pendidikan_id: new Map(pendidikan.map((m) => [m.id, m.nama])),
    pekerjaan_id: new Map(pekerjaan.map((m) => [m.id, m.nama])),
  };
  const tampil = (k: string, v: string | null | undefined): string => {
    if (v == null || v === "") return "-";
    if (k === "nik") return maskNomor(v);
    if (k === "tanggal_lahir" || k === "tanggal_status") return tglIndo(v);
    return master[k]?.get(v) ?? LABEL_NILAI[k]?.[v] ?? v;
  };

  let konflik: string[] = [];
  if (p.status === "MENUNGGU") {
    try {
      konflik = cariKonflik(p, p.warga).map((k) => LABEL_FIELD[k] ?? k);
    } catch (e) {
      if (!(e instanceof GalatPengajuan)) throw e;
      konflik = [e.message];
    }
  }

  const hubungan = p.pengaju.warga ? (LABEL_HUBUNGAN[p.pengaju.warga.hubungan_keluarga] ?? "") : "";
  return {
    id: p.id,
    jenis: LABEL_JENIS_PENGAJUAN[p.jenis] ?? p.jenis,
    jenisKode: p.jenis,
    status: p.status,
    nama: p.warga?.nama_lengkap ?? baru.nama_lengkap ?? "-",
    noKk: maskNomor(p.kartu_keluarga.no_kk),
    rt: p.kartu_keluarga.wilayah.rt,
    rw: p.kartu_keluarga.wilayah.rw,
    pengaju: hubungan ? `${p.pengaju.nama} (${hubungan.toLowerCase()})` : p.pengaju.nama,
    waktu: p.created_at,
    catatan: p.catatan,
    alasanPenolakan: p.alasan_penolakan,
    perbedaan: kunci.map((k) => ({ label: LABEL_FIELD[k] ?? k, lama: tampil(k, lama[k]), baru: tampil(k, baru[k]) })),
    konflik,
  };
}

export async function setujuiPengajuan(
  user: Pengguna,
  id: string,
  { konfirmasiKonflik = false }: { konfirmasiKonflik?: boolean } = {},
  db: Klien = prisma,
): Promise<void> {
  pastikanPengurus(user);
  try {
    await jalankan(db, async (tx) => {
      const p = await tx.pengajuan.findFirst({
        where: { AND: [scopeWhere(user, "pengajuan"), { id, status: "MENUNGGU" }, { kartu_keluarga: { deleted_at: null } }] },
        include: { warga: true },
      });
      if (!p) throw new GalatPengajuan(PESAN_HILANG);

      // Semua pemeriksaan dulu, baru menulis: dengan klien non-transaksi, galat sesudah menulis tidak bisa dibatalkan.
      const konflik = cariKonflik(p, p.warga);
      if (konflik.length > 0 && !konfirmasiKonflik) throw new KonflikPengajuan(konflik.map((k) => LABEL_FIELD[k] ?? k));
      const baru = bacaNilai(p.data_baru);
      const anggota = p.jenis === "TAMBAH_ANGGOTA" ? anggotaSchema.omit({ id: true }).safeParse(p.data_baru) : null;
      if (anggota && !anggota.success) throw new GalatPengajuan("Data pengajuan tidak valid");
      if (p.jenis === "UBAH_WARGA" && !ubahSchema.safeParse(baru).success) throw new GalatPengajuan("Data pengajuan tidak valid");

      const klaim = await tx.pengajuan.updateMany({
        where: { id, status: "MENUNGGU" },
        data: { status: "DISETUJUI", diproses_oleh: user.id, diproses_at: new Date() },
      });
      if (klaim.count === 0) throw new GalatPengajuan(PESAN_HILANG);

      if (anggota?.success) {
        await tx.warga.create({ data: { ...dataWarga(anggota.data), kartu_keluarga_id: p.kartu_keluarga_id, status_kependudukan: "AKTIF" } });
      } else if (p.jenis === "UBAH_WARGA") {
        const kolom: Prisma.WargaUncheckedUpdateInput = {};
        for (const k of FIELD_UBAH) {
          if (!(k in baru)) continue;
          Object.assign(kolom, { [k]: k === "tanggal_lahir" && baru[k] ? new Date(`${baru[k]}T00:00:00Z`) : baru[k] });
        }
        await tx.warga.update({ where: { id: p.warga_id! }, data: kolom });
      } else {
        await tx.warga.update({
          where: { id: p.warga_id! },
          data: {
            status_kependudukan: baru.status_kependudukan as "PINDAH" | "MENINGGAL",
            tanggal_status: baru.tanggal_status ? new Date(`${baru.tanggal_status}T00:00:00Z`) : null,
          },
        });
      }
      await catatAktivitas(
        { userId: user.id, aksi: "PENGAJUAN_DISETUJUI", entitas: "pengajuan", entitasId: id, perubahan: { jenis: p.jenis, field: Object.keys(baru), konflik: konflik.length > 0 } },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new GalatPengajuan("NIK sudah terdaftar pada warga lain");
    throw e;
  }
}

export async function tolakPengajuan(user: Pengguna, id: string, alasan: string, db: Klien = prisma): Promise<void> {
  pastikanPengurus(user);
  await jalankan(db, async (tx) => {
    const p = await tx.pengajuan.findFirst({ where: { AND: [scopeWhere(user, "pengajuan"), { id, status: "MENUNGGU" }] }, select: { jenis: true } });
    if (!p) throw new GalatPengajuan(PESAN_HILANG);
    const hasil = await tx.pengajuan.updateMany({
      where: { id, status: "MENUNGGU" },
      data: { status: "DITOLAK", alasan_penolakan: alasan, diproses_oleh: user.id, diproses_at: new Date() },
    });
    if (hasil.count === 0) throw new GalatPengajuan(PESAN_HILANG);
    await catatAktivitas({ userId: user.id, aksi: "PENGAJUAN_DITOLAK", entitas: "pengajuan", entitasId: id, perubahan: { jenis: p.jenis, panjang_alasan: alasan.length } }, tx);
  });
}

export interface PenerimaPengajuanBaru {
  jenis: string;
  namaPengaju: string;
  pengurus: { email: string; nama: string }[];
}

// Ketua RT aktif di RT pengajuan, untuk email pemberitahuan. Dipanggil sesudah pengajuan tersimpan.
export async function penerimaPengajuanBaru(user: Pengguna, id: string, db: Klien = prisma): Promise<PenerimaPengajuanBaru | null> {
  const p = await db.pengajuan.findFirst({
    where: { AND: [scopeWhere(user, "pengajuan"), { id }] },
    select: { jenis: true, pengaju: { select: { nama: true } }, kartu_keluarga: { select: { wilayah_id: true } } },
  });
  if (!p) return null;
  const pengurus = await db.user.findMany({
    where: { role: "KETUA_RT", status: "AKTIF", wilayah_id: p.kartu_keluarga.wilayah_id },
    select: { email: true, nama: true },
  });
  return { jenis: LABEL_JENIS_PENGAJUAN[p.jenis] ?? p.jenis, namaPengaju: p.pengaju.nama, pengurus };
}

export interface PenerimaHasilPengajuan {
  email: string;
  nama: string;
  jenis: string;
  disetujui: boolean;
  alasan: string | null;
}

// Pengaju pengajuan yang sudah diputuskan, untuk email hasil. Hanya pengurus.
export async function penerimaHasilPengajuan(user: Pengguna, id: string, db: Klien = prisma): Promise<PenerimaHasilPengajuan | null> {
  pastikanPengurus(user);
  const p = await db.pengajuan.findFirst({
    where: { AND: [scopeWhere(user, "pengajuan"), { id, status: { in: ["DISETUJUI", "DITOLAK"] } }] },
    select: { jenis: true, status: true, alasan_penolakan: true, pengaju: { select: { email: true, nama: true } } },
  });
  if (!p) return null;
  return {
    email: p.pengaju.email,
    nama: p.pengaju.nama,
    jenis: LABEL_JENIS_PENGAJUAN[p.jenis] ?? p.jenis,
    disetujui: p.status === "DISETUJUI",
    alasan: p.alasan_penolakan,
  };
}
