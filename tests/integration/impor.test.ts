import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import type { Pengguna } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GalatBatch, mappingTerakhir, mulaiImpor, prosesBatch, selesaiImpor } from "@/lib/data/impor";
import { barisImporSchema, type BarisImpor, type MulaiImpor } from "@/lib/validators/impor";

// Tes ini memakai transaksi sungguhan (batch = satu $transaction), jadi datanya dibersihkan sendiri.
// NIK berawalan 99900097, No KK berawalan 99901097, RW 097, email @contoh.test: bukan data nyata.
const EMAIL_SA = "uji-impor-sa@contoh.test";
const EMAIL_RW = "uji-impor-rw@contoh.test";
const nik = (n: number) => `99900097${String(n).padStart(8, "0")}`;
const noKk = (n: number) => `99901097${String(n).padStart(8, "0")}`;

let sa: Pengguna;
let adminRw: Pengguna;
let pendidikanId = "";
let pekerjaanId = "";

function baris(nomor: number, ubah: Partial<Record<keyof BarisImpor, unknown>> = {}): BarisImpor {
  return barisImporSchema.parse({
    nomor, no_kk: noKk(1), nik: nik(nomor), nama_lengkap: `Uji Impor ${nomor}`, jenis_kelamin: "L", tanggal_lahir: "1980-01-01",
    hubungan_keluarga: "ANAK", tempat_lahir: "Jakarta", agama: "ISLAM", pendidikan_id: pendidikanId, pekerjaan_id: pekerjaanId,
    golongan_darah: null, status_perkawinan: null, alamat: "Jl. Uji Impor", rt: "001", rw: "003", desa_kelurahan: "Duren Tiga",
    kecamatan: "Pancoran", kabupaten_kota: "Jakarta Selatan", provinsi: "DKI Jakarta", kode_pos: "12760", ...ubah,
  });
}

const kepala = (nomor: number, ubah: Partial<Record<keyof BarisImpor, unknown>> = {}) =>
  baris(nomor, { hubungan_keluarga: "KEPALA_KELUARGA", ...ubah });

async function mulai(user: Pengguna, ubah: Partial<MulaiImpor> = {}): Promise<string> {
  return mulaiImpor(user, { aksi: "mulai", nama_file: "uji.xlsx", total_baris: 10, mapping: { nik: "NIK" }, gagal_klien: [], alias: [], ...ubah });
}

const hitung = async () => ({
  warga: await prisma.warga.count({ where: { nik: { startsWith: "99900097" } } }),
  kk: await prisma.kartuKeluarga.count({ where: { no_kk: { startsWith: "99901097" } } }),
});

async function bersihkan() {
  await prisma.warga.deleteMany({ where: { nik: { startsWith: "99900097" } } });
  await prisma.kartuKeluarga.deleteMany({ where: { no_kk: { startsWith: "99901097" } } });
  const pengguna = await prisma.user.findMany({ where: { email: { in: [EMAIL_SA, EMAIL_RW] } }, select: { id: true } });
  const ids = pengguna.map((p) => p.id);
  await prisma.importBatch.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.activityLog.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.wilayah.deleteMany({ where: { rw: "097" } });
}

async function buatPengguna(email: string, role: "SUPER_ADMIN" | "ADMIN_RW"): Promise<Pengguna> {
  const u = await prisma.user.create({ data: { nama: "Penguji Impor", email, role, status: "AKTIF", rw: role === "ADMIN_RW" ? "003" : null } });
  return { id: u.id, nama: u.nama, email, role, wilayah_id: null, rw: u.rw, warga_id: null };
}

describe("Import Excel ke database (integrasi, PRD 7.5)", () => {
  beforeAll(async () => {
    await bersihkan();
    sa = await buatPengguna(EMAIL_SA, "SUPER_ADMIN");
    adminRw = await buatPengguna(EMAIL_RW, "ADMIN_RW");
    pendidikanId = (await prisma.refPendidikan.findFirstOrThrow()).id;
    pekerjaanId = (await prisma.refPekerjaan.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await bersihkan();
    await prisma.$disconnect();
  });

  it("mengimpor file yang sama dua kali tidak menggandakan warga maupun KK (mode perbarui)", async () => {
    const isi = [kepala(1), baris(2), baris(3, { no_kk: noKk(2), hubungan_keluarga: "KEPALA_KELUARGA" })];
    const id = await mulai(sa);

    const pertama = await prosesBatch(sa, id, "perbarui", isi);
    expect(pertama).toMatchObject({ berhasil: 3, dilewati: 0, gagal: [] });
    expect(await hitung()).toEqual({ warga: 3, kk: 2 });

    const kedua = await prosesBatch(sa, id, "perbarui", isi);
    expect(kedua).toMatchObject({ berhasil: 3, dilewati: 0, gagal: [] });
    expect(await hitung()).toEqual({ warga: 3, kk: 2 });
  });

  it("mode lewati menghitung NIK yang sudah ada sebagai dilewati dan tidak mengubahnya", async () => {
    const id = await mulai(sa);
    const hasil = await prosesBatch(sa, id, "lewati", [kepala(1, { nama_lengkap: "Nama Baru" }), baris(2)]);
    expect(hasil).toMatchObject({ berhasil: 0, dilewati: 2, gagal: [] });
    expect((await prisma.warga.findUniqueOrThrow({ where: { nik: nik(1) } })).nama_lengkap).toBe("Uji Impor 1");
  });

  it("mode perbarui mengubah data tetapi tidak menghapus kolom opsional yang kosong di file", async () => {
    const id = await mulai(sa);
    await prosesBatch(sa, id, "perbarui", [kepala(1, { nama_lengkap: "Nama Diperbarui", tempat_lahir: "", agama: null })]);
    const w = await prisma.warga.findUniqueOrThrow({ where: { nik: nik(1) } });
    expect(w).toMatchObject({ nama_lengkap: "Nama Diperbarui", tempat_lahir: "Jakarta", agama: "ISLAM" });
  });

  it("batch yang gagal di tengah tidak meninggalkan data setengah jadi", async () => {
    const sebelum = await hitung();
    const id = await mulai(sa);
    // KK pertama valid; KK kedua memakai pendidikan_id yang tidak ada, sehingga database menolaknya (FK) setelah KK pertama ditulis.
    const rusak = [
      kepala(11, { no_kk: noKk(11) }),
      baris(12, { no_kk: noKk(11) }),
      kepala(13, { no_kk: noKk(12), pendidikan_id: "11111111-1111-4111-8111-111111111111" }),
    ];
    const hasil = await prosesBatch(sa, id, "perbarui", rusak);

    expect(hasil.berhasil).toBe(0);
    expect(hasil.gagal.map((g) => g.nomor)).toEqual([11, 12, 13]);
    expect(await hitung()).toEqual(sebelum);
    expect(await prisma.kartuKeluarga.count({ where: { no_kk: noKk(11) } })).toBe(0);

    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id } });
    expect(batch).toMatchObject({ baris_berhasil: 0, baris_gagal: 3 });
  });

  it("baris yang bentrok aturan bisnis dilewati sendirian, baris lain di batch tetap tersimpan", async () => {
    const id = await mulai(sa);
    // KK 1 sudah punya Kepala Keluarga (nik 1); kepala kedua ditolak, anggota baru tetap masuk.
    const hasil = await prosesBatch(sa, id, "perbarui", [kepala(21), baris(22)]);
    expect(hasil.berhasil).toBe(1);
    expect(hasil.gagal).toEqual([{ nomor: 21, pesan: "KK ini sudah punya Kepala Keluarga lain" }]);
    expect(await prisma.warga.count({ where: { nik: nik(22) } })).toBe(1);
    expect(await prisma.warga.count({ where: { nik: nik(21) } })).toBe(0);
  });

  it("membuat wilayah baru bila RT/RW belum ada di master (Super Admin)", async () => {
    const id = await mulai(sa);
    const hasil = await prosesBatch(sa, id, "perbarui", [kepala(31, { no_kk: noKk(31), rw: "097", rt: "001" })]);
    expect(hasil.berhasil).toBe(1);
    expect(await prisma.wilayah.count({ where: { rw: "097", rt: "001" } })).toBe(1);
  });

  it("Admin RW tidak bisa mengimpor ke RW lain, tetapi bisa ke RW-nya", async () => {
    const id = await mulai(adminRw);
    const hasil = await prosesBatch(adminRw, id, "perbarui", [
      kepala(41, { no_kk: noKk(41), rw: "097", rt: "002" }),
      kepala(42, { no_kk: noKk(42) }),
    ]);
    expect(hasil.berhasil).toBe(1);
    expect(hasil.gagal).toEqual([{ nomor: 41, pesan: "RW 097 di luar cakupan Anda" }]);
    expect(await prisma.wilayah.count({ where: { rw: "097", rt: "002" } })).toBe(0);
  });

  it("Admin RW tidak bisa memperbarui warga di RW lain", async () => {
    const id = await mulai(sa);
    await prosesBatch(sa, id, "perbarui", [kepala(51, { no_kk: noKk(51), rw: "097", rt: "003" })]);
    const idRw = await mulai(adminRw);
    const hasil = await prosesBatch(adminRw, idRw, "perbarui", [kepala(51, { no_kk: noKk(51), nama_lengkap: "Diubah Paksa" })]);
    expect(hasil.berhasil).toBe(0);
    expect(hasil.gagal).toHaveLength(1);
    expect((await prisma.warga.findUniqueOrThrow({ where: { nik: nik(51) } })).nama_lengkap).toBe("Uji Impor 51");
  });

  it("batch milik pengguna lain atau yang sudah selesai ditolak", async () => {
    const id = await mulai(sa);
    await expect(prosesBatch(adminRw, id, "perbarui", [baris(61)])).rejects.toThrow(GalatBatch);
    await selesaiImpor(sa, id);
    await expect(prosesBatch(sa, id, "perbarui", [baris(61)])).rejects.toThrow(GalatBatch);
    await expect(selesaiImpor(sa, id)).rejects.toThrow(GalatBatch);
  });

  it("mencatat import_batches dan activity_logs tanpa NIK, No KK, atau tanggal lahir", async () => {
    const id = await mulai(sa, { total_baris: 3, mapping: { nik: "NIK", no_kk: "No KK" }, gagal_klien: [{ nomor: 9, pesan: "NIK bukan 16 digit" }] });
    await prosesBatch(sa, id, "perbarui", [kepala(71, { no_kk: noKk(71) }), baris(72, { no_kk: noKk(71) })]);
    const ringkasan = await selesaiImpor(sa, id);
    expect(ringkasan).toEqual({ berhasil: 2, dilewati: 0, gagal: 1 });

    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id } });
    expect(batch).toMatchObject({ status: "SELESAI", total_baris: 3, baris_berhasil: 2, baris_gagal: 1, nama_file: "uji.xlsx" });
    expect(batch.errors).toEqual({ gagal: [{ nomor: 9, pesan: "NIK bukan 16 digit" }], dilewati: 0 });

    const log = await prisma.activityLog.findMany({ where: { entitas: "import_batches", entitas_id: id }, orderBy: { created_at: "asc" } });
    expect(log.map((l) => l.aksi)).toEqual(["IMPORT_MULAI", "IMPORT_SELESAI"]);
    const teks = JSON.stringify(log) + JSON.stringify(batch.errors);
    expect(teks).not.toContain("99900097");
    expect(teks).not.toContain("99901097");
    expect(teks).not.toContain("1980-01-01");
  });

  it("import yang semua barisnya gagal berstatus GAGAL", async () => {
    const id = await mulai(sa, { total_baris: 1, gagal_klien: [{ nomor: 2, pesan: "Nama kosong" }] });
    await selesaiImpor(sa, id);
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id } })).status).toBe("GAGAL");
  });

  it("menyimpan pemetaan manual sebagai alias master dan tidak menggandakannya", async () => {
    const lama = await prisma.refPendidikan.findUniqueOrThrow({ where: { id: pendidikanId } });
    const aliasUji = "uji impor alias xyz";
    try {
      await mulai(sa, { alias: [{ jenis: "pendidikan", id: pendidikanId, teks: aliasUji }] });
      await mulai(sa, { alias: [{ jenis: "pendidikan", id: pendidikanId, teks: aliasUji.toUpperCase() }] });
      const baru = await prisma.refPendidikan.findUniqueOrThrow({ where: { id: pendidikanId } });
      const alias = (baru.alias as string[]).filter((a) => a.toLowerCase() === aliasUji);
      expect(alias).toHaveLength(1);
    } finally {
      await prisma.refPendidikan.update({ where: { id: pendidikanId }, data: { alias: lama.alias ?? [] } });
    }
  });

  it("mappingTerakhir mengembalikan mapping import SELESAI terbaru", async () => {
    const id = await mulai(sa, { mapping: { nik: "NIK Uji Terakhir" } });
    await prosesBatch(sa, id, "perbarui", [kepala(81, { no_kk: noKk(81) })]);
    await selesaiImpor(sa, id);
    expect(await mappingTerakhir()).toEqual({ nik: "NIK Uji Terakhir" });
  });
});
