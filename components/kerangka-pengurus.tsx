"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Home, Menu, X } from "lucide-react";
import type { Role } from "../generated/prisma/client";
import { menuAktif, menuPengurus, NAMA_PERAN } from "@/lib/navigasi";
import { TombolKeluar } from "@/components/tombol-keluar";

interface Props {
  nama: string;
  role: Role;
  children: ReactNode;
}

function Sidebar({ nama, role, tutup }: { nama: string; role: Role; tutup?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-sidebar text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-full border-2 border-yellow-400 bg-teal">
          <Home className="size-5" aria-hidden />
        </span>
        <span className="text-base font-bold leading-tight">
          Portal Warga
          <br />
          RW 03
        </span>
      </div>
      <div className="bg-white/10 px-5 py-3">
        <p className="text-sm font-bold">{nama}</p>
        <p className="text-xs text-white/80">{NAMA_PERAN[role]}</p>
      </div>
      <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 py-4">
        {menuPengurus(role).map((kelompok) => (
          <div key={kelompok.judul} className="mb-4">
            <p className="px-3 pb-2 text-xs font-bold uppercase text-white/70">{kelompok.judul}</p>
            <ul className="space-y-1">
              {kelompok.item.map((item) => {
                const aktif = menuAktif(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={tutup}
                      aria-current={aktif ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                        aktif ? "bg-white/15 font-bold" : "hover:bg-white/10"
                      }`}
                    >
                      <item.ikon className="size-5" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/15 p-4">
        <TombolKeluar className="min-h-11 w-full rounded-lg border border-white/40 px-4 text-[15px] font-semibold text-white hover:bg-white/10" />
      </div>
    </div>
  );
}

export function KerangkaPengurus({ nama, role, children }: Props) {
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => {
    if (!terbuka) return;
    const tekan = (e: KeyboardEvent) => e.key === "Escape" && setTerbuka(false);
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [terbuka]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <Sidebar nama={nama} role={role} />
      </aside>

      {terbuka && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setTerbuka(false)}
          />
          <div className="relative h-full w-72 max-w-[85vw]">
            <Sidebar nama={nama} role={role} tutup={() => setTerbuka(false)} />
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => setTerbuka(false)}
              className="absolute right-2 top-3 flex size-11 items-center justify-center text-white"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 bg-sidebar px-2 py-1 text-white lg:hidden">
          <button
            type="button"
            aria-label="Buka menu"
            onClick={() => setTerbuka(true)}
            className="flex size-11 items-center justify-center"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <span className="text-base font-bold">Portal Warga RW 03</span>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
