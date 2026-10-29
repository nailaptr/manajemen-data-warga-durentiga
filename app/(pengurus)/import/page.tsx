import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { mappingTerakhir } from "@/lib/data/impor";
import { daftarPekerjaan, daftarPendidikan, daftarWilayah } from "@/lib/data/pengaturan";
import { ADMIN } from "@/lib/navigasi";
import { WizardImport } from "./wizard-import";

export default async function ImportExcel() {
  const user = await requireRole(...ADMIN);
  const [pendidikan, pekerjaan, wilayah, tersimpan] = await Promise.all([
    daftarPendidikan(),
    daftarPekerjaan(),
    daftarWilayah(user),
    mappingTerakhir(),
  ]);
  const opsi = (b: { id: string; nama: string; alias: string[] }) => ({ id: b.id, nama: b.nama, alias: b.alias });
  return (
    <>
      <JudulHalaman judul="Import Excel" deskripsi="Masukkan data warga dari file Excel atau CSV. File diperiksa di browser Anda dan tidak disimpan di server." />
      <WizardImport
        master={{ pendidikan: pendidikan.map(opsi), pekerjaan: pekerjaan.map(opsi), wilayah: wilayah.map((w) => ({ rw: w.rw, rt: w.rt })) }}
        tersimpan={tersimpan}
      />
    </>
  );
}
