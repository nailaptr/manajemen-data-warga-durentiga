import { describe, expect, it } from "vitest";
import { adaFilter, filterKeQuery } from "@/lib/filter-url";
import { parseFilter } from "@/lib/filters";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("filterKeQuery (FR-DSB-05)", () => {
  it("filter kosong menghasilkan query kosong", () => {
    expect(filterKeQuery({})).toBe("");
    expect(adaFilter({ pendidikan: [], rt: [] })).toBe(false);
  });

  it("nilai jamak digabung koma dan usia 0 tetap ikut", () => {
    const q = filterKeQuery({ pendidikan: [UUID], jk: ["L", "P"], rt: ["001"], usia_min: 0, usia_max: 20 });
    expect(new URLSearchParams(q).get("jk")).toBe("L,P");
    expect(new URLSearchParams(q).get("usia_min")).toBe("0");
    expect(adaFilter({ usia_min: 0 })).toBe(true);
  });

  it("hasilnya dibaca kembali oleh parseFilter tanpa perubahan", () => {
    const awal = { pendidikan: [UUID], pekerjaan: [], jk: ["P" as const], kategori: [UUID], rt: ["001", "002"], usia_min: 18, usia_max: 20 };
    const hasil = parseFilter(Object.fromEntries(new URLSearchParams(filterKeQuery(awal))));
    expect(hasil.ok && hasil.filter).toEqual(awal);
  });
});
