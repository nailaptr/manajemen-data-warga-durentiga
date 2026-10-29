import {
  FileText,
  Home,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Search,
  Settings,
  UserCheck,
  UserRound,
  Users,
  Upload,
} from "lucide-react";
import type { Role } from "../generated/prisma/client";

export const PENGURUS: Role[] = ["SUPER_ADMIN", "ADMIN_RW", "KETUA_RT"];
export const ADMIN: Role[] = ["SUPER_ADMIN", "ADMIN_RW"];

export const NAMA_PERAN: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_RW: "Admin RW",
  KETUA_RT: "Ketua RT",
  WARGA: "Warga",
};

export interface ItemMenu {
  label: string;
  href: string;
  ikon: LucideIcon;
  // Awalan rute yang menandai menu aktif bila berbeda dari href.
  awalan?: string;
}

export interface KelompokMenu {
  judul: string;
  item: ItemMenu[];
}

const DASHBOARD: KelompokMenu = {
  judul: "Dashboard",
  item: [
    { label: "Dashboard", href: "/dashboard", ikon: LayoutDashboard },
    { label: "Cari Warga", href: "/cari-warga", ikon: Search },
  ],
};

const DATA: ItemMenu[] = [
  { label: "Data Warga", href: "/warga", ikon: Users },
  { label: "Data KK", href: "/kk", ikon: Home },
  { label: "Pengajuan", href: "/pengajuan", ikon: FileText },
];

// PRD 5.2.
export function menuPengurus(role: Role): KelompokMenu[] {
  if (role === "KETUA_RT") {
    return [
      DASHBOARD,
      { judul: "Data", item: [...DATA, { label: "Klaim Akun", href: "/pengguna/klaim", ikon: UserCheck }] },
    ];
  }
  return [
    DASHBOARD,
    { judul: "Data", item: DATA },
    {
      judul: "Admin",
      item: [
        { label: "Import", href: "/import", ikon: Upload },
        { label: "Pengguna", href: "/pengguna", ikon: UserCheck },
        { label: "Pengaturan", href: "/pengaturan/master", ikon: Settings, awalan: "/pengaturan" },
        { label: "Log", href: "/log", ikon: ScrollText },
      ],
    },
  ];
}

export const MENU_WARGA: ItemMenu[] = [
  { label: "Beranda", href: "/beranda", ikon: Home },
  { label: "Keluarga", href: "/keluarga", ikon: Users },
  { label: "Pengajuan", href: "/pengajuan-saya", ikon: FileText },
  { label: "Profil", href: "/profil", ikon: UserRound },
];

export function menuAktif(pathname: string, item: ItemMenu): boolean {
  const awalan = item.awalan ?? item.href;
  return pathname === awalan || pathname.startsWith(`${awalan}/`);
}
