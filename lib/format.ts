const ANGKA = new Intl.NumberFormat("id-ID");
const PERSEN = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export const formatAngka = (n: number): string => ANGKA.format(n);

// Persen dari bagian terhadap total; total 0 menghasilkan 0%.
export const formatPersen = (bagian: number, total: number): string =>
  `${PERSEN.format(total ? (bagian / total) * 100 : 0)}%`;
