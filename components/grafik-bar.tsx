"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { formatAngka } from "@/lib/format";

export interface BarisBar {
  label: string;
  semua: number;
  terfilter: number;
}

const TINGGI_BARIS = 34;
const LEBAR_LABEL = 150;
const LEBAR_NILAI = 80;

interface TickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
}

// Bar horizontal: bagian gelap = hasil filter, bagian pucat = sisa seluruh warga (tumpuk, total = seluruh warga).
export function GrafikBar({ baris, ariaLabel, adaFilter }: { baris: BarisBar[]; ariaLabel: string; adaFilter: boolean }) {
  const data = baris.map((b) => ({ ...b, sisa: Math.max(b.semua - b.terfilter, 0) }));
  const maks = Math.max(1, ...baris.map((b) => b.semua));
  const tebal = (label?: string) => adaFilter && (baris.find((b) => b.label === label)?.terfilter ?? 0) > 0;

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <div style={{ height: data.length * TINGGI_BARIS + 8 }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }} barSize={18}>
            <XAxis type="number" hide domain={[0, maks]} />
            <YAxis
              yAxisId="label"
              type="category"
              dataKey="label"
              width={LEBAR_LABEL}
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={({ x, y, payload }: TickProps) => (
                <text
                  x={Number(x) - 4}
                  y={Number(y)}
                  dy={5}
                  textAnchor="end"
                  fontSize={14}
                  fontWeight={tebal(payload?.value) ? 700 : 400}
                  fill="var(--color-teks)"
                >
                  {payload?.value}
                </text>
              )}
            />
            <YAxis
              yAxisId="nilai"
              orientation="right"
              type="category"
              dataKey="label"
              width={LEBAR_NILAI}
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={({ x, y, payload }: TickProps) => {
                const b = baris.find((r) => r.label === payload?.value);
                return (
                  <text
                    x={Number(x) + LEBAR_NILAI - 8}
                    y={Number(y)}
                    dy={5}
                    textAnchor="end"
                    fontSize={14}
                    fontWeight={tebal(payload?.value) ? 700 : 400}
                    fill={tebal(payload?.value) ? "var(--color-teal)" : "var(--color-teks-sekunder)"}
                  >
                    {b ? `${formatAngka(b.terfilter)} / ${formatAngka(b.semua)}` : ""}
                  </text>
                );
              }}
            />
            <Bar
              yAxisId="label"
              dataKey="terfilter"
              stackId="a"
              fill="var(--color-teal)"
              background={{ fill: "var(--color-grafik-jalur)", radius: 6 }}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="label"
              dataKey="sisa"
              stackId="a"
              fill="var(--color-grafik-semua)"
              radius={[0, 6, 6, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Kategori</th>
            <th>Hasil filter</th>
            <th>Seluruh warga</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.label}>
              <td>{b.label}</td>
              <td>{b.terfilter}</td>
              <td>{b.semua}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Legenda />
    </figure>
  );
}

export function Legenda({ tambahan }: { tambahan?: { warna: string; label: string }[] }) {
  const item = [
    ...(tambahan ?? []),
    { warna: "var(--color-teal)", label: "Hasil filter" },
    { warna: "var(--color-grafik-semua)", label: "Seluruh warga" },
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-teks-sekunder" aria-hidden>
      {item.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ background: i.warna }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
