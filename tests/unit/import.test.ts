import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prosesImpor, type HasilImpor } from "@/lib/import";
import { MAPPING_TEMPLATE } from "@/lib/import/normalize";
import { parseBerkas } from "@/lib/import/parse";
import { BATAS_BARIS, BATAS_UKURAN_BYTE, GalatImpor, type MasterImpor } from "@/lib/import/types";

const HARI_INI = "2026-10-29";

const MASTER: MasterImpor = {
  pendidikan: [
    { id: "p-sma", nama: "SMA", alias: ["SMA/Sederajat", "SLTA"] },
    { id: "p-s1", nama: "D4/S1", alias: ["S1"] },
  ],
  pekerjaan: [
    { id: "k-wiraswasta", nama: "Wiraswasta", alias: [] },
    { id: "k-irt", nama: "Ibu Rumah Tangga", alias: ["IRT"] },
  ],
  wilayah: ["001", "002", "003", "004", "005"].map((rt) => ({ rw: "003", rt })),
};

const muat = (nama: string) => new Uint8Array(readFileSync(`tests/fixtures/import/${nama}`));
const proses = (nama: string, opsi?: { kepalaPertama?: boolean }): HasilImpor =>
  prosesImpor(parseBerkas(muat(nama)), MAPPING_TEMPLATE, MASTER, HARI_INI, opsi);
const pesan = (h: HasilImpor, i: number) => h.baris[i]?.temuan.map((t) => `${t.level}:${t.pesan}`).join(" | ") ?? "";
const adaTemuan = (h: HasilImpor, i: number, level: "error" | "peringatan", teks: RegExp) =>
  h.baris[i]?.temuan.some((t) => t.level === level && teks.test(t.pesan)) ?? false;

describe("parse (PRD 7.1, 7.5)", () => {
  it("membaca CSV bersih dan semua baris valid", () => {
    const h = proses("bersih.csv");
    expect(h.ringkasan).toMatchObject({ total: 2, valid: 2, error: 0, jumlahKk: 1 });
  });

  it("membaca .xlsx dan NIK/No KK tetap teks 16 digit", () => {
    const hasil = parseBerkas(new Uint8Array(readFileSync("docs/data-contoh/warga-contoh.xlsx")));
    const h = prosesImpor(hasil, MAPPING_TEMPLATE, MASTER, HARI_INI);
    expect(h.baris[0]?.data.no_kk).toBe("9990000000000010");
    expect(h.baris[0]?.data.nik).toBe("9990001503800001");
    expect(h.baris[0]?.data.nama_lengkap).toBe("Uji Kepala Sepuluh");
    expect(h.ringkasan.total).toBe(18);
    expect(h.ringkasan.error).toBeGreaterThan(0);
    expect(h.ringkasan.valid).toBeGreaterThan(0);
  });

  it("xlsx contoh: sel angka berformat Umum terbaca sebagai notasi ilmiah (error)", () => {
    const h = prosesImpor(parseBerkas(new Uint8Array(readFileSync("docs/data-contoh/warga-contoh.xlsx"))), MAPPING_TEMPLATE, MASTER, HARI_INI);
    const ilmiah = h.baris.find((b) => b.data.nama_lengkap === "Uji Ilmiah Lima Puluh");
    expect(ilmiah?.temuan.some((t) => t.level === "error" && /notasi ilmiah/.test(t.pesan))).toBe(true);
  });

  it("xlsx contoh: tanggal serial Excel terbaca", () => {
    const h = prosesImpor(parseBerkas(new Uint8Array(readFileSync("docs/data-contoh/warga-contoh.xlsx"))), MAPPING_TEMPLATE, MASTER, HARI_INI);
    expect(h.baris.find((b) => b.data.nama_lengkap === "Uji Istri Sepuluh")?.data.tanggal_lahir).toBe("1985-07-20");
  });

  it("menolak file kosong", () => {
    expect(() => parseBerkas(new Uint8Array(0))).toThrow(GalatImpor);
  });

  it("menolak file hanya berisi header", () => {
    expect(() => parseBerkas(muat("header-saja.csv"))).toThrow(/hanya berisi header/);
  });

  it("menolak file lebih dari 5 MB", () => {
    expect(() => parseBerkas(new Uint8Array(BATAS_UKURAN_BYTE + 1))).toThrow(/5 MB/);
  });

  it("menolak file lebih dari 5.000 baris", () => {
    const isi = ["NIK", ...Array.from({ length: BATAS_BARIS + 1 }, (_, i) => String(i))].join("\n");
    expect(() => parseBerkas(new TextEncoder().encode(isi))).toThrow(/5000 baris/);
  });
});

describe("normalisasi (PRD 7.3)", () => {
  it("menjaga nol di depan No KK dan RT/RW", () => {
    const h = proses("nol-di-depan.csv");
    expect(h.baris[0]?.data.no_kk).toBe("0009990000000012");
    expect(h.baris[0]?.data.rt).toBe("001");
    expect(h.baris[0]?.status).toBe("valid");
  });

  it("RT/RW menjadi 3 digit", () => {
    const h = proses("rt-rw.csv");
    expect(h.baris.map((b) => `${b.data.rt}/${b.data.rw}`)).toEqual(["001/003", "002/003", "009/003"]);
  });

  it("membaca tanggal dd/mm/yyyy, yyyy-mm-dd, dan nomor seri Excel", () => {
    const h = proses("tanggal-campur.csv");
    expect(h.baris.slice(0, 3).map((b) => b.data.tanggal_lahir)).toEqual(["1980-03-15", "1980-03-15", "1980-03-15"]);
  });

  it("varian jenis kelamin menjadi L/P", () => {
    const h = proses("jenis-kelamin.csv");
    expect(h.baris.map((b) => b.data.jenis_kelamin)).toEqual(["L", "L", "L", "P", "P", null]);
  });

  it("memangkas spasi, membuang baris kosong, dan nomor baris mengikuti file", () => {
    const h = proses("spasi-kosong.csv");
    expect(h.baris).toHaveLength(2);
    expect(h.baris[0]?.data.nama_lengkap).toBe("Uji Banyak Spasi");
    expect(h.baris.map((b) => b.data.nomor)).toEqual([2, 5]);
  });

  it("mencocokkan alias pendidikan dan pekerjaan tanpa pandang huruf besar/kecil", () => {
    const h = proses("alias.csv");
    expect(h.baris[0]?.data).toMatchObject({ pendidikan_id: "p-sma", pekerjaan_id: "k-irt" });
  });

  it("mendaftar nilai pendidikan/pekerjaan tak dikenal untuk pemetaan manual", () => {
    const h = proses("alias.csv");
    expect(h.tidakDikenal.pendidikan).toEqual([{ nilai: "Sekolah Alien", jumlah: 1 }]);
    expect(h.tidakDikenal.pekerjaan).toEqual([{ nilai: "Astronot", jumlah: 1 }]);
  });

  it("pemetaan manual mengubah nilai tak dikenal menjadi id master", () => {
    const manual: MasterImpor = { ...MASTER, pemetaanManual: { pendidikan: { "sekolah alien": "p-sma" }, pekerjaan: { astronot: "k-wiraswasta" } } };
    const h = prosesImpor(parseBerkas(muat("alias.csv")), MAPPING_TEMPLATE, manual, HARI_INI);
    expect(h.baris[1]?.data).toMatchObject({ pendidikan_id: "p-sma", pekerjaan_id: "k-wiraswasta" });
    expect(h.tidakDikenal.pendidikan).toEqual([]);
  });
});

describe("validasi Error (PRD 7.4)", () => {
  it("notasi ilmiah pada No KK dan NIK", () => {
    const h = proses("notasi-ilmiah.csv");
    expect(adaTemuan(h, 0, "error", /No KK terbaca notasi ilmiah/)).toBe(true);
    expect(adaTemuan(h, 1, "error", /NIK terbaca notasi ilmiah/)).toBe(true);
  });

  it("NIK bukan 16 digit", () => {
    expect(adaTemuan(proses("nomor-salah.csv"), 0, "error", /NIK bukan 16 digit/)).toBe(true);
  });

  it("No KK bukan 16 digit", () => {
    expect(adaTemuan(proses("nomor-salah.csv"), 1, "error", /No KK bukan 16 digit/)).toBe(true);
  });

  it("nama kosong", () => {
    expect(adaTemuan(proses("nomor-salah.csv"), 2, "error", /Nama kosong/)).toBe(true);
  });

  it("tanggal lahir tidak terbaca (teks dan tanggal mustahil)", () => {
    const h = proses("tanggal-campur.csv");
    expect(adaTemuan(h, 3, "error", /tidak terbaca/)).toBe(true);
    expect(adaTemuan(h, 4, "error", /tidak terbaca/)).toBe(true);
  });

  it("tanggal lahir di masa depan", () => {
    expect(adaTemuan(proses("tanggal-masa-depan.csv"), 0, "error", /masa depan/)).toBe(true);
  });

  it("jenis kelamin tidak dikenali", () => {
    expect(adaTemuan(proses("jenis-kelamin.csv"), 5, "error", /Jenis kelamin "X"/)).toBe(true);
  });

  it("NIK ganda dalam file ditandai di kedua baris", () => {
    const h = proses("nik-ganda.csv");
    expect(adaTemuan(h, 0, "error", /NIK ganda.*baris 3/)).toBe(true);
    expect(adaTemuan(h, 1, "error", /NIK ganda.*baris 2/)).toBe(true);
  });

  it("lebih dari satu Kepala Keluarga per No KK", () => {
    const h = proses("dua-kepala.csv");
    expect(h.baris.map((b) => b.status)).toEqual(["error", "error"]);
    expect(adaTemuan(h, 0, "error", /Lebih dari satu Kepala Keluarga/)).toBe(true);
  });

  it("baris error tidak ikut dalam KK yang diimpor", () => {
    const h = proses("dua-kepala.csv");
    expect(h.kk).toHaveLength(0);
  });
});

describe("validasi Peringatan (PRD 7.4)", () => {
  it("NIK tidak cocok dengan tanggal lahir", () => {
    const h = proses("peringatan.csv");
    expect(adaTemuan(h, 0, "peringatan", /NIK tidak cocok/)).toBe(true);
    expect(h.baris[0]?.status).toBe("peringatan");
  });

  it("pendidikan dan pekerjaan tidak dikenali", () => {
    const h = proses("alias.csv");
    expect(adaTemuan(h, 1, "peringatan", /Pendidikan "Sekolah Alien" tidak dikenali/)).toBe(true);
    expect(adaTemuan(h, 1, "peringatan", /Pekerjaan "Astronot" tidak dikenali/)).toBe(true);
  });

  it("pendidikan dan pekerjaan kosong", () => {
    const h = proses("alias.csv");
    expect(adaTemuan(h, 2, "peringatan", /Pendidikan kosong/)).toBe(true);
    expect(adaTemuan(h, 2, "peringatan", /Pekerjaan kosong/)).toBe(true);
  });

  it("KK tanpa Kepala Keluarga", () => {
    const h = proses("tanpa-kepala.csv");
    expect(adaTemuan(h, 0, "peringatan", /tidak punya Kepala Keluarga/)).toBe(true);
  });

  it("RT/RW belum ada di master", () => {
    const h = proses("rt-rw.csv");
    expect(adaTemuan(h, 2, "peringatan", /RT 009\/RW 003 belum ada di master/)).toBe(true);
    expect(pesan(h, 1)).toBe("");
  });

  it("peringatan tetap ikut diimpor", () => {
    const h = proses("peringatan.csv");
    expect(h.kk).toHaveLength(1);
    expect(h.ringkasan.peringatan).toBe(1);
  });
});

describe("pengelompokan per No KK (PRD 7.2)", () => {
  it("mengelompokkan anggota per No KK dan memakai alamat/wilayah baris pertama", () => {
    const h = proses("bersih.csv");
    expect(h.kk).toHaveLength(1);
    expect(h.kk[0]?.anggota).toHaveLength(2);
    expect(h.kk[0]).toMatchObject({ no_kk: "9990000000000010", rt: "001", rw: "003" });
  });

  it("tanpa kolom hubungan, anggota pertama tiap No KK menjadi Kepala Keluarga bila kepalaPertama aktif", () => {
    const h = proses("tanpa-hubungan.csv", { kepalaPertama: true });
    expect(h.baris.map((b) => b.data.hubungan_keluarga)).toEqual(["KEPALA_KELUARGA", "LAINNYA", "KEPALA_KELUARGA"]);
    expect(h.ringkasan.error).toBe(0);
  });

  it("tanpa kolom hubungan dan tanpa opsi, hubungan kosong menjadi error", () => {
    const h = proses("tanpa-hubungan.csv");
    expect(adaTemuan(h, 0, "error", /Hubungan keluarga kosong/)).toBe(true);
  });
});
