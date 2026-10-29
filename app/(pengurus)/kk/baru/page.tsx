import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { PENGURUS } from "@/lib/navigasi";

export default async function TambahKk() {
  await requireRole(...PENGURUS);
  return <JudulHalaman judul="Tambah KK" />;
}
