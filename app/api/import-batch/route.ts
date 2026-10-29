import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { GalatBatch, mulaiImpor, prosesBatch, selesaiImpor } from "@/lib/data/impor";
import { ADMIN } from "@/lib/navigasi";
import { permintaanImporSchema } from "@/lib/validators/impor";

// Wizard import mengirim hasil parse per batch (PRD 7.5). File Excel tidak pernah sampai ke server.
const galat = (pesan: string, status: number) => NextResponse.json({ galat: pesan }, { status });

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return galat("Belum masuk", 401);
  if (!ADMIN.includes(user.role)) return galat("Tidak berwenang", 403);

  let isi: unknown;
  try {
    isi = await request.json();
  } catch {
    return galat("Isi permintaan bukan JSON", 400);
  }
  const p = permintaanImporSchema.safeParse(isi);
  if (!p.success) return galat("Data import tidak valid", 400);

  try {
    switch (p.data.aksi) {
      case "mulai":
        return NextResponse.json({ id: await mulaiImpor(user, p.data) });
      case "proses":
        return NextResponse.json(await prosesBatch(user, p.data.id, p.data.mode, p.data.baris));
      case "selesai":
        return NextResponse.json(await selesaiImpor(user, p.data.id));
    }
  } catch (e) {
    if (e instanceof GalatBatch) return galat(e.message, 404);
    console.error("Import gagal", e instanceof Error ? e.name : "galat");
    return galat("Terjadi kesalahan di server", 500);
  }
}
