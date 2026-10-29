import Link from "next/link";
import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { daftarRt, opsiMaster } from "@/lib/data/kk";
import { PENGURUS } from "@/lib/navigasi";
import type { KkInput } from "@/lib/validators/kk";
import { ANGGOTA_KOSONG, FormKk } from "../form-kk";

export default async function TambahKk() {
  const user = await requireRole(...PENGURUS);
  const [rt, master] = await Promise.all([daftarRt(user), opsiMaster()]);
  const awal: KkInput = {
    no_kk: "", alamat: "", rt: rt.length === 1 ? rt[0].rt : "", rw: rt[0]?.rw ?? "",
    kode_pos: "", desa_kelurahan: "", kecamatan: "", kabupaten_kota: "", provinsi: "",
    anggota: [{ ...ANGGOTA_KOSONG, hubungan_keluarga: "KEPALA_KELUARGA" }],
  };
  return (
    <>
      <nav aria-label="Jejak halaman" className="mb-2 text-sm text-teks-sekunder">
        <Link href="/kk" className="text-teal underline">Data KK</Link> › Tambah KK
      </nav>
      <JudulHalaman judul="Tambah KK" />
      <FormKk nilaiAwal={awal} {...master} rtTersedia={rt} />
    </>
  );
}
