import { prisma } from "@/lib/db";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class Rollback extends Error {}

// Setiap kasus berjalan di transaksi yang selalu dibatalkan, sehingga database tetap bersih.
export async function dalamRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}
