import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Prisma, type PrismaClient, type Role } from "../../generated/prisma/client";
import { catatAktivitas } from "../activity-log";
import { buatAkun } from "../akun";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { maskNomor } from "../mask";
import { scopeWhere } from "../scope";
import type { TambahPenggunaData, TolakKlaimData, UbahPenggunaData } from "../validators/pengguna";

// Akun pengurus (FR-USR-01) dan antrean klaim akun warga (FR-USR-02). Log hanya memuat id,
// peran, dan wilayah; tidak pernah NIK, No KK, atau tanggal lahir.
type Klien = PrismaClient | Prisma.TransactionClient;

export class GalatPengguna extends Error {}

const TIDAK_ADA: Prisma.UserWhereInput = { id: { in: [] } };
const BATAS_BARIS = 200;
const PESAN_KLAIM_HILANG = "Klaim tidak ditemukan atau sudah diproses.";

function jalankan<T>(db: Klien, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

// Super Admin mengelola Admin RW dan Ketua RT; Admin RW hanya Ketua RT di RW-nya (PRD 2.2).
function whereKelola(user: Pengguna): Prisma.UserWhereInput {
  if (user.role === "SUPER_ADMIN") return { role: { in: ["ADMIN_RW", "KETUA_RT"] } };
  if (user.role === "ADMIN_RW" && user.rw) return { role: "KETUA_RT", wilayah: { rw: user.rw } };
  return TIDAK_ADA;
}

function bisaKelola(user: Pengguna, role: Role, rwTarget: string): boolean {
  if (user.role === "SUPER_ADMIN") return role === "ADMIN_RW" || role === "KETUA_RT";
  return user.role === "ADMIN_RW" && role === "KETUA_RT" && !!user.rw && user.rw === rwTarget;
}

const whereKlaim = (user: Pengguna, status: "MENUNGGU_VERIFIKASI" | "AKTIF"): Prisma.UserWhereInput => ({
  role: "WARGA",
  status,
  warga: { is: scopeWhere(user, "warga") },
});

interface Cakupan {
  wilayah_id: string | null;
  rw: string;
}

// Ketua RT menyimpan wilayah_id dan rw wilayahnya; Admin RW hanya rw.
async function tentukanCakupan(tx: Prisma.TransactionClient, data: UbahPenggunaData): Promise<Cakupan> {
  if (data.role === "KETUA_RT") {
    const w = data.wilayah_id ? await tx.wilayah.findUnique({ where: { id: data.wilayah_id } }) : null;
    if (!w) throw new GalatPengguna("RT tidak ditemukan");
    return { wilayah_id: w.id, rw: w.rw };
  }
  const rw = data.rw ?? "";
  if ((await tx.wilayah.count({ where: { rw } })) === 0) throw new GalatPengguna(`RW ${rw} belum terdaftar`);
  return { wilayah_id: null, rw };
}

async function muatTarget(tx: Prisma.TransactionClient, user: Pengguna, id: string) {
  const target = await tx.user.findFirst({ where: { AND: [{ id }, whereKelola(user)] } });
  if (!target) throw new GalatPengguna("Pengguna tidak ditemukan");
  return target;
}

export interface BarisPengurus {
  id: string;
  nama: string;
  email: string;
  role: Role;
  wilayah_id: string | null;
  rw: string | null;
  cakupan: string;
  status: "MENUNGGU_VERIFIKASI" | "AKTIF" | "DITOLAK" | "NONAKTIF";
  dibuat: Date;
}

export async function daftarPengurus(
  user: Pengguna,
  filter: { q?: string; role?: "ADMIN_RW" | "KETUA_RT" },
  db: Klien = prisma,
): Promise<BarisPengurus[]> {
  const kondisi: Prisma.UserWhereInput[] = [whereKelola(user)];
  if (filter.role) kondisi.push({ role: filter.role });
  if (filter.q) {
    kondisi.push({ OR: [{ nama: { contains: filter.q, mode: "insensitive" } }, { email: { contains: filter.q, mode: "insensitive" } }] });
  }
  const baris = await db.user.findMany({
    where: { AND: kondisi },
    orderBy: { created_at: "asc" },
    take: BATAS_BARIS,
    include: { wilayah: { select: { rt: true, rw: true } } },
  });
  return baris.map((b) => ({
    id: b.id,
    nama: b.nama,
    email: b.email,
    role: b.role,
    wilayah_id: b.wilayah_id,
    rw: b.wilayah?.rw ?? b.rw,
    cakupan: b.wilayah ? `RT ${b.wilayah.rt} / RW ${b.wilayah.rw}` : `RW ${b.rw ?? "-"}`,
    status: b.status,
    dibuat: b.created_at,
  }));
}

export async function statistikPengguna(user: Pengguna, db: Klien = prisma) {
  const [pengurus, wargaAktif, klaimMenunggu] = await Promise.all([
    db.user.count({ where: { AND: [whereKelola(user)] } }),
    db.user.count({ where: whereKlaim(user, "AKTIF") }),
    db.user.count({ where: whereKlaim(user, "MENUNGGU_VERIFIKASI") }),
  ]);
  return { pengurus, wargaAktif, klaimMenunggu };
}

// Hash dihitung di luar transaksi; sandi acak tidak pernah diketahui siapa pun, orangnya
// mengatur sandi sendiri lewat tautan atur ulang.
export async function tambahPengurus(user: Pengguna, data: TambahPenggunaData, db: Klien = prisma): Promise<{ id: string; email: string }> {
  const hashSandi = await hashPassword(randomBytes(32).toString("hex"));
  try {
    return await jalankan(db, async (tx) => {
      const cakupan = await tentukanCakupan(tx, data);
      if (!bisaKelola(user, data.role, cakupan.rw)) throw new GalatPengguna("Anda tidak berhak membuat akun dengan peran dan wilayah ini");
      if (await tx.user.findUnique({ where: { email: data.email }, select: { id: true } })) throw new GalatPengguna("Email sudah terdaftar");
      const id = await buatAkun(
        { nama: data.nama, email: data.email, role: data.role, hashSandi, status: "AKTIF", email_verified: true, wilayah_id: cakupan.wilayah_id ?? undefined, rw: cakupan.rw },
        tx,
      );
      await catatAktivitas(
        { userId: user.id, aksi: "PENGGUNA_DIBUAT", entitas: "users", entitasId: id, perubahan: { role: data.role, wilayah_id: cakupan.wilayah_id, rw: cakupan.rw } },
        tx,
      );
      return { id, email: data.email };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new GalatPengguna("Email sudah terdaftar");
    throw e;
  }
}

export async function ubahPengurus(user: Pengguna, id: string, data: UbahPenggunaData, db: Klien = prisma): Promise<void> {
  await jalankan(db, async (tx) => {
    const target = await muatTarget(tx, user, id);
    const cakupan = await tentukanCakupan(tx, data);
    if (!bisaKelola(user, data.role, cakupan.rw)) throw new GalatPengguna("Anda tidak berhak memberi peran dan wilayah ini");
    await tx.user.update({ where: { id }, data: { nama: data.nama, role: data.role, wilayah_id: cakupan.wilayah_id, rw: cakupan.rw } });
    await catatAktivitas(
      {
        userId: user.id,
        aksi: "PENGGUNA_DIUBAH",
        entitas: "users",
        entitasId: id,
        perubahan: {
          role: [target.role, data.role],
          wilayah_id: [target.wilayah_id, cakupan.wilayah_id],
          rw: [target.rw, cakupan.rw],
        },
      },
      tx,
    );
  });
}

// Nonaktif langsung mengakhiri semua sesi akun itu.
export async function ubahStatusPengurus(user: Pengguna, id: string, status: "AKTIF" | "NONAKTIF", db: Klien = prisma): Promise<void> {
  await jalankan(db, async (tx) => {
    const target = await muatTarget(tx, user, id);
    if (target.status !== "AKTIF" && target.status !== "NONAKTIF") throw new GalatPengguna("Status akun ini tidak bisa diubah di sini");
    await tx.user.update({ where: { id }, data: { status } });
    if (status === "NONAKTIF") await tx.session.deleteMany({ where: { userId: id } });
    await catatAktivitas(
      { userId: user.id, aksi: status === "NONAKTIF" ? "PENGGUNA_DINONAKTIFKAN" : "PENGGUNA_DIAKTIFKAN", entitas: "users", entitasId: id },
      tx,
    );
  });
}

// Memeriksa hak dan mencatat log; pengiriman tautan dilakukan pemanggil lewat Better Auth.
export async function siapkanResetSandi(user: Pengguna, id: string, db: Klien = prisma): Promise<{ email: string }> {
  return jalankan(db, async (tx) => {
    const target = await muatTarget(tx, user, id);
    if (target.status !== "AKTIF") throw new GalatPengguna("Hanya akun aktif yang bisa direset kata sandinya");
    await catatAktivitas({ userId: user.id, aksi: "PENGGUNA_RESET_SANDI", entitas: "users", entitasId: id }, tx);
    return { email: target.email };
  });
}

export interface BarisKlaim {
  id: string;
  nama: string;
  nik: string;
  email: string;
  rt: string;
  dibuat: Date;
  emailTerverifikasi: boolean;
}

export async function daftarKlaim(user: Pengguna, db: Klien = prisma): Promise<BarisKlaim[]> {
  const baris = await db.user.findMany({
    where: whereKlaim(user, "MENUNGGU_VERIFIKASI"),
    orderBy: { created_at: "desc" },
    take: BATAS_BARIS,
    select: {
      id: true,
      email: true,
      email_verified: true,
      created_at: true,
      warga: { select: { nama_lengkap: true, nik: true, kartu_keluarga: { select: { wilayah: { select: { rt: true } } } } } },
    },
  });
  return baris.map((b) => ({
    id: b.id,
    nama: b.warga?.nama_lengkap ?? "-",
    nik: maskNomor(b.warga?.nik ?? ""),
    email: b.email,
    rt: `RT ${b.warga?.kartu_keluarga.wilayah.rt ?? "-"}`,
    dibuat: b.created_at,
    emailTerverifikasi: b.email_verified,
  }));
}

export async function setujuiKlaim(user: Pengguna, id: string, db: Klien = prisma): Promise<{ email: string; nama: string }> {
  return jalankan(db, async (tx) => {
    const klaim = await tx.user.findFirst({
      where: { AND: [{ id }, whereKlaim(user, "MENUNGGU_VERIFIKASI")] },
      select: { email: true, email_verified: true, warga: { select: { nama_lengkap: true } } },
    });
    if (!klaim) throw new GalatPengguna(PESAN_KLAIM_HILANG);
    // Tanpa email terverifikasi, akun yang disetujui tetap tidak bisa masuk.
    if (!klaim.email_verified) throw new GalatPengguna("Email pendaftar belum terverifikasi");
    const hasil = await tx.user.updateMany({ where: { id, status: "MENUNGGU_VERIFIKASI" }, data: { status: "AKTIF" } });
    if (hasil.count === 0) throw new GalatPengguna(PESAN_KLAIM_HILANG);
    await catatAktivitas({ userId: user.id, aksi: "KLAIM_DISETUJUI", entitas: "users", entitasId: id }, tx);
    return { email: klaim.email, nama: klaim.warga?.nama_lengkap ?? "" };
  });
}

// warga_id dikosongkan agar data warga itu bisa diklaim orang yang benar; baris akun tetap ada sebagai jejak.
export async function tolakKlaim(user: Pengguna, id: string, data: TolakKlaimData, db: Klien = prisma): Promise<{ email: string; nama: string }> {
  return jalankan(db, async (tx) => {
    const klaim = await tx.user.findFirst({
      where: { AND: [{ id }, whereKlaim(user, "MENUNGGU_VERIFIKASI")] },
      select: { email: true, warga: { select: { nama_lengkap: true } } },
    });
    if (!klaim) throw new GalatPengguna(PESAN_KLAIM_HILANG);
    const hasil = await tx.user.updateMany({ where: { id, status: "MENUNGGU_VERIFIKASI" }, data: { status: "DITOLAK", warga_id: null } });
    if (hasil.count === 0) throw new GalatPengguna(PESAN_KLAIM_HILANG);
    await catatAktivitas(
      { userId: user.id, aksi: "KLAIM_DITOLAK", entitas: "users", entitasId: id, perubahan: data.alasan ? { alasan: data.alasan } : {} },
      tx,
    );
    return { email: klaim.email, nama: klaim.warga?.nama_lengkap ?? "" };
  });
}
