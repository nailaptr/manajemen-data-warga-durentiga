import Link from "next/link";
import { KartuForm } from "@/components/kartu-form";

export default function TidakBerwenang() {
  return (
    <KartuForm judul="Tidak berwenang">
      <p className="mb-4 text-base">Peran Anda tidak boleh membuka halaman ini.</p>
      <Link href="/" className="font-medium text-teal">
        Kembali ke beranda
      </Link>
    </KartuForm>
  );
}
