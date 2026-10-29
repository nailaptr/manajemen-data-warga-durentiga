import { describe, expect, it } from "vitest";
import { ADMIN } from "@/lib/navigasi";
import { kategoriUsiaSchema, pekerjaanSchema, pendidikanSchema, wilayahSchema } from "@/lib/validators/pengaturan";

const pesan = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : (r.error?.issues.map((i) => i.message) ?? []));

describe("skema Pengaturan (FR-MST)", () => {
  it("hanya Admin RW dan Super Admin yang boleh mengelola Pengaturan", () => {
    expect([...ADMIN].sort()).toEqual(["ADMIN_RW", "SUPER_ADMIN"]);
  });

  it("merapikan alias: pangkas spasi, buang kosong dan ganda (FR-MST-01)", () => {
    const r = pekerjaanSchema.parse({ nama: " Petani ", alias: [" Tani ", "tani", "", "Bertani"] });
    expect(r).toEqual({ nama: "Petani", alias: ["Tani", "Bertani"] });
  });

  it("menolak urutan pendidikan bukan bilangan bulat positif", () => {
    expect(pesan(pendidikanSchema.safeParse({ nama: "SD", urutan: "0", alias: [] }))).toContain("Urutan minimal 1");
    expect(pesan(pendidikanSchema.safeParse({ nama: "SD", urutan: "1.5", alias: [] }))).toContain("Urutan harus bilangan bulat");
  });

  it("menerima kategori usia tanpa batas atas dan jenis kelamin kosong (FR-MST-02)", () => {
    const [k] = kategoriUsiaSchema.parse([{ nama: "Lansia", usia_min: "60", usia_maks: "", jenis_kelamin: "" }]);
    expect(k).toMatchObject({ nama: "Lansia", usia_min: 60, usia_maks: null, jenis_kelamin: null });
  });

  it("menolak usia maks lebih kecil dari usia min", () => {
    const r = kategoriUsiaSchema.safeParse([{ nama: "Salah", usia_min: 10, usia_maks: 5, jenis_kelamin: "" }]);
    expect(pesan(r)).toContain("Usia maks tidak boleh lebih kecil dari usia min");
  });

  it("mengizinkan rentang tumpang tindih tetapi menolak nama ganda", () => {
    const ok = kategoriUsiaSchema.safeParse([
      { nama: "Remaja", usia_min: 12, usia_maks: 17, jenis_kelamin: "" },
      { nama: "Usia subur", usia_min: 15, usia_maks: 49, jenis_kelamin: "P" },
    ]);
    expect(ok.success).toBe(true);
    const ganda = kategoriUsiaSchema.safeParse([
      { nama: "Anak", usia_min: 6, usia_maks: 11, jenis_kelamin: "" },
      { nama: "anak", usia_min: 0, usia_maks: 3, jenis_kelamin: "" },
    ]);
    expect(pesan(ganda)).toContain("Nama kategori ganda: anak");
  });

  it.each([["3"], ["0033"], ["abc"], [""]])("menolak RT/RW bukan 3 digit: %s", (nilai) => {
    expect(wilayahSchema.safeParse({ rw: "003", rt: nilai, keterangan: "" }).success).toBe(false);
  });

  it("mengubah keterangan kosong menjadi null", () => {
    expect(wilayahSchema.parse({ rw: "003", rt: "006", keterangan: "  " }).keterangan).toBeNull();
  });
});
