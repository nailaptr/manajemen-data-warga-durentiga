import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { dataFormPengajuan } from "@/lib/data/pengajuan";
import { FormPengajuan, type TabPengajuan } from "./form-pengajuan";

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BuatPengajuan({ searchParams }: PageProps<"/pengajuan-saya/baru">) {
  const user = await requireRole("WARGA");
  const data = await dataFormPengajuan(user);
  if (!data) {
    return (
      <p role="status" className="rounded-2xl bg-white p-5 text-teks-sekunder shadow-sm">
        Data keluarga Anda belum dapat ditampilkan. Hubungi pengurus RT Anda.
      </p>
    );
  }

  const q = await searchParams;
  const warga = satu(q.warga);
  const tabAwal: TabPengajuan = satu(q.jenis) === "TAMBAH_ANGGOTA" ? "TAMBAH_ANGGOTA" : "UBAH_WARGA";
  const wargaAwal = data.anggota.find((a) => a.id === warga)?.id ?? data.anggota[0]?.id ?? "";

  return (
    <>
      <JudulHalaman judul="Ajukan perubahan" deskripsi="Perubahan baru berlaku setelah disetujui Ketua RT." />
      <FormPengajuan data={data} tabAwal={tabAwal} wargaAwal={wargaAwal} />
    </>
  );
}
