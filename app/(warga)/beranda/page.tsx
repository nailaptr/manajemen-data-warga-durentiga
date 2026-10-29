import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";

export default async function BerandaWarga() {
  await requireRole("WARGA");
  return <JudulHalaman judul="Beranda" />;
}
