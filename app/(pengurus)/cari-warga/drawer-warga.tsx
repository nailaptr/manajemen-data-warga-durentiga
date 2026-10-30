"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, X } from "lucide-react";
import type { DetailWarga } from "@/lib/data/warga";
import { detailWargaAksi, tampilkanLengkapAksi } from "./actions";

const HUBUNGAN: Record<string, string> = {
  KEPALA_KELUARGA: "Kepala Keluarga", ISTRI: "Istri", SUAMI: "Suami", ANAK: "Anak", MENANTU: "Menantu",
  CUCU: "Cucu", ORANG_TUA: "Orang Tua", MERTUA: "Mertua", FAMILI_LAIN: "Famili Lain", LAINNYA: "Lainnya",
};

const tampil = (v: string | null | undefined) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replaceAll("_", " ") : "-");
const tanggalId = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

interface Props {
  wargaId: string;
  onTutup: () => void;
}

// Drawer detail warga. NIK dan No KK dimasking sampai "Tampilkan lengkap" ditekan; setiap penekanan tercatat di server.
export function DrawerWarga({ wargaId, onTutup }: Props) {
  const [detail, setDetail] = useState<DetailWarga | null>(null);
  const [nomor, setNomor] = useState<{ nik: string; no_kk: string } | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [membuka, setMembuka] = useState(false);
  const tombolTutup = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let batal = false;
    detailWargaAksi(wargaId).then((h) => {
      if (batal) return;
      if (h.ok) setDetail(h.detail);
      else setGalat(h.galat);
    });
    return () => {
      batal = true;
    };
  }, [wargaId]);

  useEffect(() => {
    tombolTutup.current?.focus();
    const tekan = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, [onTutup]);

  async function tampilkanLengkap() {
    setMembuka(true);
    setGalat(null);
    const h = await tampilkanLengkapAksi(wargaId);
    setMembuka(false);
    if (h.ok) setNomor({ nik: h.nik, no_kk: h.no_kk });
    else setGalat(h.galat);
  }

  const baris: [string, string][] = detail
    ? [
        ["NIK", nomor?.nik ?? detail.nik_masked],
        ["No KK", nomor?.no_kk ?? detail.no_kk_masked],
        ["Jenis kelamin", detail.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"],
        ["Tempat, tanggal lahir", `${detail.tempat_lahir ?? "-"}, ${tanggalId(detail.tanggal_lahir)}`],
        ["Usia", `${detail.usia} tahun`],
        ["Agama", tampil(detail.agama)],
        ["Golongan darah", detail.golongan_darah ?? "-"],
        ["Pendidikan", detail.pendidikan ?? "-"],
        ["Pekerjaan", detail.pekerjaan ?? "-"],
        ["Status perkawinan", tampil(detail.status_perkawinan)],
        ["Hubungan keluarga", HUBUNGAN[detail.hubungan_keluarga] ?? tampil(detail.hubungan_keluarga)],
        ["Alamat", `${detail.alamat}, RT ${detail.rt}/RW ${detail.rw}`],
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onTutup}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-drawer"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="judul-drawer" className="text-xl font-bold text-teks">
            {detail?.nama_lengkap ?? "Detail warga"}
          </h2>
          <button
            ref={tombolTutup}
            type="button"
            onClick={onTutup}
            aria-label="Tutup detail"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-teks-sekunder hover:bg-teal-muda focus-visible:outline-2 focus-visible:outline-teal"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {galat && (
          <p role="alert" className="mt-4 text-galat">
            {galat}
          </p>
        )}
        {!detail && !galat && <p className="mt-4 text-teks-sekunder">Memuat…</p>}

        {detail && (
          <>
            <dl className="mt-5 grid gap-3">
              {baris.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-teks-sekunder">{k}</dt>
                  <dd className={`text-base text-teks ${k === "NIK" || k === "No KK" ? "font-mono" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              {!nomor && (
                <button
                  type="button"
                  onClick={tampilkanLengkap}
                  disabled={membuka}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-teal px-4 font-semibold text-teal hover:bg-teal-muda disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-teal"
                >
                  <Eye className="size-5" aria-hidden /> {membuka ? "Membuka…" : "Tampilkan lengkap"}
                </button>
              )}
              <Link
                href={`/kk/${detail.kartu_keluarga_id}`}
                className="inline-flex min-h-11 items-center rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                Lihat KK
              </Link>
            </div>
            {!nomor && <p className="mt-3 text-sm text-teks-sekunder">Membuka NIK dan No KK lengkap dicatat di log aktivitas.</p>}
          </>
        )}
      </aside>
    </div>
  );
}
