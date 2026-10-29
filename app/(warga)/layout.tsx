import { KerangkaWarga } from "@/components/kerangka-warga";
import { requireRole } from "@/lib/auth";

export default async function LayoutWarga({ children }: LayoutProps<"/">) {
  const pengguna = await requireRole("WARGA");
  return <KerangkaWarga nama={pengguna.nama}>{children}</KerangkaWarga>;
}
