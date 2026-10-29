"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type FiturTabel } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { BarisKk } from "@/lib/data/kk";
import { maskNomor } from "@/lib/mask";
import { TombolHapusKk } from "./tombol-hapus-kk";

const kolom: ColumnDef<FiturTabel, BarisKk>[] = [
  { header: "No KK", cell: ({ row }) => <span className="font-mono">{maskNomor(row.original.no_kk)}</span> },
  {
    header: "Kepala keluarga",
    cell: ({ row }) =>
      row.original.kepala_keluarga ?? <span className="text-peringatan">Belum ada kepala keluarga</span>,
  },
  { header: "Alamat", accessorKey: "alamat" },
  { header: "RT/RW", cell: ({ row }) => `${row.original.rt}/${row.original.rw}` },
  {
    header: "Anggota",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.kepala_keluarga ? "aktif" : "menunggu"}
        label={`${row.original.jumlah_anggota} orang`}
      />
    ),
  },
  {
    header: "Aksi",
    cell: ({ row }) => (
      <span className="flex items-center">
        <Link
          href={`/kk/${row.original.id}`}
          aria-label="Lihat detail KK"
          className="flex size-11 items-center justify-center rounded-lg text-teal hover:bg-teal-muda"
        >
          <Eye className="size-5" aria-hidden />
        </Link>
        <Link
          href={`/kk/${row.original.id}/ubah`}
          aria-label="Ubah KK"
          className="flex size-11 items-center justify-center rounded-lg text-teal hover:bg-teal-muda"
        >
          <Pencil className="size-5" aria-hidden />
        </Link>
        <TombolHapusKk id={row.original.id} />
      </span>
    ),
  },
];

interface Props {
  data: BarisKk[];
  total: number;
  halaman: number;
  ukuranHalaman: number;
}

export function TabelKk(props: Props) {
  return <DataTable<BarisKk> kolom={kolom} keterangan="Daftar Kartu Keluarga" {...props} />;
}
