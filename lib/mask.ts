// NIK dan No KK tampil dimasking di tabel: 4 digit awal dan 4 digit akhir (PRD 11, data pribadi).
export function maskNomor(nomor: string): string {
  if (nomor.length !== 16) return "●".repeat(nomor.length);
  return `${nomor.slice(0, 4)}${"●".repeat(8)}${nomor.slice(12)}`;
}
