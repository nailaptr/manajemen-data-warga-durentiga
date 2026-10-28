"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function TombolKeluar() {
  const router = useRouter();
  async function keluar() {
    await authClient.signOut();
    router.push("/masuk");
    router.refresh();
  }
  return (
    <button onClick={keluar} className="rounded-lg border border-teal px-4 py-2 text-base font-semibold text-teal">
      Keluar
    </button>
  );
}
