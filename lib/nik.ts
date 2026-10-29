// BR-10: digit ke-7 sampai ke-12 NIK = DDMMYY tanggal lahir (tanggal + 40 untuk perempuan).
// Hanya hari, bulan, dan dua digit tahun yang dibandingkan; abad tidak bisa dibaca dari NIK.
// Hasilnya peringatan, bukan penolakan.
export function nikCocokTanggalLahir(nik: string, tanggalLahir: string, jenisKelamin: "L" | "P"): boolean | null {
  if (!/^\d{16}$/.test(nik) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir)) return null;
  const hari = Number(nik.slice(6, 8)) - (jenisKelamin === "P" ? 40 : 0);
  const bulan = Number(nik.slice(8, 10));
  const tahun = nik.slice(10, 12);
  return (
    hari === Number(tanggalLahir.slice(8, 10)) &&
    bulan === Number(tanggalLahir.slice(5, 7)) &&
    tahun === tanggalLahir.slice(2, 4)
  );
}
