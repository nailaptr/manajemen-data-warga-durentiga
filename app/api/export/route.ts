import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { GalatExport, exportWarga } from "@/lib/data/export";
import { parseFilter } from "@/lib/filters";
import { PENGURUS } from "@/lib/navigasi";

// Export hasil Cari Warga: GET /api/export?format=xlsx|csv&<filter>&q=. Hanya pengurus; cakupan RW/RT
// ditegakkan di server oleh scopeWhere (Ketua RT hanya RT-nya, AC-04). Warga tidak berwenang.
const galat = (pesan: string, status: number) => NextResponse.json({ galat: pesan }, { status });

const formatSchema = z.enum(["xlsx", "csv"]);

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return galat("Belum masuk", 401);
  if (!(PENGURUS as readonly string[]).includes(user.role)) return galat("Tidak berwenang", 403);

  const params = new URL(request.url).searchParams;
  const format = formatSchema.safeParse(params.get("format"));
  if (!format.success) return galat("Format harus xlsx atau csv", 400);
  const q = params.get("q")?.slice(0, 100) || undefined;
  const filter = parseFilter(Object.fromEntries(params));
  if (!filter.ok) return galat(filter.galat, 400);

  try {
    const hasil = await exportWarga(user, filter.filter, q, format.data);
    return new Response(hasil.isi as BodyInit, {
      headers: {
        "Content-Type": hasil.jenis,
        "Content-Disposition": `attachment; filename="${hasil.namaBerkas}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof GalatExport) return galat(e.message, 422);
    console.error("Export gagal", e instanceof Error ? e.name : "galat");
    return galat("Terjadi kesalahan di server", 500);
  }
}
