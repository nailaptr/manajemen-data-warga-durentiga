import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { buatAkunAktif } from "@/lib/akun";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { simpanKategoriUsiaAksi, simpanPendidikanAksi, simpanWilayahAksi } from "@/app/(pengurus)/pengaturan/actions";

const EMAIL = "uji-aksi-pengaturan@contoh.test";
let userId = "";

describe("Aksi Pengaturan: hanya Admin RW dan Super Admin (FR-MST)", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    userId = await buatAkunAktif({ nama: "Uji Aksi", email: EMAIL, kataSandi: "Sandi-Uji-12345", role: "KETUA_RT" });
    vi.spyOn(auth.api, "getSession").mockResolvedValue({ user: { id: userId } } as never);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  it("menolak Ketua RT dan tidak mengubah kategori usia", async () => {
    const sebelum = await prisma.kategoriUsia.count();
    await expect(simpanKategoriUsiaAksi([])).rejects.toThrow("REDIRECT:/tidak-berwenang");
    expect(await prisma.kategoriUsia.count()).toBe(sebelum);
  });

  it("menolak Ketua RT untuk pendidikan dan wilayah", async () => {
    await expect(simpanPendidikanAksi({ nama: "Tidak Boleh", urutan: 1, alias: [] })).rejects.toThrow("REDIRECT:/tidak-berwenang");
    await expect(simpanWilayahAksi({ rw: "003", rt: "095", keterangan: "" })).rejects.toThrow("REDIRECT:/tidak-berwenang");
    expect(await prisma.refPendidikan.count({ where: { nama: "Tidak Boleh" } })).toBe(0);
    expect(await prisma.wilayah.count({ where: { rt: "095" } })).toBe(0);
  });

  it("menolak Warga", async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: "WARGA" } });
    await expect(simpanKategoriUsiaAksi([])).rejects.toThrow("REDIRECT:/tidak-berwenang");
  });

  it("Admin RW lolos peran, input tidak valid dijawab pesan Zod tanpa menyentuh database", async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN_RW", rw: "003" } });
    const hasil = await simpanKategoriUsiaAksi([{ nama: "Salah", usia_min: 9, usia_maks: 3, jenis_kelamin: "" }]);
    expect(hasil).toEqual({ ok: false, galat: "Usia maks tidak boleh lebih kecil dari usia min" });
  });
});
