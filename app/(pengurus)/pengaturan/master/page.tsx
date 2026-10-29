import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ADMIN } from "@/lib/navigasi";

// Rute PRD 5.1 lama; isinya kini satu halaman bertab di /pengaturan.
export default async function MasterData() {
  await requireRole(...ADMIN);
  redirect("/pengaturan?tab=pendidikan");
}
