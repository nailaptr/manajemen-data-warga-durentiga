import type { ReactNode } from "react";

export function KartuForm({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-xl font-bold text-teks">{judul}</h1>
        {children}
      </div>
    </main>
  );
}

export const kelasInput =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-teks focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30";
export const kelasTombol =
  "w-full rounded-lg bg-teal px-4 py-2.5 text-base font-semibold text-white hover:bg-teal/90 disabled:opacity-60";
