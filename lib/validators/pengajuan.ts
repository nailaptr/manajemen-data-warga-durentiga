import { z } from "zod";
import { anggotaSchema } from "./kk";

// Field yang boleh diusulkan warga lewat "Ubah data". Hubungan keluarga dan jenis kelamin
// tidak ada di sini: salah catat di situ ditangani pengurus langsung.
export const FIELD_UBAH = [
  "nama_lengkap", "nik", "tempat_lahir", "tanggal_lahir", "agama",
  "pendidikan_id", "pekerjaan_id", "golongan_darah", "status_perkawinan",
] as const;
export type FieldUbah = (typeof FIELD_UBAH)[number];

export const ALASAN_TOLAK_MIN = 10;

export const ubahSchema = anggotaSchema.pick(Object.fromEntries(FIELD_UBAH.map((f) => [f, true])) as Record<FieldUbah, true>).partial();

const catatan = z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().transform((v) => v || undefined);
const idWarga = z.string().uuid("Anggota keluarga wajib dipilih");
const tanggalKejadian = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal kejadian wajib diisi")
  .refine((v) => new Date(v).toISOString().slice(0, 10) === v, "Tanggal kejadian tidak valid")
  .refine((v) => new Date(v) <= new Date(), "Tanggal kejadian tidak boleh di masa depan");

export const buatPengajuanSchema = z.discriminatedUnion("jenis", [
  z.object({
    jenis: z.literal("UBAH_WARGA"),
    warga_id: idWarga,
    perubahan: ubahSchema,
    catatan,
  }),
  z.object({
    jenis: z.literal("TAMBAH_ANGGOTA"),
    anggota: anggotaSchema
      .omit({ id: true })
      .refine((a) => a.hubungan_keluarga !== "KEPALA_KELUARGA", { path: ["hubungan_keluarga"], message: "Kepala Keluarga tidak bisa ditambah lewat pengajuan" }),
    catatan,
  }),
  z.object({ jenis: z.literal("LAPOR_PINDAH"), warga_id: idWarga, tanggal_status: tanggalKejadian, catatan }),
  z.object({ jenis: z.literal("LAPOR_MENINGGAL"), warga_id: idWarga, tanggal_status: tanggalKejadian, catatan }),
]);

export const tolakPengajuanSchema = z.object({
  alasan: z.string().trim().min(ALASAN_TOLAK_MIN, `Alasan penolakan minimal ${ALASAN_TOLAK_MIN} karakter`).max(500, "Alasan maksimal 500 karakter"),
});

export type BuatPengajuanInput = z.input<typeof buatPengajuanSchema>;
export type BuatPengajuanData = z.output<typeof buatPengajuanSchema>;
