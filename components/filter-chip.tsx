import Link from "next/link";
import { X } from "lucide-react";

// Chip filter aktif. `hrefHapus` adalah URL yang sama tanpa filter ini (satu parser filter, PRD 6).
export function FilterChip({ label, hrefHapus }: { label: string; hrefHapus: string }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-teal-muda pl-4 text-sm font-semibold text-teal">
      {label}
      <Link
        href={hrefHapus}
        aria-label={`Hapus filter ${label}`}
        className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-teal"
      >
        <X className="size-4" aria-hidden />
      </Link>
    </span>
  );
}
