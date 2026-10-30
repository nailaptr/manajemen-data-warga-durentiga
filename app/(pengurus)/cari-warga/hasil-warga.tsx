"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type FiturTabel } from "@/components/data-table";
import type { BarisDaftar } from "@/lib/data/stats";
import { maskNomor } from "@/lib/mask";
import { DrawerWarga } from "./drawer-warga";

interface Props {
  data: BarisDaftar[];
  total: number;
  halaman: number;
  ukuranHalaman: number;
}

// Tabel hasil Cari Warga; NIK dan No KK dimasking, detail lengkap hanya lewat drawer (AC-07).
export function HasilWarga({ data, total, halaman, ukuranHalaman }: Props) {
  const [terbuka, setTerbuka] = useState<string | null>(null);

  const kolom: ColumnDef<FiturTabel, BarisDaftar>[] = [
    { header: "Nama", cell: ({ row }) => <span className="font-semibold">{row.original.nama_lengkap}</span> },
    { header: "NIK", cell: ({ row }) => <span className="font-mono">{maskNomor(row.original.nik)}</span> },
    { header: "No KK", cell: ({ row }) => <span className="font-mono">{maskNomor(row.original.no_kk)}</span> },
    { header: "L/P", cell: ({ row }) => row.original.jenis_kelamin },
    { header: "Usia", cell: ({ row }) => `${row.original.usia} th` },
    { header: "Pendidikan", cell: ({ row }) => row.original.pendidikan ?? "-" },
    { header: "Pekerjaan", cell: ({ row }) => row.original.pekerjaan ?? "-" },
    { header: "RT/RW", cell: ({ row }) => `${row.original.rt}/${row.original.rw}` },
    {
      header: "Aksi",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setTerbuka(row.original.id)}
          aria-label={`Lihat detail ${row.original.nama_lengkap}`}
          className="flex size-11 items-center justify-center rounded-lg text-teal hover:bg-teal-muda focus-visible:outline-2 focus-visible:outline-teal"
        >
          <Eye className="size-5" aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <>
      <DataTable<BarisDaftar> kolom={kolom} data={data} total={total} halaman={halaman} ukuranHalaman={ukuranHalaman} keterangan="Hasil pencarian warga" />
      {terbuka && <DrawerWarga key={terbuka} wargaId={terbuka} onTutup={() => setTerbuka(null)} />}
    </>
  );
}
