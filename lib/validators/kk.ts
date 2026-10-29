import { z } from "zod";

// Skema bersama browser dan server (PRD 5.4). Nilai enum mengikuti prisma/schema.prisma.
export const HUBUNGAN = [
  "KEPALA_KELUARGA", "ISTRI", "SUAMI", "ANAK", "MENANTU", "CUCU",
  "ORANG_TUA", "MERTUA", "FAMILI_LAIN", "LAINNYA",
] as const;
export const AGAMA = ["ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KONGHUCU", "LAINNYA"] as const;
export const GOLONGAN_DARAH = ["A", "B", "AB", "O", "TIDAK_TAHU"] as const;
export const STATUS_PERKAWINAN = ["BELUM_KAWIN", "KAWIN", "CERAI_HIDUP", "CERAI_MATI"] as const;

// NIK dan No KK selalu string 16 digit (BR-03), tidak pernah number.
const nomor16 = (nama: string) => z.string().regex(/^\d{16}$/, `${nama} harus 16 digit angka`);
const wajib = (pesan: string) => z.string().trim().min(1, pesan);
const opsional = z.string().trim().optional().transform((v) => (v ? v : undefined));
const tanggal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir wajib diisi")
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(), "Tanggal lahir tidak valid");
const pilihanOpsional = <T extends readonly [string, ...string[]]>(nilai: T) =>
  z.union([z.enum(nilai), z.literal("")]).optional().transform((v) => (v ? v : undefined));

export const anggotaSchema = z.object({
  id: z.string().uuid().optional(),
  hubungan_keluarga: z.enum(HUBUNGAN, "Hubungan keluarga wajib dipilih"),
  nik: nomor16("NIK"),
  nama_lengkap: wajib("Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
  jenis_kelamin: z.enum(["L", "P"], "Jenis kelamin wajib dipilih"),
  tempat_lahir: wajib("Tempat lahir wajib diisi"),
  tanggal_lahir: tanggal,
  agama: z.enum(AGAMA, "Agama wajib dipilih"),
  pendidikan_id: z.string().uuid("Pendidikan wajib dipilih"),
  pekerjaan_id: z.string().uuid("Pekerjaan wajib dipilih"),
  golongan_darah: pilihanOpsional(GOLONGAN_DARAH),
  status_perkawinan: pilihanOpsional(STATUS_PERKAWINAN),
});

export const kkSchema = z
  .object({
    no_kk: nomor16("No KK"),
    alamat: wajib("Alamat wajib diisi"),
    rt: z.string().regex(/^\d{1,3}$/, "RT wajib diisi"),
    rw: z.string().regex(/^\d{1,3}$/, "RW wajib diisi"),
    kode_pos: z.string().regex(/^\d{5}$/, "Kode pos 5 digit").optional().or(z.literal("")).transform((v) => v || undefined),
    desa_kelurahan: wajib("Desa/Kelurahan wajib diisi"),
    kecamatan: wajib("Kecamatan wajib diisi"),
    kabupaten_kota: wajib("Kabupaten/Kota wajib diisi"),
    provinsi: opsional,
    anggota: z.array(anggotaSchema).min(1, "Minimal satu anggota"),
  })
  .superRefine((kk, ctx) => {
    // BR-02: anggota pertama wajib Kepala Keluarga, dan hanya satu.
    if (kk.anggota[0]?.hubungan_keluarga !== "KEPALA_KELUARGA") {
      ctx.addIssue({ code: "custom", path: ["anggota", 0, "hubungan_keluarga"], message: "Anggota pertama wajib Kepala Keluarga" });
    }
    kk.anggota.forEach((a, i) => {
      if (i > 0 && a.hubungan_keluarga === "KEPALA_KELUARGA") {
        ctx.addIssue({ code: "custom", path: ["anggota", i, "hubungan_keluarga"], message: "Satu KK hanya punya satu Kepala Keluarga" });
      }
    });
    const lihat = new Set<string>();
    kk.anggota.forEach((a, i) => {
      if (lihat.has(a.nik)) ctx.addIssue({ code: "custom", path: ["anggota", i, "nik"], message: "NIK ganda dalam form" });
      lihat.add(a.nik);
    });
  });

export type KkInput = z.input<typeof kkSchema>;
export type KkData = z.output<typeof kkSchema>;
