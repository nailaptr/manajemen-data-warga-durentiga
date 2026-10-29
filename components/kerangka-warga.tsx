"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MENU_WARGA, menuAktif } from "@/lib/navigasi";
import { TombolKeluar } from "@/components/tombol-keluar";

export function KerangkaWarga({ nama, children }: { nama: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-latar text-base">
      <header className="flex items-start justify-between gap-3 bg-teal px-5 pb-6 pt-5 text-white">
        <div>
          <p className="text-sm font-semibold text-white/90">Portal Warga RW 03</p>
          <p className="text-2xl font-bold">Halo, {nama}</p>
        </div>
        <TombolKeluar className="min-h-11 shrink-0 rounded-lg border border-white/60 px-4 text-sm font-semibold text-white" />
      </header>
      <main className="flex-1 px-5 py-6 pb-28">{children}</main>
      <nav
        aria-label="Menu utama"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white"
      >
        <ul className="mx-auto flex max-w-xl">
          {MENU_WARGA.map((item) => {
            const aktif = menuAktif(pathname, item);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal ${
                    aktif ? "font-bold text-teal" : "text-teks-sekunder"
                  }`}
                >
                  <item.ikon className="size-6" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
