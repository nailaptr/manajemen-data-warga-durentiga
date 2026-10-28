import { TombolKeluar } from "@/components/tombol-keluar";
import { requireRole } from "@/lib/auth";

// Kerangka sementara untuk gerbang login; dashboard asli dibangun di Fase 2.
export default async function Dashboard() {
  const pengguna = await requireRole("SUPER_ADMIN", "ADMIN_RW", "KETUA_RT");
  return (
    <main className="flex flex-1 flex-col items-start gap-4 p-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <p>
        Masuk sebagai {pengguna.nama} ({pengguna.role}).
      </p>
      <TombolKeluar />
    </main>
  );
}
