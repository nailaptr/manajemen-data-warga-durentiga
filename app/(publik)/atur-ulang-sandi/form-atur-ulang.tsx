"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { kelasInput, kelasTombol } from "@/components/kartu-form";
import { authClient } from "@/lib/auth-client";

const SANDI_MIN = 8;

export function FormAturUlang({ token }: { token: string }) {
  const [galat, setGalat] = useState<string | null>(null);
  const [selesai, setSelesai] = useState(false);
  const [memproses, setMemproses] = useState(false);

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const sandi = String(data.get("password"));
    if (sandi.length < SANDI_MIN) {
      setGalat(`Kata sandi minimal ${SANDI_MIN} karakter.`);
      return;
    }
    if (sandi !== String(data.get("konfirmasi"))) {
      setGalat("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setMemproses(true);
    setGalat(null);
    const { error } = await authClient.resetPassword({ newPassword: sandi, token });
    setMemproses(false);
    if (error) {
      setGalat("Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
      return;
    }
    setSelesai(true);
  }

  if (selesai) {
    return (
      <p role="status" className="text-base">
        Kata sandi diperbarui.{" "}
        <Link href="/masuk" className="font-medium text-teal">
          Masuk
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
      <label className="block text-sm font-medium text-teks-sekunder">
        Kata sandi baru
        <input name="password" type="password" required autoComplete="new-password" className={kelasInput} />
      </label>
      <label className="block text-sm font-medium text-teks-sekunder">
        Ulangi kata sandi baru
        <input name="konfirmasi" type="password" required autoComplete="new-password" className={kelasInput} />
      </label>
      {galat && (
        <p role="alert" className="text-sm font-medium text-galat">
          {galat}
        </p>
      )}
      <button type="submit" disabled={memproses} className={kelasTombol}>
        {memproses ? "Memproses..." : "Simpan kata sandi"}
      </button>
    </form>
  );
}
