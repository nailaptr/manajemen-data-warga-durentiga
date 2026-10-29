import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";

export default async function PengajuanSaya() {
  await requireRole("WARGA");
  return <JudulHalaman judul="Pengajuan Saya" />;
}
