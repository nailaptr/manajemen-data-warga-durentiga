import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { daftarKlaim } from "@/lib/data/pengguna";
import { PENGURUS } from "@/lib/navigasi";
import { AntreanKlaim } from "../antrean-klaim";

export default async function KlaimAkun() {
  const user = await requireRole(...PENGURUS);
  const klaim = await daftarKlaim(user);
  return (
    <>
      <JudulHalaman judul="Klaim Akun" deskripsi="Verifikasi warga yang mendaftar akun di wilayah Anda." />
      <AntreanKlaim data={klaim} />
    </>
  );
}
