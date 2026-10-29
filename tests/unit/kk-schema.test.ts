import { describe, expect, it } from "vitest";
import { kkSchema, type KkInput } from "@/lib/validators/kk";
import { maskNomor } from "@/lib/mask";

const UUID = "00000000-0000-4000-8000-000000000001";

function anggota(nik: string, hubungan: string): KkInput["anggota"][number] {
  return {
    hubungan_keluarga: hubungan, nik, nama_lengkap: "Warga Uji", jenis_kelamin: "L",
    tempat_lahir: "Jakarta", tanggal_lahir: "1990-01-01", agama: "ISLAM",
    pendidikan_id: UUID, pekerjaan_id: UUID, golongan_darah: "", status_perkawinan: "",
  } as KkInput["anggota"][number];
}

function kk(anggotaList: KkInput["anggota"], noKk = "9990000000000010"): KkInput {
  return {
    no_kk: noKk, alamat: "Jl. Uji", rt: "001", rw: "003", kode_pos: "", desa_kelurahan: "Duren Tiga",
    kecamatan: "Pancoran", kabupaten_kota: "Jakarta Selatan", provinsi: "", anggota: anggotaList,
  };
}

const pesan = (r: ReturnType<typeof kkSchema.safeParse>) => (r.success ? [] : r.error.issues.map((i) => i.message));

describe("skema KK", () => {
  it("menerima KK dengan kepala keluarga sebagai anggota pertama", () => {
    const r = kkSchema.safeParse(kk([anggota("9990000000000011", "KEPALA_KELUARGA"), anggota("9990000000000012", "ANAK")]));
    expect(r.success).toBe(true);
  });

  it("menolak anggota pertama yang bukan Kepala Keluarga (BR-02)", () => {
    const r = kkSchema.safeParse(kk([anggota("9990000000000011", "ANAK")]));
    expect(pesan(r)).toContain("Anggota pertama wajib Kepala Keluarga");
  });

  it("menolak dua Kepala Keluarga dalam satu KK (BR-02)", () => {
    const r = kkSchema.safeParse(
      kk([anggota("9990000000000011", "KEPALA_KELUARGA"), anggota("9990000000000012", "KEPALA_KELUARGA")]),
    );
    expect(pesan(r)).toContain("Satu KK hanya punya satu Kepala Keluarga");
  });

  it.each([["999000000000001"], ["99900000000000123"], ["99900000000000AB"], ["9990000000000 11"]])(
    "menolak NIK bukan 16 digit angka: %s (BR-03)",
    (nik) => {
      const r = kkSchema.safeParse(kk([anggota(nik, "KEPALA_KELUARGA")]));
      expect(pesan(r)).toContain("NIK harus 16 digit angka");
    },
  );

  it("menolak No KK bukan 16 digit angka (BR-03)", () => {
    const r = kkSchema.safeParse(kk([anggota("9990000000000011", "KEPALA_KELUARGA")], "12345"));
    expect(pesan(r)).toContain("No KK harus 16 digit angka");
  });

  it("menolak NIK ganda di dalam form", () => {
    const r = kkSchema.safeParse(kk([anggota("9990000000000011", "KEPALA_KELUARGA"), anggota("9990000000000011", "ANAK")]));
    expect(pesan(r)).toContain("NIK ganda dalam form");
  });

  it("menolak KK tanpa anggota (BR-01)", () => {
    expect(pesan(kkSchema.safeParse(kk([])))).toContain("Minimal satu anggota");
  });
});

describe("maskNomor", () => {
  it("menampilkan 4 digit awal dan 4 digit akhir", () => {
    expect(maskNomor("3174012345671190")).toBe("3174●●●●●●●●1190");
  });
});
