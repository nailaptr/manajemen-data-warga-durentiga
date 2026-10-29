import { describe, expect, it } from "vitest";
import { maskNomor } from "@/lib/mask";

describe("maskNomor (FR-WRG-06)", () => {
  it("menampilkan 4 digit awal dan 4 digit akhir NIK", () => {
    expect(maskNomor("3174012345671190")).toBe("3174●●●●●●●●1190");
  });

  it("menampilkan format yang sama untuk No KK", () => {
    expect(maskNomor("3174011234560001")).toBe("3174●●●●●●●●0001");
  });

  it("tidak membocorkan digit tengah", () => {
    const hasil = maskNomor("3174012345671190");
    expect(hasil).not.toContain("0123");
    expect(hasil).not.toContain("4567");
    expect(hasil).toHaveLength(16);
  });

  it("menutup seluruh nomor yang bukan 16 digit tanpa menampilkan satu digit pun", () => {
    expect(maskNomor("12345")).toBe("●●●●●");
    expect(maskNomor("317401234567119012")).toBe("●".repeat(18));
    expect(maskNomor("")).toBe("");
  });
});
