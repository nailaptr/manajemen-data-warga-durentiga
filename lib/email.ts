interface Email {
  ke: string;
  subjek: string;
  // Email berisi tautan (verifikasi, atur ulang sandi) mengisi `tautan`; kabar biasa cukup `pesan`.
  tautan?: string;
  pesan?: string;
}

const NOMOR_PANJANG = /\d{16}/;

// Dev dan tes: isi email dicetak ke terminal. Produksi: dikirim lewat API Resend (fetch, tanpa paket tambahan);
// tanpa konfigurasi gagal keras agar tidak ada email yang diam-diam tidak terkirim.
export async function kirimEmail({ ke, subjek, tautan, pesan }: Email): Promise<void> {
  const isi = [pesan, tautan].filter(Boolean).join("\n\n");
  // Pengaman terakhir: NIK dan No KK (16 digit) tidak boleh ikut terkirim.
  if (NOMOR_PANJANG.test(subjek) || NOMOR_PANJANG.test(isi.replace(tautan ?? "", ""))) {
    throw new Error("Isi email memuat nomor 16 digit.");
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[email-dev] ke=${ke} | ${subjek}\n${isi}`);
    return;
  }
  const kunci = process.env.RESEND_API_KEY;
  const dari = process.env.EMAIL_DARI;
  if (!kunci || !dari) throw new Error("Pengiriman email belum dikonfigurasi.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${kunci}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: dari, to: ke, subject: subjek, text: isi }),
  });
  if (!res.ok) throw new Error(`Resend menolak email (status ${res.status}).`);
}

const sensor = (teks: string) => teks.replace(/\d{16}/g, "[nomor disembunyikan]");
const tautanApp = (jalur: string) => `${process.env.BETTER_AUTH_URL ?? ""}${jalur}`;

// Pengajuan baru dari warga, ke Ketua RT. Nama warga yang diubah tidak disebut; cukup jenisnya.
export function kirimPengajuanBaru(p: { ke: string; namaPengurus: string; namaPengaju: string; jenis: string }): Promise<void> {
  return kirimEmail({
    ke: p.ke,
    subjek: "Pengajuan perubahan data baru",
    pesan: `Halo ${p.namaPengurus}, ${p.namaPengaju} mengajukan perubahan data (${p.jenis.toLowerCase()}). Mohon diperiksa dan diputuskan.`,
    tautan: tautanApp("/pengajuan"),
  });
}

// Hasil pengajuan, ke warga yang mengajukan.
export function kirimHasilPengajuan(p: { ke: string; nama: string; jenis: string; disetujui: boolean; alasan?: string | null }): Promise<void> {
  const jenis = p.jenis.toLowerCase();
  return kirimEmail({
    ke: p.ke,
    subjek: p.disetujui ? "Pengajuan Anda disetujui" : "Pengajuan Anda ditolak",
    pesan: p.disetujui
      ? `Halo ${p.nama}, pengajuan ${jenis} Anda sudah disetujui. Data keluarga Anda sudah diperbarui.`
      : `Halo ${p.nama}, pengajuan ${jenis} Anda belum dapat disetujui.${p.alasan ? ` Alasan: ${sensor(p.alasan)}` : ""} Anda dapat mengajukan kembali setelah memperbaikinya.`,
    tautan: tautanApp("/pengajuan-saya"),
  });
}
