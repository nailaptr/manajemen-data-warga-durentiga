import { describe, expect, it } from "vitest";
import { wargaSchema, type WargaInput } from "@/lib/validators/warga";

const UUID = "00000000-0000-4000-8000-000000000001";

function warga(ubah: Partial<Record<keyof WargaInput, string>> = {}): WargaInput {
  return {
    kartu_keluarga_id: UUID, hubungan_keluarga: "ANAK", nik: "9990000000900011", nama_lengkap: "Warga Uji",
    jenis_kelamin: "L", tempat_lahir: "Jakarta", tanggal_lahir: "1990-01-01", agama: "ISLAM",
    pendidikan_id: UUID, pekerjaan_id: UUID, golongan_darah: "", status_perkawinan: "",
    status_kependudukan: "AKTIF", tanggal_status: "", ...ubah,
  } as WargaInput;
}

const pesan = (r: ReturnType<typeof wargaSchema.safeParse>) => (r.success ? [] : r.error.issues.map((i) => i.message));

describe("skema Warga (FR-WRG-05)", () => {
  it("menerima warga aktif tanpa tanggal status", () => {
    const r = wargaSchema.safeParse(warga());
    expect(r.success).toBe(true);
  });

  it("menolak NIK bukan 16 digit (BR-03)", () => {
    expect(pesan(wargaSchema.safeParse(warga({ nik: "999000000090001" })))).toContain("NIK harus 16 digit angka");
  });

  it("menolak tanggal lahir di masa depan", () => {
    const besok = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(pesan(wargaSchema.safeParse(warga({ tanggal_lahir: besok })))).toContain("Tanggal lahir tidak valid");
  });

  it("memangkas spasi berlebih pada nama", () => {
    const r = wargaSchema.safeParse(warga({ nama_lengkap: "  Budi  " }));
    expect(r.success && r.data.nama_lengkap).toBe("Budi");
  });

  it("mewajibkan tanggal kejadian bila status Pindah atau Meninggal", () => {
    expect(pesan(wargaSchema.safeParse(warga({ status_kependudukan: "PINDAH" })))).toContain("Tanggal kejadian wajib diisi");
    expect(wargaSchema.safeParse(warga({ status_kependudukan: "MENINGGAL", tanggal_status: "2026-01-05" })).success).toBe(true);
  });

  it("menolak tanggal kejadian di masa depan", () => {
    const besok = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(pesan(wargaSchema.safeParse(warga({ status_kependudukan: "PINDAH", tanggal_status: besok })))).toContain(
      "Tanggal kejadian tidak boleh di masa depan",
    );
  });

  it("membuang tanggal status bila status kembali Aktif", () => {
    const r = wargaSchema.safeParse(warga({ tanggal_status: "2026-01-05" }));
    expect(r.success && r.data.tanggal_status).toBeUndefined();
  });
});
