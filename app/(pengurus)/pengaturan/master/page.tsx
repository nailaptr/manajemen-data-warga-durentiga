import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { ADMIN } from "@/lib/navigasi";

export default async function MasterData() {
  await requireRole(...ADMIN);
  return <JudulHalaman judul="Master Data" />;
}
