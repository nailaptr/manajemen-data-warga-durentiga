export type StatusLencana = "aktif" | "disetujui" | "menunggu" | "ditolak" | "nonaktif";

// Warna dari PRD 11.2; teks selalu menyebut statusnya agar tidak bergantung pada warna.
const GAYA: Record<StatusLencana, string> = {
  aktif: "bg-sukses-latar text-sukses",
  disetujui: "bg-sukses-latar text-sukses",
  menunggu: "bg-peringatan-latar text-peringatan",
  ditolak: "bg-galat-latar text-galat",
  nonaktif: "bg-nonaktif-latar text-teks-sekunder",
};

export function StatusBadge({ status, label }: { status: StatusLencana; label: string }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${GAYA[status]}`}>{label}</span>
  );
}
