"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { kelasInput, kelasTombol } from "@/components/kartu-form";
import { authClient } from "@/lib/auth-client";

export function FormLupaSandi() {
  const [terkirim, setTerkirim] = useState(false);
  const [memproses, setMemproses] = useState(false);

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMemproses(true);
    // Respons selalu sama agar tidak membuka email mana yang terdaftar.
    await authClient.requestPasswordReset({
      email: String(data.get("email")),
      redirectTo: "/atur-ulang-sandi",
    });
    setTerkirim(true);
    setMemproses(false);
  }

  if (terkirim) {
    return (
      <p role="status" className="text-base text-teks">
        Jika email terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim. Tautan berlaku 1 jam.
      </p>
    );
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
      <label className="block text-sm font-medium text-teks-sekunder">
        Email
        <input name="email" type="email" required autoComplete="email" className={kelasInput} />
      </label>
      <button type="submit" disabled={memproses} className={kelasTombol}>
        {memproses ? "Memproses..." : "Kirim tautan"}
      </button>
      <p className="text-center text-sm">
        <Link href="/masuk" className="font-medium text-teal">
          Kembali ke halaman masuk
        </Link>
      </p>
    </form>
  );
}
