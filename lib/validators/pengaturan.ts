import { z } from "zod";

const nama = (label: string) => z.string().trim().min(1, `${label} wajib diisi`).max(100, `${label} maksimal 100 karakter`);

// Alias dirapikan: spasi dipangkas, kosong dibuang, ganda (tanpa pandang huruf besar/kecil) dibuang.
const alias = z
  .array(z.string())
  .max(30, "Alias maksimal 30")
  .transform((daftar) => {
    const lihat = new Set<string>();
    return daftar
      .map((a) => a.trim())
      .filter((a) => {
        const kunci = a.toLowerCase();
        if (!a || lihat.has(kunci)) return false;
        lihat.add(kunci);
        return true;
      });
  })
  .pipe(z.array(z.string().max(100, "Alias maksimal 100 karakter")));

export const pendidikanSchema = z.object({
  nama: nama("Nama pendidikan"),
  urutan: z.coerce.number({ error: "Urutan harus angka" }).int("Urutan harus bilangan bulat").min(1, "Urutan minimal 1").max(999),
  alias,
});

export const pekerjaanSchema = z.object({
  nama: nama("Nama pekerjaan"),
  alias,
});

const angkaUsia = (label: string) =>
  z.coerce.number({ error: `${label} harus angka` }).int(`${label} harus bilangan bulat`).min(0, `${label} minimal 0`).max(150, `${label} maksimal 150`);

export const barisKategoriUsiaSchema = z
  .object({
    id: z.string().uuid().optional(),
    nama: nama("Nama kategori"),
    usia_min: angkaUsia("Usia min"),
    // Kosong berarti tanpa batas atas.
    usia_maks: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), angkaUsia("Usia maks").nullable()),
    jenis_kelamin: z.enum(["", "L", "P"]).transform((v) => (v === "" ? null : v)),
  })
  .refine((k) => k.usia_maks === null || k.usia_maks >= k.usia_min, {
    path: ["usia_maks"],
    message: "Usia maks tidak boleh lebih kecil dari usia min",
  });

// Urutan kategori mengikuti urutan baris. Tumpang tindih rentang sengaja diizinkan.
export const kategoriUsiaSchema = z
  .array(barisKategoriUsiaSchema)
  .max(50, "Kategori usia maksimal 50")
  .superRefine((daftar, ctx) => {
    const lihat = new Set<string>();
    daftar.forEach((k, i) => {
      const kunci = k.nama.toLowerCase();
      if (lihat.has(kunci)) ctx.addIssue({ code: "custom", path: [i, "nama"], message: `Nama kategori ganda: ${k.nama}` });
      lihat.add(kunci);
    });
  });

const tigaDigit = (label: string) => z.string().trim().regex(/^\d{3}$/, `${label} harus 3 digit angka, contoh 003`);

export const wilayahSchema = z.object({
  rw: tigaDigit("RW"),
  rt: tigaDigit("RT"),
  keterangan: z.string().trim().max(200, "Keterangan maksimal 200 karakter").transform((v) => v || null),
});

export type PendidikanInput = z.input<typeof pendidikanSchema>;
export type PendidikanData = z.output<typeof pendidikanSchema>;
export type PekerjaanInput = z.input<typeof pekerjaanSchema>;
export type PekerjaanData = z.output<typeof pekerjaanSchema>;
export type KategoriUsiaInput = z.input<typeof kategoriUsiaSchema>;
export type KategoriUsiaData = z.output<typeof kategoriUsiaSchema>;
export type WilayahInput = z.input<typeof wilayahSchema>;
export type WilayahData = z.output<typeof wilayahSchema>;
