import { z } from "zod";

// Formulir mengirim "" untuk kolom yang tidak dipilih.
const kosongJadiUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const dasar = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
  role: z.enum(["ADMIN_RW", "KETUA_RT"], { error: "Peran tidak valid" }),
  wilayah_id: z.preprocess(kosongJadiUndefined, z.string().uuid("RT tidak valid").optional()),
  rw: z.preprocess(kosongJadiUndefined, z.string().trim().regex(/^\d{3}$/, "RW harus 3 digit angka, contoh 003").optional()),
});

// Ketua RT terikat ke satu RT, Admin RW ke satu RW (PRD 2.3).
function cekCakupan(d: z.infer<typeof dasar>, ctx: z.RefinementCtx) {
  if (d.role === "KETUA_RT" && !d.wilayah_id) ctx.addIssue({ code: "custom", path: ["wilayah_id"], message: "RT wajib dipilih" });
  if (d.role === "ADMIN_RW" && !d.rw) ctx.addIssue({ code: "custom", path: ["rw"], message: "RW wajib diisi" });
}

export const tambahPenggunaSchema = dasar
  .extend({ email: z.string().trim().toLowerCase().max(254, "Email terlalu panjang").pipe(z.email("Email tidak valid")) })
  .superRefine(cekCakupan);

export const ubahPenggunaSchema = dasar.superRefine(cekCakupan);

export const tolakKlaimSchema = z.object({
  alasan: z.string().trim().max(200, "Alasan maksimal 200 karakter").transform((a) => a || undefined).optional(),
});

export type TambahPenggunaData = z.output<typeof tambahPenggunaSchema>;
export type UbahPenggunaData = z.output<typeof ubahPenggunaSchema>;
export type TolakKlaimData = z.output<typeof tolakKlaimSchema>;
