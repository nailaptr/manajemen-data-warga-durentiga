import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { PENGURUS } from "@/lib/navigasi";

export default async function DetailKk() {
  await requireRole(...PENGURUS);
  return <JudulHalaman judul="Detail KK" />;
}
