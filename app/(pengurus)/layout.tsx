import { KerangkaPengurus } from "@/components/kerangka-pengurus";
import { requireRole } from "@/lib/auth";
import { PENGURUS } from "@/lib/navigasi";

export default async function LayoutPengurus({ children }: LayoutProps<"/">) {
  const pengguna = await requireRole(...PENGURUS);
  return (
    <KerangkaPengurus nama={pengguna.nama} role={pengguna.role}>
      {children}
    </KerangkaPengurus>
  );
}
