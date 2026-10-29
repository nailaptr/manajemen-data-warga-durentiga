import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { bagiBatch } from "@/lib/import/batch";
import { buatDaftarGagal, buatTemplate } from "@/lib/import/berkas";
import { prosesImpor } from "@/lib/import";
import { deteksiMapping, gabungkanMapping } from "@/lib/import/mapping";
import { MAPPING_TEMPLATE } from "@/lib/import/normalize";
import { parseBerkas } from "@/lib/import/parse";
import type { HasilParse, MasterImpor } from "@/lib/import/types";
import { barisImporSchema, permintaanImporSchema } from "@/lib/validators/impor";

const MASTER: MasterImpor = { pendidikan: [], pekerjaan: [], wilayah: [{ rw: "003", rt: "001" }] };

describe("deteksi mapping kolom (PRD 7.1 langkah 2)", () => {
  it("mengenali header template persis", () => {
    const header = Object.values(MAPPING_TEMPLATE);
    expect(deteksiMapping(header)).toEqual(MAPPING_TEMPLATE);
  });

  it("mengenali sinonim umum dan mengabaikan kolom asing", () => {
    const m = deteksiMapping(["No. KK", "NIK", "Nama", "JK", "Tgl Lahir", "SHDK", "Catatan", "Kab/Kota"]);
    expect(m).toMatchObject({ no_kk: "No. KK", nik: "NIK", nama_lengkap: "Nama", jenis_kelamin: "JK", tanggal_lahir: "Tgl Lahir", hubungan_keluarga: "SHDK", kabupaten_kota: "Kab/Kota" });
    expect(Object.values(m)).not.toContain("Catatan");
  });

  it("mapping tersimpan menang, tetapi hanya untuk kolom yang ada di file", () => {
    const header = ["NIK", "Nama Warga", "Pendidikan"];
    const awal = deteksiMapping(header);
    const hasil = gabungkanMapping(awal, { nama_lengkap: "nama warga", pekerjaan: "Kolom Tak Ada" }, header);
    expect(hasil.nama_lengkap).toBe("Nama Warga");
    expect(hasil.pekerjaan).toBeUndefined();
  });

  it("tanpa mapping tersimpan, hasil deteksi dipakai apa adanya", () => {
    const awal = deteksiMapping(["NIK"]);
    expect(gabungkanMapping(awal, null, ["NIK"])).toBe(awal);
  });
});

describe("pembagian batch 200 baris (PRD 7.5)", () => {
  const kkDengan = (n: number, ukuran: number) =>
    prosesImpor(
      {
        header: ["No KK", "NIK", "Nama lengkap", "Jenis kelamin", "Tanggal lahir", "Hubungan keluarga", "RT", "RW"],
        baris: Array.from({ length: ukuran }, (_, i) => ({
          nomor: i + 2,
          sel: [`999000000${String(n).padStart(7, "0")}`,`9990001503${String(n * 1000 + i).padStart(6, "0")}`, "Uji", "L", "15/03/1980", i === 0 ? "Kepala Keluarga" : "Anak", "001", "003"],
        })),
      },
      MAPPING_TEMPLATE,
      MASTER,
      "2026-10-29",
    ).kk;

  it("tidak memecah satu KK antar batch dan tiap batch maksimal ukuran yang diminta", () => {
    const kk = [...kkDengan(1, 4), ...kkDengan(2, 4), ...kkDengan(3, 4)];
    const batch = bagiBatch(kk, 10);
    expect(batch.map((b) => b.length)).toEqual([8, 4]);
    for (const b of batch) {
      const perKk = new Map<string, number>();
      for (const r of b) perKk.set(r.no_kk, (perKk.get(r.no_kk) ?? 0) + 1);
      expect([...perKk.values()].every((n) => n === 4)).toBe(true);
    }
  });

  it("KK yang lebih besar dari batch menjadi batch sendiri", () => {
    const batch = bagiBatch(kkDengan(1, 12), 5);
    expect(batch.map((b) => b.length)).toEqual([12]);
  });

  it("tidak ada KK menghasilkan tidak ada batch", () => {
    expect(bagiBatch([])).toEqual([]);
  });
});

describe("kontrak request import (validasi server)", () => {
  const dasar = {
    nomor: 2, no_kk: "9990000000000010", nik: "9990001503800001", nama_lengkap: "Uji", jenis_kelamin: "L", tanggal_lahir: "1980-03-15",
    hubungan_keluarga: "KEPALA_KELUARGA", tempat_lahir: "", alamat: "", rt: "001", rw: "003", desa_kelurahan: "", kecamatan: "",
    kabupaten_kota: "", provinsi: "", kode_pos: "",
  };

  it("menerima baris minimal dan menormalkan nilai opsional menjadi null", () => {
    expect(barisImporSchema.parse(dasar)).toMatchObject({ agama: null, pendidikan_id: null, golongan_darah: null });
  });

  it.each([
    ["NIK 15 digit", { nik: "999000150380001" }],
    ["No KK berisi huruf", { no_kk: "99900000000000AB" }],
    ["tanggal mustahil", { tanggal_lahir: "1980-02-31" }],
    ["tanggal di masa depan", { tanggal_lahir: "2999-01-01" }],
    ["RT satu digit", { rt: "1" }],
    ["hubungan tak dikenal", { hubungan_keluarga: "TETANGGA" }],
    ["pendidikan_id bukan uuid", { pendidikan_id: "abc" }],
  ])("menolak %s", (_nama, ubah) => {
    expect(barisImporSchema.safeParse({ ...dasar, ...ubah }).success).toBe(false);
  });

  it("menolak batch lebih dari 200 baris dan aksi tak dikenal", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(permintaanImporSchema.safeParse({ aksi: "proses", id, mode: "lewati", baris: Array(201).fill(dasar) }).success).toBe(false);
    expect(permintaanImporSchema.safeParse({ aksi: "proses", id, mode: "lewati", baris: [dasar] }).success).toBe(true);
    expect(permintaanImporSchema.safeParse({ aksi: "hapus", id }).success).toBe(false);
  });
});

describe("berkas unduhan (PRD 7.1 langkah 1 dan 4)", () => {
  it("template memuat semua kolom PRD 7.2, bisa dibaca parser, dan NIK/No KK tetap teks", () => {
    const hasil = parseBerkas(buatTemplate());
    expect(hasil.header).toEqual(Object.values(MAPPING_TEMPLATE));
    expect(deteksiMapping(hasil.header)).toEqual(MAPPING_TEMPLATE);
    const baris = prosesImpor(hasil, MAPPING_TEMPLATE, MASTER, "2026-10-29").baris;
    expect(baris[0]?.data.nik).toBe("9990001503800001");
    expect(baris[0]?.data.tanggal_lahir).toBe("1980-03-15");
  });

  it("daftar gagal berisi baris asli dan kolom Masalah, hanya untuk baris yang gagal", () => {
    const hasil: HasilParse = {
      header: ["NIK", "Nama"],
      baris: [
        { nomor: 2, sel: ["9990001503800001", "Baik"] },
        { nomor: 3, sel: ["999", "Rusak"] },
      ],
    };
    const buku = XLSX.read(buatDaftarGagal(hasil, [{ nomor: 3, pesan: "NIK bukan 16 digit" }, { nomor: 3, pesan: "Nama aneh" }]), { type: "array" });
    const sel = XLSX.utils.sheet_to_json<string[]>(buku.Sheets[buku.SheetNames[0] ?? ""] ?? {}, { header: 1 });
    expect(sel).toEqual([["NIK", "Nama", "Masalah"], ["999", "Rusak", "NIK bukan 16 digit; Nama aneh"]]);
  });
});
