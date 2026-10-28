interface Email {
  ke: string;
  subjek: string;
  tautan: string;
}

// Dev: tautan dicetak ke terminal. Produksi: pengiriman lewat Resend belum dipasang,
// jadi gagal keras agar tidak ada tautan yang diam-diam tidak terkirim.
export async function kirimEmail({ ke, subjek, tautan }: Email): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Pengiriman email belum dikonfigurasi.");
  }
  console.info(`[email-dev] ke=${ke} | ${subjek}\n${tautan}`);
}
