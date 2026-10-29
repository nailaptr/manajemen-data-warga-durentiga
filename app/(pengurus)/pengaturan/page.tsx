import Link from "next/link";
import { JudulHalaman } from "@/components/judul-halaman";
import { requireRole } from "@/lib/auth";
import { daftarKategoriUsia, daftarPekerjaan, daftarPendidikan, daftarWilayah } from "@/lib/data/pengaturan";
import { ADMIN } from "@/lib/navigasi";
import { TabKategoriUsia } from "./tab-kategori-usia";
import { TabReferensi } from "./tab-referensi";
import { TabWilayah } from "./tab-wilayah";

const TAB = [
  { id: "pendidikan", label: "Pendidikan" },
  { id: "pekerjaan", label: "Pekerjaan" },
  { id: "kategori-usia", label: "Kategori usia" },
  { id: "rt-rw", label: "RT dan RW" },
] as const;
type IdTab = (typeof TAB)[number]["id"];

function pilihTab(v: string | string[] | undefined): IdTab {
  const nilai = Array.isArray(v) ? v[0] : v;
  return TAB.find((t) => t.id === nilai)?.id ?? "pendidikan";
}

export default async function Pengaturan({ searchParams }: PageProps<"/pengaturan">) {
  const user = await requireRole(...ADMIN);
  const tab = pilihTab((await searchParams).tab);

  return (
    <>
      <JudulHalaman judul="Pengaturan" deskripsi="Kelola daftar pilihan dan definisi kategori tanpa perlu mengubah aplikasi" />

      <nav aria-label="Bagian pengaturan" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TAB.map((t) => (
          <Link
            key={t.id}
            href={`/pengaturan?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-5 font-semibold ${
              t.id === tab ? "border-teal text-teal" : "border-transparent text-teks-sekunder hover:text-teks"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "pendidikan" && <TabReferensi jenis="pendidikan" data={await daftarPendidikan()} />}
      {tab === "pekerjaan" && <TabReferensi jenis="pekerjaan" data={await daftarPekerjaan()} />}
      {tab === "kategori-usia" && <KategoriUsia />}
      {tab === "rt-rw" && <TabWilayah data={await daftarWilayah(user)} rwDefault={user.rw ?? ""} />}
    </>
  );
}

async function KategoriUsia() {
  const data = await daftarKategoriUsia();
  // key: setelah simpan, baris baru mendapat id dari server sehingga formulir dimuat ulang dari data terbaru.
  return <TabKategoriUsia key={JSON.stringify(data)} data={data} />;
}
