import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { Pengguna } from "@/lib/auth";
import { BATAS_EXPORT, GalatExport, exportWarga } from "@/lib/data/export";
import { daftarWargaTerfilter } from "@/lib/data/stats";
import { detailWarga, nomorLengkap } from "@/lib/data/warga";
import { dalamRollback, type Tx } from "./helpers";

// Data di RW 093 (hanya terlihat pengguna uji) dan dibatalkan. NIK 99909..., No KK 99910...
// NIK_A1 ada di RT 001, NIK_B1 di RT 002.
const NIK_A1 = "9990900000000001";
const NIK_B1 = "9990900000000002";
const NIK_RUMUS = "9990900000000003";

async function siapkan(tx: Tx) {
  const rt1 = await tx.wilayah.create({ data: { rw: "093", rt: "001" } });
  const rt2 = await tx.wilayah.create({ data: { rw: "093", rt: "002" } });
  const dasar = { nama: "Penguji", status: "AKTIF" as const };
  const adminDb = await tx.user.create({ data: { ...dasar, email: "uji-cari-admin@contoh.test", role: "ADMIN_RW", rw: "093" } });
  const ketuaDb = await tx.user.create({ data: { ...dasar, email: "uji-cari-rt@contoh.test", role: "KETUA_RT", wilayah_id: rt1.id } });
  const pengguna = (u: typeof adminDb): Pengguna => ({
    id: u.id, nama: u.nama, email: u.email, role: u.role, wilayah_id: u.wilayah_id, rw: u.rw, warga_id: null,
  });
  const kk = (no: string, wilayahId: string) =>
    tx.kartuKeluarga.create({ data: { no_kk: no, alamat: "Jl. Uji", wilayah_id: wilayahId, created_by: adminDb.id } });
  const kkA = await kk("9991000000000001", rt1.id);
  const kkB = await kk("9991000000000002", rt2.id);
  const warga = (kkId: string, nik: string, nama: string, hubungan: "KEPALA_KELUARGA" | "ANAK" = "KEPALA_KELUARGA") =>
    tx.warga.create({
      data: {
        kartu_keluarga_id: kkId, nik, nama_lengkap: nama, jenis_kelamin: "L", tanggal_lahir: new Date("1990-01-01"),
        hubungan_keluarga: hubungan, tempat_lahir: "Jakarta",
      },
    });
  const a1 = await warga(kkA.id, NIK_A1, "Warga Satu");
  const b1 = await warga(kkB.id, NIK_B1, "Warga Dua");
  const rumus = await warga(kkA.id, NIK_RUMUS, "=HYPERLINK(1)", "ANAK");
  return { admin: pengguna(adminDb), ketua: pengguna(ketuaDb), rt1, rt2, kkA, a1, b1, rumus };
}

const bacaXlsx = (isi: Uint8Array | string) => {
  const buku = XLSX.read(isi, { type: "array" });
  const lembar = buku.Sheets[buku.SheetNames[0] ?? ""];
  if (!lembar) throw new Error("lembar kosong");
  return lembar;
};

describe("Cari Warga: drawer dan Tampilkan lengkap (AC-07)", () => {
  it("detail memasking NIK dan No KK; nomorLengkap membuka penuh dan mencatat id tanpa nomor", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const d = await detailWarga(s.admin, s.a1.id, tx);
      expect(d?.nik_masked).not.toContain(NIK_A1);
      expect(d?.no_kk_masked).not.toContain("9991000000000001");

      const buka = await nomorLengkap(s.admin, s.a1.id, tx);
      expect(buka).toEqual({ nik: NIK_A1, no_kk: "9991000000000001" });
      const log = await tx.activityLog.findFirstOrThrow({ where: { aksi: "NIK_DITAMPILKAN", entitas_id: s.a1.id } });
      expect(log.user_id).toBe(s.admin.id);
      expect(JSON.stringify(log)).not.toContain(NIK_A1);
    }));

  it("Ketua RT tidak bisa melihat detail atau membuka NIK warga RT lain, dan tidak ada log (AC-04)", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      expect(await detailWarga(s.ketua, s.b1.id, tx)).toBeNull();
      expect(await nomorLengkap(s.ketua, s.b1.id, tx)).toBeNull();
      expect(await tx.activityLog.count({ where: { aksi: "NIK_DITAMPILKAN", entitas_id: s.b1.id } })).toBe(0);
    }));
});

describe("Cari Warga: pencarian dan cakupan", () => {
  it("pencarian teks menyempit dari hasil filter yang sama, dan filter rt RT lain tidak membuka data (AC-04)", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const cari = await daftarWargaTerfilter(s.admin, {}, { q: "Warga Satu" }, { db: tx });
      expect(cari.baris.map((b) => b.id)).toEqual([s.a1.id]);

      const lewatUrl = await daftarWargaTerfilter(s.ketua, { rt: ["002"] }, {}, { db: tx });
      expect(lewatUrl.total).toBe(0);
    }));
});

describe("Export Cari Warga (FR-CRW-05, AC-04, AC-07)", () => {
  it("xlsx: NIK dan No KK bertipe teks, hanya warga dalam cakupan, dan tercatat di log", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const hasil = await exportWarga(s.ketua, {}, undefined, "xlsx", undefined, tx);
      const lembar = bacaXlsx(hasil.isi);
      const baris = XLSX.utils.sheet_to_json<string[]>(lembar, { header: 1 });
      const nik = baris.map((b) => b[0]);
      expect(nik).toContain(NIK_A1);
      expect(nik).not.toContain(NIK_B1);
      expect(lembar["A2"]?.t).toBe("s");
      expect(lembar["B2"]?.t).toBe("s");

      const log = await tx.activityLog.findFirstOrThrow({ where: { aksi: "EXPORT_WARGA", user_id: s.ketua.id } });
      expect(log.perubahan).toMatchObject({ format: "xlsx", jumlah: 2, pencarian: false });
      expect(JSON.stringify(log)).not.toContain(NIK_A1);
    }));

  it("csv: berawalan BOM dan sel berawalan = diberi apostrof agar tidak dibaca sebagai rumus", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const hasil = await exportWarga(s.admin, {}, "HYPERLINK", "csv", undefined, tx);
      expect(typeof hasil.isi).toBe("string");
      const teks = hasil.isi as string;
      expect(teks.startsWith("﻿")).toBe(true);
      expect(teks).toContain(`"'=HYPERLINK(1)"`);
      const log = await tx.activityLog.findFirstOrThrow({ where: { aksi: "EXPORT_WARGA", user_id: s.admin.id } });
      expect(log.perubahan).toMatchObject({ format: "csv", jumlah: 1, pencarian: true });
    }));

  it("menolak hasil kosong, tanpa mencatat log", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      await expect(exportWarga(s.admin, {}, "tidak-ada-nama-ini", "csv", undefined, tx)).rejects.toBeInstanceOf(GalatExport);
      expect(await tx.activityLog.count({ where: { aksi: "EXPORT_WARGA", user_id: s.admin.id } })).toBe(0);
    }));

  it("menolak hasil lebih dari 5.000 baris, bukan memotongnya", () =>
    dalamRollback(async (tx) => {
      const s = await siapkan(tx);
      const tambahan = BATAS_EXPORT - 3 + 1;
      await tx.warga.createMany({
        data: Array.from({ length: tambahan }, (_, i) => ({
          kartu_keluarga_id: s.kkA.id,
          nik: `99909${String(i + 100).padStart(11, "0")}`,
          nama_lengkap: `Massal ${i}`,
          jenis_kelamin: "P" as const,
          tanggal_lahir: new Date("2000-01-01"),
          hubungan_keluarga: "ANAK" as const,
        })),
      });
      await expect(exportWarga(s.admin, {}, undefined, "xlsx", undefined, tx)).rejects.toThrow(/melebihi batas/);
      expect(await tx.activityLog.count({ where: { aksi: "EXPORT_WARGA", user_id: s.admin.id } })).toBe(0);
    }), 60_000);
});
