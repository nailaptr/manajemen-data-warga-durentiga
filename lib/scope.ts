import type { Prisma } from "../generated/prisma/client";
import type { Pengguna } from "./auth";

type Entitas = "warga" | "kartu_keluarga" | "pengajuan";
type PenggunaScope = Pick<Pengguna, "role" | "wilayah_id" | "rw" | "warga_id">;

// Cakupan akses (PRD 2.2) sebagai filter Prisma. Bukan filter status: pemanggil tetap
// menambahkan deleted_at / status sendiri. Data pengguna yang tidak lengkap (mis. Ketua RT
// tanpa wilayah_id) tidak mendapat apa pun, bukan semuanya.
function kkWhere(user: PenggunaScope): Prisma.KartuKeluargaWhereInput | null {
  switch (user.role) {
    case "SUPER_ADMIN":
      return {};
    case "ADMIN_RW":
      return user.rw ? { wilayah: { rw: user.rw } } : null;
    case "KETUA_RT":
      return user.wilayah_id ? { wilayah_id: user.wilayah_id } : null;
    case "WARGA":
      return user.warga_id
        ? { warga: { some: { id: user.warga_id, deleted_at: null } } }
        : null;
    default:
      return null;
  }
}

const TIDAK_ADA = { id: { in: [] } };

export function scopeWhere(user: PenggunaScope, entity: "warga"): Prisma.WargaWhereInput;
export function scopeWhere(user: PenggunaScope, entity: "kartu_keluarga"): Prisma.KartuKeluargaWhereInput;
export function scopeWhere(user: PenggunaScope, entity: "pengajuan"): Prisma.PengajuanWhereInput;
export function scopeWhere(
  user: PenggunaScope,
  entity: Entitas,
): Prisma.WargaWhereInput | Prisma.KartuKeluargaWhereInput | Prisma.PengajuanWhereInput {
  const kk = kkWhere(user);
  if (!kk) return TIDAK_ADA;
  if (entity === "kartu_keluarga") return kk;
  // Super Admin: filter kosong, tanpa relasi tambahan.
  if (Object.keys(kk).length === 0) return {};
  return { kartu_keluarga: kk };
}
