import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// (AC-05) Warga tidak boleh membuka halaman pengurus. Tiap page.tsx di (pengurus) harus memanggil
// requireRole(...PENGURUS) atau requireRole(...ADMIN) sendiri; jangan hanya mengandalkan layout.
const AKAR = join(process.cwd(), "app", "(pengurus)");

function berkas(dir: string, nama: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return berkas(p, nama);
    return n === nama ? [p] : [];
  });
}

describe("Halaman pengurus menutup akses Warga di server (AC-05)", () => {
  const halaman = berkas(AKAR, "page.tsx");

  it("menemukan halaman pengurus", () => {
    expect(halaman.length).toBeGreaterThan(10);
  });

  for (const p of halaman) {
    it(`${p.slice(AKAR.length + 1)} memanggil requireRole dengan PENGURUS atau ADMIN`, () => {
      const isi = readFileSync(p, "utf8");
      expect(isi).toMatch(/requireRole\(\.\.\.(PENGURUS|ADMIN)\)/);
      expect(isi).not.toMatch(/requireRole\([^)]*"WARGA"/);
    });
  }

  it("layout pengurus memanggil requireRole(...PENGURUS) dan route export menjawab 403 untuk selain PENGURUS", () => {
    expect(readFileSync(join(AKAR, "layout.tsx"), "utf8")).toMatch(/requireRole\(\.\.\.PENGURUS\)/);
    expect(readFileSync(join(process.cwd(), "app", "api", "export", "route.ts"), "utf8")).toMatch(/includes\(user\.role\)\) return galat\("Tidak berwenang", 403\)/);
  });
});
