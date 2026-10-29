import type { ReactNode } from "react";

interface Props {
  label: string;
  nilai: string;
  catatan?: string;
  ikon: ReactNode;
}

export function StatCard({ label, nilai, catatan, ikon }: Props) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-muda text-teal" aria-hidden>
        {ikon}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-teks-sekunder">{label}</p>
        <p className="text-3xl font-bold leading-tight text-teks">{nilai}</p>
        {catatan && <p className="text-sm text-teks-sekunder">{catatan}</p>}
      </div>
    </div>
  );
}
