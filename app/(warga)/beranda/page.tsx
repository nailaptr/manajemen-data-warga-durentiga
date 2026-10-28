import { TombolKeluar } from "@/components/tombol-keluar";
import { requireRole } from "@/lib/auth";

// Kerangka sementara untuk gerbang login; portal warga dibangun di fase berikutnya.
export default async function BerandaWarga() {
  const pengguna = await requireRole("WARGA");
  return (
    <main className="flex flex-1 flex-col items-start gap-4 p-6 text-base">
      <h1 className="text-xl font-bold">Beranda</h1>
      <p>Masuk sebagai {pengguna.nama}.</p>
      <TombolKeluar />
    </main>
  );
}
