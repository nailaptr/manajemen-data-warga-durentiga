import * as XLSX from "xlsx";
import { BATAS_BARIS, BATAS_UKURAN_BYTE, GalatImpor, type BarisSel, type HasilParse } from "./types";

// Rapikan spasi: NBSP dan spasi ganda menjadi satu spasi, ujung dipangkas (PRD 7.3).
function rapikan(teks: string): string {
  return teks.replace(/[\s ]+/g, " ").trim();
}

function teksSel(sel: XLSX.CellObject | undefined): string {
  if (!sel || sel.v === undefined || sel.v === null) return "";
  // Tanggal bertanda format tanggal dikirim sebagai nomor seri agar tidak bergantung pada format lokal ("1/2/90").
  if (sel.t === "n" && typeof sel.v === "number" && sel.z && XLSX.SSF.is_date(String(sel.z))) return String(sel.v);
  // Selain itu pakai teks yang tampil di Excel: sel Teks tetap utuh, sel angka berformat Umum yang
  // berubah menjadi 3.17E+15 tetap terlihat sebagai notasi ilmiah sehingga validasi bisa menandainya.
  return rapikan(sel.w ?? String(sel.v));
}

// Membaca .xlsx atau .csv dari ArrayBuffer/Uint8Array, jadi bisa jalan di browser. Semua sel dibaca sebagai teks
// (raw: true menahan SheetJS agar tidak mengubah isi CSV menjadi angka, sehingga nol di depan tidak hilang).
export function parseBerkas(isi: ArrayBuffer | Uint8Array): HasilParse {
  const byte = isi instanceof Uint8Array ? isi : new Uint8Array(isi);
  if (byte.byteLength > BATAS_UKURAN_BYTE) throw new GalatImpor("Ukuran file melebihi 5 MB");
  if (byte.byteLength === 0) throw new GalatImpor("File kosong");

  let buku: XLSX.WorkBook;
  try {
    buku = XLSX.read(byte, { type: "array", raw: true, cellDates: false, cellText: true, codepage: 65001 });
  } catch {
    throw new GalatImpor("File tidak bisa dibaca. Gunakan file .xlsx atau .csv");
  }
  const lembar = buku.Sheets[buku.SheetNames[0] ?? ""];
  if (!lembar?.["!ref"]) throw new GalatImpor("File tidak berisi data");

  const rentang = XLSX.utils.decode_range(lembar["!ref"]);
  const semua: BarisSel[] = [];
  for (let r = rentang.s.r; r <= rentang.e.r; r++) {
    const sel: string[] = [];
    for (let c = rentang.s.c; c <= rentang.e.c; c++) sel.push(teksSel(lembar[XLSX.utils.encode_cell({ r, c })]));
    if (sel.some((s) => s !== "")) semua.push({ nomor: r + 1, sel });
  }

  const [judul, ...data] = semua;
  if (!judul) throw new GalatImpor("File tidak berisi data");
  if (data.length === 0) throw new GalatImpor("File hanya berisi header, tanpa baris data");
  if (data.length > BATAS_BARIS) throw new GalatImpor(`File melebihi ${BATAS_BARIS} baris`);
  return { header: judul.sel, baris: data };
}
