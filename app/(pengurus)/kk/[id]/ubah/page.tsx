import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { ambilKk, daftarRt, opsiMaster } from "@/lib/data/kk";
import { PENGURUS } from "@/lib/navigasi";
import type { KkInput } from "@/lib/validators/kk";
import { FormKk } from "../../form-kk";

export default async function UbahKk({ params }: PageProps<"/kk/[id]/ubah">) {
  const user = await requireRole(...PENGURUS);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [kk, rt, master] = await Promise.all([ambilKk(user, id), daftarRt(user), opsiMaster()]);
  if (!kk) notFound();

  // Hanya anggota aktif yang bisa diubah di form; anggota Pindah/Meninggal diurus lewat alur status.
  const anggota = kk.warga
    .filter((w) => w.status_kependudukan === "AKTIF")
    .sort((a, b) => Number(b.hubungan_keluarga === "KEPALA_KELUARGA") - Number(a.hubungan_keluarga === "KEPALA_KELUARGA"));
  const awal: KkInput = {
    no_kk: kk.no_kk,
    alamat: kk.alamat,
    rt: kk.wilayah.rt,
    rw: kk.wilayah.rw,
    kode_pos: kk.kode_pos ?? "",
    desa_kelurahan: kk.desa_kelurahan ?? "",
    kecamatan: kk.kecamatan ?? "",
    kabupaten_kota: kk.kabupaten_kota ?? "",
    provinsi: kk.provinsi ?? "",
    anggota: anggota.map((w) => ({
      id: w.id,
      hubungan_keluarga: w.hubungan_keluarga,
      nik: w.nik,
      nama_lengkap: w.nama_lengkap,
      jenis_kelamin: w.jenis_kelamin,
      tempat_lahir: w.tempat_lahir ?? "",
      tanggal_lahir: w.tanggal_lahir.toISOString().slice(0, 10),
      agama: w.agama ?? "LAINNYA",
      pendidikan_id: w.pendidikan_id ?? "",
      pekerjaan_id: w.pekerjaan_id ?? "",
      golongan_darah: w.golongan_darah ?? "",
      status_perkawinan: w.status_perkawinan ?? "",
    })),
  };
  return (
    <>
      <nav aria-label="Jejak halaman" className="mb-2 text-sm text-teks-sekunder">
        <Link href="/kk" className="text-teal underline">Data KK</Link> › Ubah KK
      </nav>
      <JudulHalaman judul="Ubah KK" />
      <FormKk key={kk.updated_at.toISOString()} nilaiAwal={awal} kkId={kk.id} {...master} rtTersedia={rt} />
    </>
  );
}
