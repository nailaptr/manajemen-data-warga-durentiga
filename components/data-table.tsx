"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

const fitur = tableFeatures({ rowPaginationFeature });
export type FiturTabel = typeof fitur;

interface Props<T extends object> {
  kolom: ColumnDef<typeof fitur, T>[];
  data: T[];
  // Total baris di server; halaman dan ukuran halaman datang dari URL (PRD 6, tabel besar).
  total: number;
  halaman: number;
  ukuranHalaman: number;
  galat?: string;
  keterangan: string;
}

// Pagination di server: tabel hanya merender `data` halaman ini, tombol mengubah ?halaman=.
export function DataTable<T extends object>({
  kolom,
  data,
  total,
  halaman,
  ukuranHalaman,
  galat,
  keterangan,
}: Props<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const table = useTable<typeof fitur, T>({
    features: fitur,
    columns: kolom,
    data,
    manualPagination: true,
    rowCount: total,
    state: { pagination: { pageIndex: halaman - 1, pageSize: ukuranHalaman } },
  });

  const jumlahHalaman = Math.max(1, Math.ceil(total / ukuranHalaman));

  function pindah(ke: number) {
    const baru = new URLSearchParams(params.toString());
    baru.set("halaman", String(ke));
    router.push(`${pathname}?${baru.toString()}`);
  }

  const kelasTombol =
    "min-h-11 min-w-11 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-teks disabled:cursor-not-allowed disabled:text-teks-sekunder disabled:opacity-60";

  return (
    <div className="rounded-xl bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <caption className="sr-only">{keterangan}</caption>
          <thead className="border-b border-border text-sm text-teks-sekunder">
            {table.getHeaderGroups().map((grup) => (
              <tr key={grup.id}>
                {grup.headers.map((h) => (
                  <th key={h.id} scope="col" className="px-4 py-3 font-semibold">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((baris) => (
              <tr key={baris.id} className="border-b border-border/60 last:border-0">
                {baris.getAllCells().map((sel) => (
                  <td key={sel.id} className="px-4 py-3">
                    {flexRender(sel.column.columnDef.cell, sel.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {galat ? (
        <p role="alert" className="px-4 py-8 text-center text-galat">
          {galat}
        </p>
      ) : (
        data.length === 0 && <p className="px-4 py-8 text-center text-teks-sekunder">Tidak ada data yang cocok.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="text-sm text-teks-sekunder">
          Halaman {halaman} dari {jumlahHalaman} · {total} baris
        </p>
        <div className="flex gap-2">
          <button type="button" className={kelasTombol} disabled={halaman <= 1} onClick={() => pindah(halaman - 1)}>
            Sebelumnya
          </button>
          <button
            type="button"
            className={kelasTombol}
            disabled={halaman >= jumlahHalaman}
            onClick={() => pindah(halaman + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  );
}
