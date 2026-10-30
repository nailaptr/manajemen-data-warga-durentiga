"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatAngka, formatPersen } from "@/lib/format";

interface Props {
  laki: number;
  perempuan: number;
}

// Donut seluruh warga menurut jenis kelamin; angka hasil filter ditulis di subjudul kartu.
export function GrafikDonut({ laki, perempuan }: Props) {
  const total = laki + perempuan;
  const irisan = [
    { nama: "Perempuan", nilai: perempuan, warna: "var(--color-teal)" },
    { nama: "Laki-laki", nilai: laki, warna: "var(--color-laki)" },
  ];
  return (
    <figure
      aria-label={`Jenis kelamin seluruh warga: ${perempuan} perempuan, ${laki} laki-laki`}
      className="m-0 flex flex-wrap items-center gap-6"
    >
      <div className="relative size-44 shrink-0" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={irisan}
              dataKey="nilai"
              nameKey="nama"
              innerRadius={52}
              outerRadius={84}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {irisan.map((i) => (
                <Cell key={i.nama} fill={i.warna} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm text-teks-sekunder">Total</span>
          <span className="text-2xl font-bold text-teks">{formatAngka(total)}</span>
        </div>
      </div>
      <ul className="m-0 list-none space-y-2 p-0 text-base text-teks">
        {irisan.map((i) => (
          <li key={i.nama} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: i.warna }} aria-hidden />
            {i.nama} {formatAngka(i.nilai)} ({formatPersen(i.nilai, total)})
          </li>
        ))}
      </ul>
    </figure>
  );
}
