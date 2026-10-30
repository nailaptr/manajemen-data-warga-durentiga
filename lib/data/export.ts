import * as XLSX from "xlsx";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { catatAktivitas } from "../activity-log";
import type { Pengguna } from "../auth";
import { prisma } from "../db";
import { hariJakarta, type FilterStatistik } from "../filters";
import { filterKeQuery } from "../filter-url";
import { whereCariWarga } from "./stats";
import { hitungUsia } from "./warga";

// Export hasil Cari Warga (FR-CRW-05, PRD 7 dan 9.2). Dijalankan di server oleh api/export.
type Klien = PrismaClient | Prisma.TransactionClient;

export const BATAS_EXPORT = 5000;

export type FormatExport = "xlsx" | "csv";

export class GalatExport extends Error {}

const KOLOM = [
  "NIK", "No KK", "Nama Lengkap", "Jenis Kelamin", "Tempat Lahir", "Tanggal Lahir", "Usia", "Agama",
  "Golongan Darah", "Pendidikan", "Pekerjaan", "Hubungan Keluarga", "Status Perkawinan", "Alamat", "RT", "RW",
] as const;

const JK = { L: "Laki-laki", P: "Perempuan" } as const;

export interface HasilExport {
  isi: Uint8Array | string;
  jenis: string;
  namaBerkas: string;
}

// Sel yang diawali = + - @ dianggap rumus oleh Excel saat CSV dibuka; awali dengan apostrof.
const amankanCsv = (t: string) => (/^[=+\-@\t\r]/.test(t) ? `'${t}` : t);
const sel = (t: string) => `"${amankanCsv(t).replaceAll('"', '""')}"`;

// Seluruh sel berupa teks: NIK dan No KK tidak boleh menjadi angka (digit hilang di Excel).
function keXlsx(baris: string[][]): Uint8Array {
  const lembar = XLSX.utils.aoa_to_sheet([[...KOLOM], ...baris]);
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, lembar, "Warga");
  return new Uint8Array(XLSX.write(buku, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

// BOM supaya Excel membaca UTF-8. Batas CSV: Excel tetap menampilkan NIK 16 digit sebagai angka ilmiah; gunakan xlsx.
function keCsv(baris: string[][]): string {
  return `﻿${[[...KOLOM], ...baris].map((b) => b.map(sel).join(",")).join("\r\n")}\r\n`;
}

// Cakupan, filter, dan pencarian sama persis dengan halaman Cari Warga (buildWargaWhere + scopeWhere).
// Lebih dari BATAS_EXPORT baris ditolak, bukan dipotong diam-diam. Log memuat jumlah dan filter, tidak memuat data warga.
export async function exportWarga(
  user: Pengguna,
  filter: Partial<FilterStatistik>,
  q: string | undefined,
  format: FormatExport,
  hariIni: Date = hariJakarta(),
  db: Klien = prisma,
): Promise<HasilExport> {
  const where = await whereCariWarga(user, filter, q, { hariIni, db });
  const jumlah = await db.warga.count({ where });
  if (jumlah === 0) throw new GalatExport("Tidak ada data untuk diexport");
  if (jumlah > BATAS_EXPORT) {
    throw new GalatExport(`Hasil ${jumlah} baris melebihi batas ${BATAS_EXPORT} baris per file. Persempit filter.`);
  }
  const rows = await db.warga.findMany({
    where,
    orderBy: [{ nama_lengkap: "asc" }, { id: "asc" }],
    take: BATAS_EXPORT,
    select: {
      nik: true, nama_lengkap: true, jenis_kelamin: true, tempat_lahir: true, tanggal_lahir: true, agama: true,
      golongan_darah: true, hubungan_keluarga: true, status_perkawinan: true,
      pendidikan: { select: { nama: true } },
      pekerjaan: { select: { nama: true } },
      kartu_keluarga: { select: { no_kk: true, alamat: true, wilayah: { select: { rt: true, rw: true } } } },
    },
  });
  const baris = rows.map((r) => [
    r.nik, r.kartu_keluarga.no_kk, r.nama_lengkap, JK[r.jenis_kelamin], r.tempat_lahir ?? "",
    r.tanggal_lahir.toISOString().slice(0, 10), String(hitungUsia(r.tanggal_lahir, hariIni)), r.agama ?? "",
    r.golongan_darah ?? "", r.pendidikan?.nama ?? "", r.pekerjaan?.nama ?? "", r.hubungan_keluarga,
    r.status_perkawinan ?? "", r.kartu_keluarga.alamat, r.kartu_keluarga.wilayah.rt, r.kartu_keluarga.wilayah.rw,
  ]);
  await catatAktivitas(
    {
      userId: user.id,
      aksi: "EXPORT_WARGA",
      entitas: "warga",
      entitasId: "hasil_filter",
      perubahan: { format, jumlah: baris.length, filter: filterKeQuery(filter), pencarian: Boolean(q?.trim()) },
    },
    db,
  );
  const tanggal = hariIni.toISOString().slice(0, 10);
  return format === "xlsx"
    ? { isi: keXlsx(baris), jenis: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", namaBerkas: `warga-${tanggal}.xlsx` }
    : { isi: keCsv(baris), jenis: "text/csv; charset=utf-8", namaBerkas: `warga-${tanggal}.csv` };
}
