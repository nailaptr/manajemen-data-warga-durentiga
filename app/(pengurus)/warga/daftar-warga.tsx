"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Pencil, Plus, Upload } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type FiturTabel } from "@/components/data-table";
import { StatusBadge, type StatusLencana } from "@/components/status-badge";
import type { BarisWarga, OpsiKk } from "@/lib/data/warga";
import { maskNomor } from "@/lib/mask";
import type { WargaInput } from "@/lib/validators/warga";
import { ambilWargaAksi } from "./actions";
import { ModalWarga, WARGA_KOSONG, type MasterWarga } from "./modal-warga";

const STATUS: Record<BarisWarga["status"], { status: StatusLencana; label: string }> = {
  AKTIF: { status: "aktif", label: "Aktif" },
  PINDAH: { status: "nonaktif", label: "Pindah" },
  MENINGGAL: { status: "nonaktif", label: "Meninggal" },
};

interface Props {
  data: BarisWarga[];
  total: number;
  halaman: number;
  ukuranHalaman: number;
  master: MasterWarga;
  bolehImport: boolean;
}

interface StateModal {
  nilai: WargaInput;
  kk: OpsiKk | null;
  id?: string;
}

export function DaftarWarga({ data, total, halaman, ukuranHalaman, master, bolehImport }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<StateModal | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  async function ubah(id: string) {
    setGalat(null);
    const hasil = await ambilWargaAksi(id);
    if (!hasil) {
      setGalat("Warga tidak ditemukan.");
      return;
    }
    setModal({ nilai: hasil.nilai, kk: hasil.kk, id });
  }

  const kolom: ColumnDef<FiturTabel, BarisWarga>[] = [
    { header: "Nama", accessorKey: "nama_lengkap", cell: ({ row }) => <span className="font-semibold">{row.original.nama_lengkap}</span> },
    { header: "NIK", cell: ({ row }) => <span className="font-mono">{maskNomor(row.original.nik)}</span> },
    { header: "No KK", cell: ({ row }) => <span className="font-mono">{maskNomor(row.original.no_kk)}</span> },
    { header: "L/P", cell: ({ row }) => row.original.jenis_kelamin },
    { header: "Usia", cell: ({ row }) => `${row.original.usia} th` },
    { header: "RT/RW", cell: ({ row }) => `${row.original.rt}/${row.original.rw}` },
    {
      header: "Status",
      cell: ({ row }) => <StatusBadge {...STATUS[row.original.status]} />,
    },
    {
      header: "Aksi",
      cell: ({ row }) => (
        <span className="flex items-center">
          <Link
            href={`/kk/${row.original.kartu_keluarga_id}`}
            aria-label={`Lihat KK ${row.original.nama_lengkap}`}
            className="flex size-11 items-center justify-center rounded-lg text-teal hover:bg-teal-muda"
          >
            <Eye className="size-5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => ubah(row.original.id)}
            aria-label={`Ubah ${row.original.nama_lengkap}`}
            className="flex size-11 items-center justify-center rounded-lg text-teal hover:bg-teal-muda"
          >
            <Pencil className="size-5" aria-hidden />
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-3">
        {bolehImport && (
          <Link href="/import" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-teal bg-white px-4 font-semibold text-teal">
            <Upload className="size-5" aria-hidden /> Import Excel
          </Link>
        )}
        <button
          type="button"
          onClick={() => setModal({ nilai: WARGA_KOSONG, kk: null })}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90"
        >
          <Plus className="size-5" aria-hidden /> Tambah Warga
        </button>
      </div>
      {galat && <p role="alert" className="mb-3 text-galat">{galat}</p>}

      <DataTable<BarisWarga> kolom={kolom} data={data} total={total} halaman={halaman} ukuranHalaman={ukuranHalaman} keterangan="Daftar warga" />

      {modal && (
        <ModalWarga
          nilaiAwal={modal.nilai}
          kkAwal={modal.kk}
          wargaId={modal.id}
          master={master}
          onTutup={(tersimpan) => {
            setModal(null);
            if (tersimpan) router.refresh();
          }}
        />
      )}
    </>
  );
}
