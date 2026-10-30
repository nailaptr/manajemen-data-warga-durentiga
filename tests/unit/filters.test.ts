import { describe, expect, it } from "vitest";
import { hariJakarta, parseFilter } from "@/lib/filters";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function filterDari(params: Parameters<typeof parseFilter>[0]) {
  const hasil = parseFilter(params);
  if (!hasil.ok) throw new Error(hasil.galat);
  return hasil.filter;
}

describe("parseFilter (PRD 6)", () => {
  it("memisahkan nilai jamak dengan koma dan menggabungkan parameter berulang", () => {
    const f = filterDari({ pendidikan: `${UUID_A},${UUID_B}`, rt: ["001", "002"], jk: "P" });
    expect(f.pendidikan).toEqual([UUID_A, UUID_B]);
    expect(f.rt).toEqual(["001", "002"]);
    expect(f.jk).toEqual(["P"]);
  });

  it("parameter yang tidak ada menjadi daftar kosong dan usia tidak terisi", () => {
    const f = filterDari({});
    expect(f).toEqual({ pendidikan: [], pekerjaan: [], jk: [], kategori: [], rt: [], usia_min: undefined, usia_max: undefined });
  });

  it("membaca usia_min dan usia_max sebagai angka, string kosong dianggap tidak diisi", () => {
    expect(filterDari({ usia_min: "18", usia_max: "20" })).toMatchObject({ usia_min: 18, usia_max: 20 });
    expect(filterDari({ usia_min: "", usia_max: "" })).toMatchObject({ usia_min: undefined, usia_max: undefined });
  });

  it("menolak nilai yang tidak valid", () => {
    expect(parseFilter({ pendidikan: "bukan-uuid" }).ok).toBe(false);
    expect(parseFilter({ jk: "X" }).ok).toBe(false);
    expect(parseFilter({ rt: "1" }).ok).toBe(false);
    expect(parseFilter({ usia_min: "-1" }).ok).toBe(false);
    expect(parseFilter({ usia_min: "abc" }).ok).toBe(false);
  });

  it("menolak usia minimal lebih besar dari usia maksimal", () => {
    expect(parseFilter({ usia_min: "30", usia_max: "20" }).ok).toBe(false);
    expect(parseFilter({ usia_min: "20", usia_max: "20" }).ok).toBe(true);
  });

  it("mengabaikan parameter lain di URL", () => {
    expect(parseFilter({ halaman: "2", q: "budi" }).ok).toBe(true);
  });
});

describe("hariJakarta", () => {
  it("memakai tanggal Asia/Jakarta sebagai tengah malam UTC", () => {
    expect(hariJakarta(new Date("2026-06-14T18:00:00Z")).toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(hariJakarta(new Date("2026-06-14T16:59:00Z")).toISOString()).toBe("2026-06-14T00:00:00.000Z");
  });
});
