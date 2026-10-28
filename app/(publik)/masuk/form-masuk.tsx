"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { kelasInput, kelasTombol } from "@/components/kartu-form";
import { authClient } from "@/lib/auth-client";

function pesanGalat(status: number | undefined, kode: string | undefined, pesanServer: string | undefined): string {
  if (status === 429 && pesanServer) return pesanServer;
  if (kode === "EMAIL_NOT_VERIFIED") return "Email belum diverifikasi. Periksa kotak masuk Anda.";
  if (status === 403 && pesanServer) return pesanServer;
  return "Email atau kata sandi salah.";
}

export function FormMasuk() {
  const router = useRouter();
  const [galat, setGalat] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMemproses(true);
    setGalat(null);
    const { error } = await authClient.signIn.email({
      email: String(data.get("email")),
      password: String(data.get("password")),
    });
    if (error) {
      setGalat(pesanGalat(error.status, error.code, error.message));
      setMemproses(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
      <label className="block text-sm font-medium text-teks-sekunder">
        Email
        <input name="email" type="email" required autoComplete="email" className={kelasInput} />
      </label>
      <label className="block text-sm font-medium text-teks-sekunder">
        Kata sandi
        <input name="password" type="password" required autoComplete="current-password" className={kelasInput} />
      </label>
      {galat && (
        <p role="alert" className="text-sm font-medium text-galat">
          {galat}
        </p>
      )}
      <button type="submit" disabled={memproses} className={kelasTombol}>
        {memproses ? "Memproses..." : "Masuk"}
      </button>
      <p className="text-center text-sm">
        <Link href="/lupa-sandi" className="font-medium text-teal">
          Lupa kata sandi?
        </Link>
      </p>
    </form>
  );
}
