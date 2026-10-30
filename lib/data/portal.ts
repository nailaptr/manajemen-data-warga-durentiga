import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { scopeWhere } from "../scope";
import { hitungUsia } from "./warga";

// Data portal warga (PRD 5.1: /beranda, /keluarga, /pengajuan-saya). Hanya KK dari warga_id pengguna.
type Klien = PrismaClient | Prisma.TransactionClient;

export interface KeluargaSaya {
  kk: { id: string; no_kk: string; alamat: string; rt: string; rw: string };
  anggota: AnggotaKeluarga[];
}

export interface AnggotaKeluarga {
  id: string;
  nama: string;
  hubungan: string;
  usia: number;
  pekerjaan: string | null;
  status_perkawinan: string | null;
  pengajuanMenunggu: boolean;
}

export interface BarisPengajuanSaya {
  id: string;
  jenis: string;
  nama_warga: string | null;
  tanggal: Date;
  status: "MENUNGGU" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN";
  alasan_penolakan: string | null;
  // Hanya pengaju yang boleh membatalkan.
  milikSaya: boolean;
}

export const LABEL_HUBUNGAN: Record<string, string> = {
  KEPALA_KELUARGA: "Kepala Keluarga",
  ISTRI: "Istri",
  SUAMI: "Suami",
  ANAK: "Anak",
  MENANTU: "Menantu",
  CUCU: "Cucu",
  ORANG_TUA: "Orang Tua",
  MERTUA: "Mertua",
  FAMILI_LAIN: "Famili Lain",
  LAINNYA: "Lainnya",
};

export const LABEL_PERKAWINAN: Record<string, string> = {
  BELUM_KAWIN: "Belum Kawin",
  KAWIN: "Kawin",
  CERAI_HIDUP: "Cerai Hidup",
  CERAI_MATI: "Cerai Mati",
};

export const LABEL_JENIS_PENGAJUAN: Record<string, string> = {
  UBAH_WARGA: "Ubah data",
  TAMBAH_ANGGOTA: "Tambah anggota",
  LAPOR_PINDAH: "Lapor pindah",
  LAPOR_MENINGGAL: "Lapor meninggal",
};

export async function keluargaSaya(user: Pengguna, db: Klien = prisma): Promise<KeluargaSaya | null> {
  if (user.role !== "WARGA") return null;
  const kk = await db.kartuKeluarga.findFirst({
    where: { AND: [scopeWhere(user, "kartu_keluarga"), { deleted_at: null }] },
    select: {
      id: true,
      no_kk: true,
      alamat: true,
      wilayah: { select: { rt: true, rw: true } },
      warga: {
        where: { deleted_at: null, status_kependudukan: "AKTIF" },
        select: {
          id: true,
          nama_lengkap: true,
          hubungan_keluarga: true,
          tanggal_lahir: true,
          status_perkawinan: true,
          pekerjaan: { select: { nama: true } },
        },
      },
    },
  });
  if (!kk) return null;

  const menunggu = await db.pengajuan.findMany({
    where: { AND: [scopeWhere(user, "pengajuan"), { status: "MENUNGGU", warga_id: { not: null } }] },
    select: { warga_id: true },
  });
  const idMenunggu = new Set(menunggu.map((p) => p.warga_id));

  const kepalaDulu = (h: string) => (h === "KEPALA_KELUARGA" ? 0 : 1);
  const anggota = [...kk.warga]
    .sort((a, b) => kepalaDulu(a.hubungan_keluarga) - kepalaDulu(b.hubungan_keluarga) || a.tanggal_lahir.getTime() - b.tanggal_lahir.getTime())
    .map((w) => ({
      id: w.id,
      nama: w.nama_lengkap,
      hubungan: LABEL_HUBUNGAN[w.hubungan_keluarga] ?? w.hubungan_keluarga,
      usia: hitungUsia(w.tanggal_lahir),
      pekerjaan: w.pekerjaan?.nama ?? null,
      status_perkawinan: w.status_perkawinan ? LABEL_PERKAWINAN[w.status_perkawinan] : null,
      pengajuanMenunggu: idMenunggu.has(w.id),
    }));

  return {
    kk: { id: kk.id, no_kk: kk.no_kk, alamat: kk.alamat, rt: kk.wilayah.rt, rw: kk.wilayah.rw },
    anggota,
  };
}

export async function pengajuanSaya(user: Pengguna, batas?: number, db: Klien = prisma): Promise<BarisPengajuanSaya[]> {
  if (user.role !== "WARGA") return [];
  const baris = await db.pengajuan.findMany({
    where: scopeWhere(user, "pengajuan"),
    orderBy: { created_at: "desc" },
    take: batas,
    select: {
      id: true,
      jenis: true,
      status: true,
      created_at: true,
      alasan_penolakan: true,
      diajukan_oleh: true,
      warga: { select: { nama_lengkap: true } },
    },
  });
  return baris.map((p) => ({
    id: p.id,
    jenis: LABEL_JENIS_PENGAJUAN[p.jenis] ?? p.jenis,
    nama_warga: p.warga?.nama_lengkap ?? null,
    tanggal: p.created_at,
    status: p.status,
    alasan_penolakan: p.alasan_penolakan,
    milikSaya: p.diajukan_oleh === user.id,
  }));
}
