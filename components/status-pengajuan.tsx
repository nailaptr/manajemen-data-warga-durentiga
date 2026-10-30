import { StatusBadge, type StatusLencana } from "@/components/status-badge";
import type { BarisPengajuanSaya } from "@/lib/data/portal";

const PETA: Record<BarisPengajuanSaya["status"], { status: StatusLencana; label: string }> = {
  MENUNGGU: { status: "menunggu", label: "Menunggu RT" },
  DISETUJUI: { status: "disetujui", label: "Disetujui" },
  DITOLAK: { status: "ditolak", label: "Ditolak" },
  DIBATALKAN: { status: "nonaktif", label: "Dibatalkan" },
};

export function StatusPengajuan({ status }: { status: BarisPengajuanSaya["status"] }) {
  return <StatusBadge {...PETA[status]} />;
}
