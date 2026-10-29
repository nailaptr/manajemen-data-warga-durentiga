import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";

type Klien = Pick<Prisma.TransactionClient, "activityLog">;

// Hanya id entitas dan ringkasan non-pribadi; jangan pernah NIK, No KK, atau tanggal lahir.
export async function catatAktivitas(
  data: { userId: string; aksi: string; entitas: string; entitasId: string; perubahan?: Prisma.InputJsonValue },
  klien: Klien = prisma,
) {
  await klien.activityLog.create({
    data: {
      user_id: data.userId,
      aksi: data.aksi,
      entitas: data.entitas,
      entitas_id: data.entitasId,
      perubahan: data.perubahan,
    },
  });
}
