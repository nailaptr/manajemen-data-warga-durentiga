import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";

export default async function PengajuanBaru() {
  await requireRole("WARGA");
  return <JudulHalaman judul="Buat Pengajuan" />;
}
