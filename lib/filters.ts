import { z } from "zod";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { prisma } from "./db";
import { scopeWhere } from "./scope";

// Satu parser dan satu pembangun `where` untuk Dashboard dan Cari Warga (PRD bagian 6).
type Klien = PrismaClient | Prisma.TransactionClient;
type PenggunaScope = Parameters<typeof scopeWhere>[0];

const MAKS_ITEM = 50;

// "a,b" menjadi ["a","b"]; kosong menjadi [].
const daftar = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v),
    z.array(item).max(MAKS_ITEM).default([]),
  );

const usia = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).max(150).optional());

export const filterSchema = z
  .object({
    pendidikan: daftar(z.string().uuid()),
    pekerjaan: daftar(z.string().uuid()),
    jk: daftar(z.enum(["L", "P"])),
    kategori: daftar(z.string().uuid()),
    rt: daftar(z.string().regex(/^\d{3}$/)),
    usia_min: usia,
    usia_max: usia,
  })
  .refine((f) => f.usia_min === undefined || f.usia_max === undefined || f.usia_min <= f.usia_max, {
    message: "Usia minimal tidak boleh lebih besar dari usia maksimal",
  });

export type FilterStatistik = z.output<typeof filterSchema>;

export type HasilParseFilter = { ok: true; filter: FilterStatistik } | { ok: false; galat: string };

type ParamUrl = Record<string, string | string[] | undefined>;

// Nilai berulang (?rt=001&rt=002) digabung seperti ?rt=001,002.
export function parseFilter(params: ParamUrl): HasilParseFilter {
  const mentah = Object.fromEntries(
    Object.keys(filterSchema.shape).map((k) => {
      const v = params[k];
      return [k, Array.isArray(v) ? v.join(",") : v];
    }),
  );
  const hasil = filterSchema.safeParse(mentah);
  return hasil.success ? { ok: true, filter: hasil.data } : { ok: false, galat: "Filter tidak valid" };
}

// Tanggal hari ini di Asia/Jakarta sebagai tengah malam UTC, sama dengan cara kolom @db.Date dibaca.
export function hariJakarta(sekarang: Date = new Date()): Date {
  const [y, m, d] = sekarang.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

// Tanggal yang sama `tahun` tahun lalu; 29 Februari menjadi 28 Februari di tahun biasa.
function mundurTahun(hari: Date, tahun: number): Date {
  const y = hari.getUTCFullYear() - tahun;
  const m = hari.getUTCMonth();
  const akhirBulan = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(hari.getUTCDate(), akhirBulan)));
}

// Usia dalam tahun penuh (sama dengan age() di PRD 6.3) sebagai rentang tanggal_lahir:
// usia >= min berarti lahir paling lambat min tahun lalu; usia <= maks berarti lahir setelah (maks+1) tahun lalu.
function rentangUsia(min: number | null | undefined, maks: number | null | undefined, hari: Date): Prisma.WargaWhereInput {
  const lahir: Prisma.DateTimeFilter = {};
  if (min != null) lahir.lte = mundurTahun(hari, min);
  if (maks != null) lahir.gt = mundurTahun(hari, maks + 1);
  return { tanggal_lahir: lahir };
}

const TIDAK_ADA: Prisma.WargaWhereInput = { id: { in: [] } };

export interface OpsiFilter {
  hariIni?: Date;
  db?: Klien;
}

// AND antar filter, OR di dalam satu filter. Selalu lewat scopeWhere, hanya warga AKTIF yang belum dihapus.
export async function buildWargaWhere(
  f: Partial<FilterStatistik>,
  user: PenggunaScope,
  { hariIni = hariJakarta(), db = prisma }: OpsiFilter = {},
): Promise<Prisma.WargaWhereInput> {
  const sama: Prisma.WargaWhereInput[] = [
    scopeWhere(user, "warga"),
    { deleted_at: null, status_kependudukan: "AKTIF", kartu_keluarga: { deleted_at: null } },
  ];
  if (f.pendidikan?.length) sama.push({ pendidikan_id: { in: f.pendidikan } });
  if (f.pekerjaan?.length) sama.push({ pekerjaan_id: { in: f.pekerjaan } });
  if (f.jk?.length) sama.push({ jenis_kelamin: { in: f.jk } });
  if (f.rt?.length) sama.push({ kartu_keluarga: { wilayah: { rt: { in: f.rt } } } });
  if (f.kategori?.length) {
    const baris = await db.kategoriUsia.findMany({ where: { id: { in: f.kategori } } });
    sama.push({
      OR: baris.length
        ? baris.map((k) => ({
            AND: [
              rentangUsia(k.usia_min, k.usia_maks, hariIni),
              ...(k.jenis_kelamin ? [{ jenis_kelamin: k.jenis_kelamin }] : []),
            ],
          }))
        : [TIDAK_ADA],
    });
  }
  if (f.usia_min != null || f.usia_max != null) sama.push(rentangUsia(f.usia_min, f.usia_max, hariIni));
  return { AND: sama };
}
