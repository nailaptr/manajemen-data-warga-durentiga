"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { BarisPiramida } from "@/lib/data/stats";
import { Legenda } from "./grafik-bar";

const TINGGI_BARIS = 26;

interface LabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
}

type Sisi = "L" | "P";

// Dua bar sejajar (laki-laki ke kiri, perempuan ke kanan) dengan label kelompok di tengah.
// Bagian gelap = hasil filter, dihitung dari bar yang sama sehingga total tetap seluruh warga.
export function GrafikPiramida({ baris }: { baris: BarisPiramida[] }) {
  const maks = Math.max(1, ...baris.flatMap((b) => [b.L.semua, b.P.semua]));
  const tinggi = baris.length * TINGGI_BARIS;

  return (
    <figure aria-label="Piramida penduduk menurut kelompok usia 5 tahunan dan jenis kelamin" className="m-0">
      <div className="mb-2 flex justify-between text-sm font-semibold text-teks">
        <span>Laki-laki</span>
        <span>Perempuan</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2" aria-hidden>
        <Sayap baris={baris} sisi="L" maks={maks} tinggi={tinggi} />
        <ul className="m-0 list-none p-0 text-center text-sm text-teks-sekunder" style={{ height: tinggi }}>
          {baris.map((b) => (
            <li key={b.kelompok} className="flex items-center justify-center" style={{ height: TINGGI_BARIS }}>
              {b.kelompok}
            </li>
          ))}
        </ul>
        <Sayap baris={baris} sisi="P" maks={maks} tinggi={tinggi} />
      </div>
      <table className="sr-only">
        <caption>Piramida penduduk</caption>
        <thead>
          <tr>
            <th>Kelompok usia</th>
            <th>Laki-laki hasil filter</th>
            <th>Laki-laki seluruh warga</th>
            <th>Perempuan hasil filter</th>
            <th>Perempuan seluruh warga</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.kelompok}>
              <td>{b.kelompok}</td>
              <td>{b.L.terfilter}</td>
              <td>{b.L.semua}</td>
              <td>{b.P.terfilter}</td>
              <td>{b.P.semua}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Legenda tambahan={[{ warna: "var(--color-laki)", label: "Laki-laki" }]} />
    </figure>
  );
}

function Sayap({ baris, sisi, maks, tinggi }: { baris: BarisPiramida[]; sisi: Sisi; maks: number; tinggi: number }) {
  const data = baris.map((b) => ({
    kelompok: b.kelompok,
    terfilter: b[sisi].terfilter,
    sisa: Math.max(b[sisi].semua - b[sisi].terfilter, 0),
  }));
  const kiri = sisi === "L";

  // Angka hasil filter di ujung luar bar, hanya bila ada.
  const labelUjung = ({ x, y, width, height, index }: LabelProps) => {
    const n = data[index ?? -1]?.terfilter ?? 0;
    if (!n) return null;
    const mulai = Number(x);
    const lebar = Number(width);
    return (
      <text
        x={kiri ? mulai - 6 : mulai + lebar + 6}
        y={Number(y) + Number(height) / 2}
        dy={5}
        textAnchor={kiri ? "end" : "start"}
        fontSize={13}
        fontWeight={700}
        fill="var(--color-teal)"
      >
        {n}
      </text>
    );
  };

  return (
    <div style={{ height: tinggi }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 24, bottom: 0, left: 24 }} barSize={16}>
          <XAxis type="number" hide domain={[0, maks]} reversed={kiri} />
          <YAxis type="category" dataKey="kelompok" hide />
          <Bar dataKey="terfilter" stackId="u" fill="var(--color-teal)" isAnimationActive={false} />
          <Bar
            dataKey="sisa"
            stackId="u"
            fill={kiri ? "var(--color-laki)" : "var(--color-grafik-semua)"}
            isAnimationActive={false}
          >
            <LabelList content={labelUjung} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
