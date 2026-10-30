"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { kelasInput, kelasTombol } from "@/components/kartu-form";
import { KATA_SANDI_MIN, klaimSchema } from "@/lib/validators/klaim";
import { daftarAksi } from "./actions";

const kelasLabel = "block text-base font-medium text-teks";
const kelasBagian = "pt-2 text-sm font-bold uppercase tracking-wide text-teal";
const kelasGalatKolom = "mt-1 block text-sm font-medium text-galat";

export function FormDaftar() {
  const [galat, setGalat] = useState<string | null>(null);
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [memproses, setMemproses] = useState(false);
  const [selesai, setSelesai] = useState(false);

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input = {
      email: String(data.get("email") ?? ""),
      kata_sandi: String(data.get("kata_sandi") ?? ""),
      nik: String(data.get("nik") ?? ""),
      no_kk: String(data.get("no_kk") ?? ""),
      tanggal_lahir: String(data.get("tanggal_lahir") ?? ""),
      setuju: data.get("setuju") === "on",
    };
    setGalat(null);
    const lokal = klaimSchema.safeParse(input);
    if (!lokal.success) {
      const pesan: Record<string, string> = {};
      for (const isu of lokal.error.issues) pesan[String(isu.path[0])] ??= isu.message;
      setKolom(pesan);
      return;
    }
    setKolom({});
    setMemproses(true);
    const hasil = await daftarAksi(input);
    setMemproses(false);
    if (hasil.ok) {
      setSelesai(true);
      return;
    }
    setKolom(hasil.kolom ?? {});
    setGalat(hasil.galat);
  }

  if (selesai) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-base text-teks">
          Pendaftaran diterima. Periksa email Anda untuk verifikasi, lalu tunggu persetujuan pengurus RT sebelum bisa masuk.
        </p>
        <Link href="/masuk" className="font-medium text-teal">
          Ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={kirim} noValidate className="space-y-4">
      <p className={kelasBagian}>Akun</p>
      <label className={kelasLabel}>
        Email
        <input name="email" type="email" autoComplete="email" placeholder="nama@email.com" aria-invalid={!!kolom.email} className={kelasInput} />
        {kolom.email && <span className={kelasGalatKolom}>{kolom.email}</span>}
      </label>
      <label className={kelasLabel}>
        Kata sandi
        <input name="kata_sandi" type="password" autoComplete="new-password" aria-invalid={!!kolom.kata_sandi} className={kelasInput} />
        <span className="mt-1 block text-sm text-teks-sekunder">Minimal {KATA_SANDI_MIN} karakter</span>
        {kolom.kata_sandi && <span className={kelasGalatKolom}>{kolom.kata_sandi}</span>}
      </label>

      <p className={kelasBagian}>Verifikasi data keluarga</p>
      <label className={kelasLabel}>
        NIK
        <input name="nik" inputMode="numeric" maxLength={16} autoComplete="off" placeholder="16 digit sesuai KTP" aria-invalid={!!kolom.nik} className={kelasInput} />
        {kolom.nik && <span className={kelasGalatKolom}>{kolom.nik}</span>}
      </label>
      <label className={kelasLabel}>
        No KK
        <input name="no_kk" inputMode="numeric" maxLength={16} autoComplete="off" placeholder="16 digit sesuai Kartu Keluarga" aria-invalid={!!kolom.no_kk} className={kelasInput} />
        {kolom.no_kk && <span className={kelasGalatKolom}>{kolom.no_kk}</span>}
      </label>
      <label className={kelasLabel}>
        Tanggal lahir
        <input name="tanggal_lahir" inputMode="numeric" maxLength={10} autoComplete="off" placeholder="DD/MM/YYYY" aria-invalid={!!kolom.tanggal_lahir} className={kelasInput} />
        {kolom.tanggal_lahir && <span className={kelasGalatKolom}>{kolom.tanggal_lahir}</span>}
      </label>

      <label className="flex min-h-11 items-start gap-3 text-base text-teks">
        <input name="setuju" type="checkbox" className="mt-0.5 size-6 shrink-0 accent-teal" />
        <span>
          Saya setuju dengan{" "}
          <Link href="/kebijakan-privasi" target="_blank" className="font-medium text-teal underline">
            Kebijakan Privasi
          </Link>{" "}
          dan bersedia datanya dikelola pengurus RW.
        </span>
      </label>
      {kolom.setuju && <p className={kelasGalatKolom}>{kolom.setuju}</p>}

      {galat && (
        <p role="alert" className="text-sm font-medium text-galat">
          {galat}
        </p>
      )}
      <button type="submit" disabled={memproses} className={kelasTombol}>
        {memproses ? "Memproses..." : "Daftar"}
      </button>
      <p className="text-center text-base text-teks-sekunder">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-medium text-teal">
          Masuk
        </Link>
      </p>
    </form>
  );
}
