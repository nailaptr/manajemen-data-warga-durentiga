import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { PENGURUS } from "@/lib/navigasi";

export default async function Pengajuan() {
  await requireRole(...PENGURUS);
  return <JudulHalaman judul="Pengajuan Perubahan" />;
}
