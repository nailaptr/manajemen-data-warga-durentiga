import Link from "next/link";

export const metadata = { title: "Kebijakan Privasi (draf)" };

// Draf: persetujuan kelurahan/pihak hukum menjadi syarat peluncuran (PRD 12.4).
export default function KebijakanPrivasi() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-10 text-base text-teks">
      <p className="rounded-lg bg-peringatan-latar px-3 py-2 text-sm font-medium">
        Draf, belum disetujui pihak kelurahan.
      </p>
      <h1 className="text-xl font-bold">Kebijakan Privasi</h1>
      <p>
        Aplikasi ini dipakai pengurus RW 03 untuk mendata warga dan keluarganya. Data Anda (termasuk NIK, No KK, dan tanggal lahir)
        dikelola oleh pengurus RW dan hanya dipakai untuk keperluan pendataan warga.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Pengurus hanya melihat data sesuai cakupannya (RW, RT, atau satu KK).</li>
        <li>NIK dan No KK ditampilkan tersamar; pembukaan nomor lengkap dicatat di log aktivitas.</li>
        <li>Perubahan data oleh warga melalui pengajuan yang disetujui Ketua RT.</li>
      </ul>
      <Link href="/daftar" className="inline-block font-medium text-teal">
        Kembali ke pendaftaran
      </Link>
    </main>
  );
}
