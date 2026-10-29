import { z } from "zod";
import { anggotaSchema } from "./kk";

export const STATUS_KEPENDUDUKAN = ["AKTIF", "PINDAH", "MENINGGAL"] as const;

const hariIni = () => new Date().toISOString().slice(0, 10);

// Skema modal Tambah/Ubah Warga (PRD 5.3): aturan field sama dengan anggota KK, ditambah KK dan status.
export const wargaSchema = anggotaSchema
  .omit({ id: true })
  .extend({
    kartu_keluarga_id: z.string().uuid("Kartu Keluarga wajib dipilih"),
    status_kependudukan: z.enum(STATUS_KEPENDUDUKAN, "Status kependudukan wajib dipilih"),
    tanggal_status: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal kejadian tidak valid").optional().or(z.literal("")),
  })
  .superRefine((w, ctx) => {
    if (w.status_kependudukan === "AKTIF") return;
    if (!w.tanggal_status) {
      ctx.addIssue({ code: "custom", path: ["tanggal_status"], message: "Tanggal kejadian wajib diisi" });
    } else if (w.tanggal_status > hariIni()) {
      ctx.addIssue({ code: "custom", path: ["tanggal_status"], message: "Tanggal kejadian tidak boleh di masa depan" });
    }
  })
  .transform((w) => ({ ...w, tanggal_status: w.status_kependudukan === "AKTIF" ? undefined : w.tanggal_status || undefined }));

export type WargaInput = z.input<typeof wargaSchema>;
export type WargaData = z.output<typeof wargaSchema>;
