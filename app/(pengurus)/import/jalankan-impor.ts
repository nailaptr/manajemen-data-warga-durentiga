import { bagiBatch } from "@/lib/import/batch";
import type { HasilImpor } from "@/lib/import";
import type { Mapping } from "@/lib/import/types";
import type { GagalImpor, HasilBatch, RingkasanImpor } from "@/lib/validators/impor";

export interface AliasBaru {
  jenis: "pendidikan" | "pekerjaan";
  id: string;
  teks: string;
}

export interface ArgumenImpor {
  namaFile: string;
  mapping: Mapping;
  impor: HasilImpor;
  mode: "lewati" | "perbarui";
  alias: AliasBaru[];
  saatProgres: (selesai: number, total: number) => void;
}

export interface HasilJalan {
  ringkasan: RingkasanImpor | null;
  gagal: GagalImpor[];
  galat: string | null;
}

async function kirim<T>(isi: unknown): Promise<T> {
  const res = await fetch("/api/import-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(isi),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const pesan = typeof data === "object" && data !== null && "galat" in data ? String((data as { galat: unknown }).galat) : "";
    throw new Error(pesan || "Terjadi kesalahan di server");
  }
  return data as T;
}

// Baris Error dari pemeriksaan di browser ikut dilaporkan sebagai gagal (tidak dikirim ke server).
function gagalKlien(impor: HasilImpor): GagalImpor[] {
  return impor.baris
    .filter((b) => b.status === "error")
    .map((b) => ({
      nomor: b.data.nomor,
      pesan: b.temuan.filter((t) => t.level === "error").map((t) => t.pesan).join("; ").slice(0, 300),
    }));
}

// PRD 7.5: mulai -> proses per batch 200 baris (satu transaksi tiap batch) -> selesai.
export async function jalankanImpor(a: ArgumenImpor): Promise<HasilJalan> {
  const gagal = gagalKlien(a.impor);
  const mapping = Object.fromEntries(Object.entries(a.mapping).flatMap(([k, v]) => (v ? [[k, v.slice(0, 255)]] : [])));
  const { id } = await kirim<{ id: string }>({
    aksi: "mulai",
    nama_file: a.namaFile.slice(0, 255),
    total_baris: a.impor.ringkasan.total,
    mapping,
    gagal_klien: gagal,
    alias: a.alias,
  });

  const batch = bagiBatch(a.impor.kk);
  let galat: string | null = null;
  let terkirimBatch = 0;
  a.saatProgres(0, batch.length);
  try {
    for (const [i, baris] of batch.entries()) {
      const hasil = await kirim<HasilBatch>({ aksi: "proses", id, mode: a.mode, baris });
      gagal.push(...hasil.gagal);
      terkirimBatch = i + 1;
      a.saatProgres(i + 1, batch.length);
    }
  } catch (e) {
    galat = e instanceof Error ? e.message : "Terjadi kesalahan";
    // Batch yang gagal dan sesudahnya tidak tersimpan; laporkan agar tidak hilang dari daftar gagal.
    const terkirim = new Set(gagal.map((g) => g.nomor));
    for (const baris of batch.slice(terkirimBatch)) {
      for (const b of baris) if (!terkirim.has(b.nomor)) gagal.push({ nomor: b.nomor, pesan: "Tidak terkirim; import terhenti" });
    }
  }
  // Selalu tutup batch agar statusnya tidak menggantung BERJALAN.
  const ringkasan = await kirim<RingkasanImpor>({ aksi: "selesai", id }).catch(() => null);
  return { ringkasan, gagal, galat };
}
