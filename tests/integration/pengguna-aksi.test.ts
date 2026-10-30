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
import {
  resetSandiPengurusAksi,
  setujuiKlaimAksi,
  tambahPengurusAksi,
  tolakKlaimAksi,
  ubahStatusPengurusAksi,
} from "@/app/(pengurus)/pengguna/actions";

const EMAIL = "uji-aksi-pengguna@contoh.test";
const ID_ACAK = "00000000-0000-4000-8000-000000000000";
let userId = "";

describe("Aksi Pengguna: peran dan input (FR-USR-01, FR-USR-02)", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    userId = await buatAkunAktif({ nama: "Uji Aksi Pengguna", email: EMAIL, kataSandi: "Sandi-Uji-12345", role: "KETUA_RT" });
    vi.spyOn(auth.api, "getSession").mockResolvedValue({ user: { id: userId } } as never);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  it("Ketua RT ditolak untuk semua aksi kelola akun pengurus", async () => {
    const sebelum = await prisma.user.count();
    await expect(tambahPengurusAksi({ nama: "X", email: "uji-aksi-x@contoh.test", role: "KETUA_RT" })).rejects.toThrow("REDIRECT:/tidak-berwenang");
    await expect(ubahStatusPengurusAksi(ID_ACAK, "NONAKTIF")).rejects.toThrow("REDIRECT:/tidak-berwenang");
    await expect(resetSandiPengurusAksi(ID_ACAK)).rejects.toThrow("REDIRECT:/tidak-berwenang");
    expect(await prisma.user.count()).toBe(sebelum);
  });

  it("Warga ditolak untuk antrean klaim", async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: "WARGA" } });
    await expect(setujuiKlaimAksi(ID_ACAK)).rejects.toThrow("REDIRECT:/tidak-berwenang");
    await expect(tolakKlaimAksi(ID_ACAK, {})).rejects.toThrow("REDIRECT:/tidak-berwenang");
  });

  it("Ketua RT lolos peran untuk klaim; id tidak valid dan klaim yang tidak ada dijawab galat", async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: "KETUA_RT" } });
    expect(await setujuiKlaimAksi("bukan-uuid")).toEqual({ ok: false, galat: "Data tidak ditemukan" });
    expect(await setujuiKlaimAksi(ID_ACAK)).toEqual({ ok: false, galat: "Klaim tidak ditemukan atau sudah diproses." });
    expect(await tolakKlaimAksi(ID_ACAK, { alasan: "x".repeat(201) })).toEqual({ ok: false, galat: "Alasan maksimal 200 karakter" });
  });

  it("Admin RW: input tidak valid dijawab pesan Zod tanpa menyentuh database", async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN_RW", rw: "003" } });
    expect(await tambahPengurusAksi({ nama: "", email: "uji-aksi-y@contoh.test", role: "KETUA_RT" })).toEqual({ ok: false, galat: "Nama wajib diisi" });
    expect(await tambahPengurusAksi({ nama: "Y", email: "uji-aksi-y@contoh.test", role: "KETUA_RT", wilayah_id: "" })).toEqual({ ok: false, galat: "RT wajib dipilih" });
    expect(await prisma.user.count({ where: { email: "uji-aksi-y@contoh.test" } })).toBe(0);
  });
});
