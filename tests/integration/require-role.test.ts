import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { auth, requireRole } from "@/lib/auth";
import { buatAkunAktif } from "@/lib/akun";
import { prisma } from "@/lib/db";

const EMAIL = "uji-role@contoh.test";
let userId = "";

// getSession Better Auth diganti agar tes tidak bergantung pada cookie; peran dan status
// tetap dibaca dari database oleh requireRole.
function sesiAktif(id: string | null) {
  vi.spyOn(auth.api, "getSession").mockResolvedValue(id ? ({ user: { id } } as never) : null);
}

describe("requireRole (FR-AUTH)", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    userId = await buatAkunAktif({ nama: "Uji Role", email: EMAIL, kataSandi: "Sandi-Uji-12345", role: "KETUA_RT" });
  });

  beforeEach(async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: "KETUA_RT", status: "AKTIF" } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  it("mengalihkan ke /masuk bila belum masuk", async () => {
    sesiAktif(null);
    await expect(requireRole("KETUA_RT")).rejects.toThrow("REDIRECT:/masuk");
  });

  it("mengalihkan ke /tidak-berwenang bila peran tidak termasuk", async () => {
    sesiAktif(userId);
    await expect(requireRole("SUPER_ADMIN", "ADMIN_RW")).rejects.toThrow("REDIRECT:/tidak-berwenang");
  });

  it("mengembalikan pengguna bila peran cocok", async () => {
    sesiAktif(userId);
    const pengguna = await requireRole("ADMIN_RW", "KETUA_RT");
    expect(pengguna.id).toBe(userId);
    expect(pengguna.role).toBe("KETUA_RT");
  });

  it("memakai peran terbaru dari database, bukan dari sesi", async () => {
    sesiAktif(userId);
    await prisma.user.update({ where: { id: userId }, data: { role: "WARGA" } });
    await expect(requireRole("KETUA_RT")).rejects.toThrow("REDIRECT:/tidak-berwenang");
  });

  it("menolak akun yang sudah dinonaktifkan walau sesinya masih ada", async () => {
    sesiAktif(userId);
    await prisma.user.update({ where: { id: userId }, data: { status: "NONAKTIF" } });
    await expect(requireRole("KETUA_RT")).rejects.toThrow("REDIRECT:/masuk");
  });
});
