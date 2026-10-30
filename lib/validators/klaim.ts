import { z } from "zod";
import { nomor16 } from "./kk";

export const KATA_SANDI_MIN = 10;

// DD/MM/YYYY (mockup Daftar akun warga) -> YYYY-MM-DD; tanggal yang tidak ada di kalender ditolak.
const tanggalLahir = z
  .string()
  .trim()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Tanggal lahir harus berformat DD/MM/YYYY")
  .transform((v, ctx) => {
    const [d, m, y] = v.split("/").map(Number) as [number, number, number];
    const tanggal = new Date(Date.UTC(y, m - 1, d));
    if (tanggal.getUTCFullYear() !== y || tanggal.getUTCMonth() !== m - 1 || tanggal.getUTCDate() !== d) {
      ctx.addIssue({ code: "custom", message: "Tanggal lahir tidak valid" });
      return z.NEVER;
    }
    return tanggal.toISOString().slice(0, 10);
  });

// Skema bersama browser dan server untuk klaim akun warga (PRD 3.1). Hanya format yang dicek di sini;
// kecocokan dengan data warga diputuskan di server dan tidak pernah dijelaskan per kolom.
export const klaimSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "Email terlalu panjang").pipe(z.email("Email tidak valid")),
  kata_sandi: z
    .string()
    .min(KATA_SANDI_MIN, `Kata sandi minimal ${KATA_SANDI_MIN} karakter`)
    .max(128, "Kata sandi terlalu panjang"),
  nik: nomor16("NIK"),
  no_kk: nomor16("No KK"),
  tanggal_lahir: tanggalLahir,
  setuju: z.literal(true, "Persetujuan kebijakan privasi wajib dicentang"),
});

export type KlaimInput = z.input<typeof klaimSchema>;
export type KlaimData = z.output<typeof klaimSchema>;
