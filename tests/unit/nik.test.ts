import { describe, expect, it } from "vitest";
import { nikCocokTanggalLahir } from "@/lib/nik";

// NIK uji berawalan 999: digit ke-7..12 = DDMMYY.
describe("nikCocokTanggalLahir (BR-10)", () => {
  it("cocok untuk laki-laki bila DDMMYY sama dengan tanggal lahir", () => {
    expect(nikCocokTanggalLahir("9990001207900001", "1990-07-12", "L")).toBe(true);
  });

  it("perempuan memakai tanggal + 40", () => {
    expect(nikCocokTanggalLahir("9990005207900001", "1990-07-12", "P")).toBe(true);
    expect(nikCocokTanggalLahir("9990001207900001", "1990-07-12", "P")).toBe(false);
  });

  it("tidak cocok bila tanggal, bulan, atau tahun berbeda", () => {
    expect(nikCocokTanggalLahir("9990001307900001", "1990-07-12", "L")).toBe(false);
    expect(nikCocokTanggalLahir("9990001208900001", "1990-07-12", "L")).toBe(false);
    expect(nikCocokTanggalLahir("9990001207910001", "1990-07-12", "L")).toBe(false);
  });

  it("mengabaikan abad karena NIK hanya memuat dua digit tahun", () => {
    expect(nikCocokTanggalLahir("9990001207050001", "2005-07-12", "L")).toBe(true);
  });

  it("mengembalikan null (tidak ada peringatan) bila NIK atau tanggal belum lengkap", () => {
    expect(nikCocokTanggalLahir("999000120", "1990-07-12", "L")).toBeNull();
    expect(nikCocokTanggalLahir("9990001207900001", "", "L")).toBeNull();
  });
});
