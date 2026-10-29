"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const KELAS_BAWAAN = "min-h-11 rounded-lg border border-teal px-4 text-base font-semibold text-teal";

export function TombolKeluar({ className = KELAS_BAWAAN }: { className?: string }) {
  const router = useRouter();
  async function keluar() {
    await authClient.signOut();
    router.push("/masuk");
    router.refresh();
  }
  return (
    <button onClick={keluar} className={className}>
      Keluar
    </button>
  );
}
