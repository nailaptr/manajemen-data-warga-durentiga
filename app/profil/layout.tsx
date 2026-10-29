import { KerangkaPengurus } from "@/components/kerangka-pengurus";
import { KerangkaWarga } from "@/components/kerangka-warga";
import { requireRole } from "@/lib/auth";

// /profil dipakai semua peran (PRD 5.1), jadi kerangkanya mengikuti peran.
export default async function LayoutProfil({ children }: LayoutProps<"/profil">) {
  const pengguna = await requireRole("SUPER_ADMIN", "ADMIN_RW", "KETUA_RT", "WARGA");
  if (pengguna.role === "WARGA") return <KerangkaWarga nama={pengguna.nama}>{children}</KerangkaWarga>;
  return (
    <KerangkaPengurus nama={pengguna.nama} role={pengguna.role}>
      {children}
    </KerangkaPengurus>
  );
}
