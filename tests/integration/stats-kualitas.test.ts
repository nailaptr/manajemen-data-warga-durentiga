import { describe, expect, it } from "vitest";
import { kualitasData } from "@/lib/data/stats";
import { dalamRollback } from "./helpers";

// Data dibuat di RW 094 (hanya dilihat pengguna uji) dan dibatalkan. NIK 99905..., No KK 99904...
describe("kualitasData (FR-DSB-07, BR-06)", () => {
  it("menghitung warga tanpa pekerjaan, KK tanpa kepala aktif, dan pengajuan menunggu", async () => {
    await dalamRollback(async (tx) => {
      const rt = await tx.wilayah.create({ data: { rw: "094", rt: "001" } });
      const admin = await tx.user.create({
        data: { nama: "Penguji", email: "penguji-kualitas@contoh.test", role: "ADMIN_RW", status: "AKTIF", rw: "094" },
      });
      const pek = await tx.refPekerjaan.create({ data: { nama: "Uji Kualitas" } });
      let urut = 0;
      const kk = () =>
        tx.kartuKeluarga.create({
          data: { no_kk: `99904${String(++urut).padStart(11, "0")}`, alamat: "Jl. Uji", wilayah_id: rt.id, created_by: admin.id },
        });
      const warga = (kkId: string, o: { hubungan: "KEPALA_KELUARGA" | "ANAK"; status?: "AKTIF" | "MENINGGAL"; pek?: string }) =>
        tx.warga.create({
          data: {
            kartu_keluarga_id: kkId,
            nik: `99905${String(++urut).padStart(11, "0")}`,
            nama_lengkap: "Warga Uji",
            jenis_kelamin: "L",
            tanggal_lahir: new Date("1990-01-01"),
            hubungan_keluarga: o.hubungan,
            pekerjaan_id: o.pek,
            status_kependudukan: o.status ?? "AKTIF",
          },
        });

      const normal = await kk();
      await warga(normal.id, { hubungan: "KEPALA_KELUARGA", pek: pek.id });
      const tanpaKepala = await kk();
      await warga(tanpaKepala.id, { hubungan: "KEPALA_KELUARGA", status: "MENINGGAL", pek: pek.id });
      await warga(tanpaKepala.id, { hubungan: "ANAK" }); // aktif, tanpa pekerjaan
      const semuaMeninggal = await kk();
      await warga(semuaMeninggal.id, { hubungan: "KEPALA_KELUARGA", status: "MENINGGAL" }); // tidak punya warga aktif: bukan masalah
      await tx.pengajuan.create({
        data: { kartu_keluarga_id: normal.id, diajukan_oleh: admin.id, jenis: "UBAH_WARGA", status: "MENUNGGU" },
      });
      await tx.pengajuan.create({
        data: { kartu_keluarga_id: normal.id, diajukan_oleh: admin.id, jenis: "UBAH_WARGA", status: "DISETUJUI" },
      });

      const hasil = await kualitasData({ role: "ADMIN_RW", rw: "094", wilayah_id: null, warga_id: null }, { db: tx });
      expect(hasil).toEqual({ wargaTanpaPekerjaan: 1, kkTanpaKepala: 1, pengajuanMenunggu: 1 });
    });
  });

  it("pengguna tanpa cakupan tidak melihat apa pun", async () => {
    await dalamRollback(async (tx) => {
      const hasil = await kualitasData({ role: "KETUA_RT", rw: null, wilayah_id: null, warga_id: null }, { db: tx });
      expect(hasil).toEqual({ wargaTanpaPekerjaan: 0, kkTanpaKepala: 0, pengajuanMenunggu: 0 });
    });
  });
});
