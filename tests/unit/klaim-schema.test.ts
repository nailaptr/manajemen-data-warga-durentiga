import { describe, expect, it } from "vitest";
import { tahanSampai } from "@/lib/klaim-limit";
import { KATA_SANDI_MIN, klaimSchema } from "@/lib/validators/klaim";

const valid = {
  email: "  Warga@Contoh.Test ",
  kata_sandi: "sandi-uji-1",
  nik: "9991100000000001",
  no_kk: "9991200000000001",
  tanggal_lahir: "15/05/1990",
  setuju: true,
};

describe("klaimSchema (PRD 3.1)", () => {
  it("menerima isian lengkap, mengubah email ke huruf kecil dan tanggal ke YYYY-MM-DD", () => {
    const hasil = klaimSchema.parse(valid);
    expect(hasil.email).toBe("warga@contoh.test");
    expect(hasil.tanggal_lahir).toBe("1990-05-15");
  });

  it(`kata sandi minimal ${KATA_SANDI_MIN} karakter`, () => {
    expect(klaimSchema.safeParse({ ...valid, kata_sandi: "123456789" }).success).toBe(false);
    expect(klaimSchema.safeParse({ ...valid, kata_sandi: "1234567890" }).success).toBe(true);
  });

  it("NIK dan No KK harus 16 digit angka", () => {
    expect(klaimSchema.safeParse({ ...valid, nik: "123" }).success).toBe(false);
    expect(klaimSchema.safeParse({ ...valid, no_kk: "99912000000000ab" }).success).toBe(false);
  });

  it("menolak tanggal yang tidak ada di kalender atau berformat lain", () => {
    expect(klaimSchema.safeParse({ ...valid, tanggal_lahir: "31/02/1990" }).success).toBe(false);
    expect(klaimSchema.safeParse({ ...valid, tanggal_lahir: "1990-05-15" }).success).toBe(false);
  });

  it("persetujuan kebijakan privasi wajib dicentang", () => {
    expect(klaimSchema.safeParse({ ...valid, setuju: false }).success).toBe(false);
  });
});

describe("tahanSampai (lantai waktu respons)", () => {
  it("menunggu sampai lantai tercapai", async () => {
    const mulai = Date.now();
    await tahanSampai(mulai, 60);
    expect(Date.now() - mulai).toBeGreaterThanOrEqual(55);
  });

  it("tidak menunggu bila lantai sudah terlewati", async () => {
    const mulai = Date.now();
    await tahanSampai(mulai - 1000, 60);
    expect(Date.now() - mulai).toBeLessThan(40);
  });
});
