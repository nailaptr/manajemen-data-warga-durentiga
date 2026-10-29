import { describe, expect, it } from "vitest";
import { cocokkanMaster, normalisasiRtRw, normalisasiTanggal } from "@/lib/import/normalize";

const PENDIDIKAN = [
  { id: "p-sd", nama: "SD", alias: ["SD/Sederajat"] },
  { id: "p-sma", nama: "SMA", alias: ["SMA/Sederajat"] },
  { id: "p-tamat-sd", nama: "Tamat SD", alias: [] },
];

describe("pola Excel nyata (data fiktif)", () => {
  it("membaca tanggal dd-Mon-yy dan dd-Mon-yyyy", () => {
    expect(normalisasiTanggal("12-Mar-07")).toBe("2007-03-12");
    expect(normalisasiTanggal("05-Mar-85")).toBe("1985-03-05");
    expect(normalisasiTanggal("1-mar-1990")).toBe("1990-03-01");
    expect(normalisasiTanggal("17-Agu-95")).toBe("1995-08-17");
    expect(normalisasiTanggal("17 Des 1999")).toBe("1999-12-17");
  });

  it("menolak tanggal dd-Mon-yy yang tidak sah", () => {
    expect(normalisasiTanggal("31-Feb-07")).toBeNull();
    expect(normalisasiTanggal("12-Xyz-07")).toBeNull();
  });

  it('"Tamat SMA" cocok dengan master SMA', () => {
    expect(cocokkanMaster("Tamat SMA", PENDIDIKAN)).toBe("p-sma");
    expect(cocokkanMaster("  lulusan  sma/sederajat", PENDIDIKAN)).toBe("p-sma");
  });

  it("nama master utuh didahulukan daripada awalan dibuang", () => {
    expect(cocokkanMaster("Tamat SD", PENDIDIKAN)).toBe("p-tamat-sd");
  });

  it("nilai yang tetap tak dikenal setelah awalan dibuang menghasilkan null", () => {
    expect(cocokkanMaster("Tamat Sekolah Alien", PENDIDIKAN)).toBeNull();
    expect(cocokkanMaster("Tamat", PENDIDIKAN)).toBeNull();
  });

  it('kolom RT "RT 02" menjadi 002', () => {
    expect(normalisasiRtRw("RT 02")).toBe("002");
    expect(normalisasiRtRw("rt.2")).toBe("002");
  });
});
