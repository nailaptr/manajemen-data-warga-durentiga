import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";

export default async function KeluargaSaya() {
  await requireRole("WARGA");
  return <JudulHalaman judul="Keluarga Saya" />;
}
