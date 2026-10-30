import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardList, Home, Mars, UserRound, Users, Venus } from "lucide-react";
import { ChipFilterAktif } from "@/components/chip-filter-aktif";
import { FilterStatistik } from "@/components/filter-statistik";
import { GrafikBar } from "@/components/grafik-bar";
import { GrafikDonut } from "@/components/grafik-donut";
import { GrafikPiramida } from "@/components/grafik-piramida";
import { JudulHalaman } from "@/components/judul-halaman";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import {
  daftarWargaTerfilter,
  kualitasData,
  perPekerjaan,
  perPendidikan,
  perRt,
  piramida,
  ringkasan,
} from "@/lib/data/stats";
import { adaFilter, filterKeQuery, type FilterUrl } from "@/lib/filter-url";
import { dua, labelRt, muatMaster, susunFilterUi } from "@/lib/filter-ui";
import { hariJakarta, parseFilter } from "@/lib/filters";
import { formatAngka, formatPersen } from "@/lib/format";
import { PENGURUS } from "@/lib/navigasi";

const JUMLAH_PRATINJAU = 4;

const kartu = "rounded-xl bg-card p-5 shadow-sm sm:p-6";

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireRole(...PENGURUS);
  const hasil = parseFilter(await searchParams);
  const galatFilter = hasil.ok ? null : hasil.galat;
  const parsed: FilterUrl = hasil.ok ? hasil.filter : {};
  // Ketua RT terkunci pada RT-nya: scopeWhere sudah membatasi data, parameter rt dibuang agar chip dan tautan bersih.
  const terkunci = user.role === "KETUA_RT";
  const filter: FilterUrl = terkunci ? { ...parsed, rt: [] } : parsed;
  const sedangFilter = adaFilter(filter);

  const [ring, pendidikan, pekerjaan, pir, rt, kualitas, daftar, master] =
    await Promise.all([
      ringkasan(user, filter),
      perPendidikan(user, filter),
      perPekerjaan(user, filter),
      piramida(user, filter),
      perRt(user, filter),
      kualitasData(user),
      daftarWargaTerfilter(user, filter, { ukuran: JUMLAH_PRATINJAU }),
      muatMaster(),
    ]);

  const rwUnik = [...new Set(rt.map((r) => r.rw))];
  const rwTeks = rwUnik.length === 1 ? `RW ${dua(rwUnik[0] ?? "0")}` : "seluruh RW";
  const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(hariJakarta());
  const labelRtDaftar =(r: { rw: string; rt: string }) => (rwUnik.length > 1 ? `RW ${dua(r.rw)} · ${labelRt(r.rt)}` : labelRt(r.rt));

  const { opsi, chip } = susunFilterUi({ basePath: "/dashboard", filter, master, rt });

  const jumlahHasil = daftar.total;
  const linkDetail = `/cari-warga${sedangFilter ? `?${filterKeQuery(filter)}` : ""}`;
  const masalah = [
    kualitas.wargaTanpaPekerjaan > 0 && { teks: `${formatAngka(kualitas.wargaTanpaPekerjaan)} warga belum ada pekerjaan`, ikon: <AlertTriangle className="size-5" aria-hidden /> },
    kualitas.kkTanpaKepala > 0 && { teks: `${formatAngka(kualitas.kkTanpaKepala)} KK tanpa kepala keluarga`, ikon: <AlertTriangle className="size-5" aria-hidden /> },
    kualitas.pengajuanMenunggu > 0 && {
      teks: `${formatAngka(kualitas.pengajuanMenunggu)} pengajuan warga menunggu persetujuan`,
      ikon: <ClipboardList className="size-5" aria-hidden />,
      href: "/pengajuan",
    },
  ].filter((m): m is { teks: string; ikon: React.JSX.Element; href?: string } => Boolean(m));

  return (
    <>
      <JudulHalaman judul="Dashboard" deskripsi={`Statistik data warga ${rwTeks} · Data per ${tanggal}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total warga aktif" nilai={formatAngka(ring.semua.warga)} ikon={<Users className="size-6" />} />
        <StatCard label="Total KK" nilai={formatAngka(ring.semua.kk)} catatan={`rata-rata ${String(ring.semua.rata_anggota).replace(".", ",")} anggota/KK`} ikon={<Home className="size-6" />} />
        <StatCard label="Laki-laki" nilai={formatAngka(ring.semua.laki)} ikon={<Mars className="size-6" />} />
        <StatCard label="Perempuan" nilai={formatAngka(ring.semua.perempuan)} ikon={<Venus className="size-6" />} />
      </div>

      <ul className="mt-4 flex list-none flex-wrap gap-3 p-0" aria-label="Kualitas data">
        {masalah.length === 0 && (
          <li className="rounded-xl bg-sukses-latar px-4 py-3 text-sm font-semibold text-sukses">Tidak ada masalah kualitas data</li>
        )}
        {masalah.map((m) => (
          <li key={m.teks}>
            {m.href ? (
              <Link href={m.href} className="flex min-h-11 items-center gap-3 rounded-xl bg-peringatan-latar px-4 text-sm font-semibold text-peringatan focus-visible:outline-2 focus-visible:outline-teal">
                {m.ikon}
                {m.teks}
              </Link>
            ) : (
              <span className="flex min-h-11 items-center gap-3 rounded-xl bg-peringatan-latar px-4 text-sm font-semibold text-peringatan">
                {m.ikon}
                {m.teks}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <FilterStatistik
          basePath="/dashboard"
          filter={filter}
          opsi={opsi}
          rtTerkunci={terkunci}
          chip={<ChipFilterAktif chip={chip} galat={galatFilter} />}
        />
      </div>

      <section aria-labelledby="judul-hasil" className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border-2 border-teal bg-card p-5 sm:px-6">
        <div>
          <h2 id="judul-hasil" className="text-sm text-teks-sekunder">
            Hasil filter
          </h2>
          <p className="text-4xl font-bold text-teal sm:text-5xl" aria-live="polite">
            {formatAngka(jumlahHasil)} warga
          </p>
          <p className="text-sm text-teks-sekunder">
            {formatPersen(jumlahHasil, ring.semua.warga)} dari {formatAngka(ring.semua.warga)} warga aktif
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-teks-sekunder">Pratinjau</p>
          {daftar.baris.length === 0 ? (
            <p className="mt-1 text-base text-teks">Tidak ada warga yang cocok.</p>
          ) : (
            <ul className="mt-1 flex list-none flex-wrap gap-2 p-0">
              {daftar.baris.map((w) => (
                <li key={w.id} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-teal-muda px-4 text-sm font-semibold text-teal">
                  <UserRound className="size-4" aria-hidden />
                  {w.nama_lengkap}, {w.usia}
                </li>
              ))}
              {jumlahHasil > daftar.baris.length && (
                <li className="inline-flex min-h-9 items-center px-2 text-sm text-teks-sekunder">
                  +{formatAngka(jumlahHasil - daftar.baris.length)} lainnya
                </li>
              )}
            </ul>
          )}
        </div>
        <Link href={linkDetail} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-5 text-base font-semibold text-white hover:bg-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
          Lihat detail warga
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="g-pendidikan" className={kartu}>
          <h2 id="g-pendidikan" className="text-xl font-bold text-teks">Pendidikan terakhir</h2>
          <p className="mb-4 text-sm text-teks-sekunder">Hasil filter dibanding seluruh warga</p>
          <GrafikBar ariaLabel="Pendidikan terakhir: hasil filter dibanding seluruh warga" adaFilter={sedangFilter} baris={pendidikan.map((b) => ({ label: b.nama, semua: b.semua, terfilter: b.terfilter }))} />
        </section>

        <section aria-labelledby="g-pekerjaan" className={kartu}>
          <h2 id="g-pekerjaan" className="text-xl font-bold text-teks">Pekerjaan</h2>
          <p className="mb-4 text-sm text-teks-sekunder">10 teratas, sisanya digabung ke Lainnya</p>
          <GrafikBar ariaLabel="Pekerjaan: hasil filter dibanding seluruh warga" adaFilter={sedangFilter} baris={pekerjaan.map((b) => ({ label: b.nama, semua: b.semua, terfilter: b.terfilter }))} />
        </section>

        <section aria-labelledby="g-piramida" className={kartu}>
          <h2 id="g-piramida" className="text-xl font-bold text-teks">Piramida penduduk</h2>
          <p className="mb-4 text-sm text-teks-sekunder">Kelompok usia 5 tahunan</p>
          <GrafikPiramida baris={pir} />
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="g-jk" className={kartu}>
            <h2 id="g-jk" className="text-xl font-bold text-teks">Jenis kelamin</h2>
            <p className="mb-4 text-sm text-teks-sekunder">
              Hasil filter: {formatAngka(ring.terfilter.laki)} laki-laki, {formatAngka(ring.terfilter.perempuan)} perempuan
            </p>
            <GrafikDonut laki={ring.semua.laki} perempuan={ring.semua.perempuan} />
          </section>

          <section aria-labelledby="g-rt" className={kartu}>
            <h2 id="g-rt" className="text-xl font-bold text-teks">Sebaran per RT</h2>
            <p className="mb-4 text-sm text-teks-sekunder">Hasil filter dibanding seluruh warga</p>
            <GrafikBar ariaLabel="Sebaran warga per RT: hasil filter dibanding seluruh warga" adaFilter={sedangFilter} baris={rt.map((r) => ({ label: labelRtDaftar(r), semua: r.semua, terfilter: r.terfilter }))} />
          </section>
        </div>
      </div>
    </>
  );
}
