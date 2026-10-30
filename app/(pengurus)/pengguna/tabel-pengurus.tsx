"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Pencil, Plus, ShieldOff, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { NAMA_PERAN } from "@/lib/navigasi";
import type { BarisPengurus } from "@/lib/data/pengguna";
import { DialogPengaturan, kelasField } from "../pengaturan/dialog-pengaturan";
import { resetSandiPengurusAksi, tambahPengurusAksi, ubahPengurusAksi, ubahStatusPengurusAksi } from "./actions";

export interface OpsiWilayah {
  id: string;
  rw: string;
  rt: string;
}

interface Formulir {
  id?: string;
  nama: string;
  email: string;
  role: "ADMIN_RW" | "KETUA_RT";
  wilayah_id: string;
  rw: string;
}

const formatTanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

const STATUS: Record<BarisPengurus["status"], { status: "aktif" | "nonaktif" | "menunggu" | "ditolak"; label: string }> = {
  AKTIF: { status: "aktif", label: "Aktif" },
  NONAKTIF: { status: "nonaktif", label: "Nonaktif" },
  MENUNGGU_VERIFIKASI: { status: "menunggu", label: "Menunggu" },
  DITOLAK: { status: "ditolak", label: "Ditolak" },
};

const tombolIkon = "flex size-11 items-center justify-center rounded-lg hover:bg-latar";

export function TabelPengurus({
  data,
  wilayah,
  superAdmin,
}: {
  data: BarisPengurus[];
  wilayah: OpsiWilayah[];
  superAdmin: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Formulir | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "galat" | "info"; teks: string } | null>(null);
  const daftarRw = [...new Set(wilayah.map((w) => w.rw))];
  const pilihanPeran: ("ADMIN_RW" | "KETUA_RT")[] = superAdmin ? ["ADMIN_RW", "KETUA_RT"] : ["KETUA_RT"];

  const bukaTambah = () =>
    setForm({ nama: "", email: "", role: "KETUA_RT", wilayah_id: wilayah[0]?.id ?? "", rw: daftarRw[0] ?? "" });

  async function jalankan(aksi: () => ReturnType<typeof resetSandiPengurusAksi>) {
    setPesan(null);
    const hasil = await aksi();
    if (!hasil.ok) setPesan({ jenis: "galat", teks: hasil.galat });
    else if (hasil.info) setPesan({ jenis: "info", teks: hasil.info });
    router.refresh();
  }

  function ubahStatus(b: BarisPengurus) {
    const nonaktif = b.status === "AKTIF";
    const pertanyaan = nonaktif ? `Nonaktifkan akun ${b.nama}? Sesinya langsung berakhir.` : `Aktifkan kembali akun ${b.nama}?`;
    if (window.confirm(pertanyaan)) void jalankan(() => ubahStatusPengurusAksi(b.id, nonaktif ? "NONAKTIF" : "AKTIF"));
  }

  function resetSandi(b: BarisPengurus) {
    if (window.confirm(`Kirim tautan atur ulang kata sandi ke ${b.email}?`)) void jalankan(() => resetSandiPengurusAksi(b.id));
  }

  return (
    <>
      {pesan && (
        <p role={pesan.jenis === "galat" ? "alert" : "status"} className={`mb-3 rounded-lg px-4 py-3 ${pesan.jenis === "galat" ? "bg-galat-latar text-galat" : "bg-peringatan-latar text-peringatan"}`}>
          {pesan.teks}
        </p>
      )}
      <div className="mb-3">
        <button type="button" onClick={bukaTambah} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 font-semibold text-white hover:bg-teal/90">
          <Plus className="size-5" aria-hidden /> Tambah Pengguna
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="bg-teal text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Peran</th>
              <th className="px-4 py-3 font-semibold">Cakupan</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Dibuat</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-teks-sekunder">Belum ada akun pengurus.</td></tr>
            )}
            {data.map((b) => (
              <tr key={b.id} className="border-b border-border">
                <td className="px-4 py-3">
                  <span className="block font-bold text-teks">{b.nama}</span>
                  <span className="block text-sm text-teks-sekunder">{b.email}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${b.role === "ADMIN_RW" ? "bg-peringatan-latar text-peringatan" : "bg-teal-muda text-teal"}`}>
                    {NAMA_PERAN[b.role]}
                  </span>
                </td>
                <td className="px-4 py-3">{b.cakupan}</td>
                <td className="px-4 py-3"><StatusBadge {...STATUS[b.status]} /></td>
                <td className="px-4 py-3">{formatTanggal.format(b.dibuat)}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center">
                    <button
                      type="button"
                      aria-label={`Ubah ${b.nama}`}
                      onClick={() => setForm({ id: b.id, nama: b.nama, email: b.email, role: b.role === "ADMIN_RW" ? "ADMIN_RW" : "KETUA_RT", wilayah_id: b.wilayah_id ?? wilayah[0]?.id ?? "", rw: b.rw ?? daftarRw[0] ?? "" })}
                      className={`${tombolIkon} text-teal`}
                    >
                      <Pencil className="size-5" aria-hidden />
                    </button>
                    {b.status === "AKTIF" && (
                      <button type="button" aria-label={`Reset kata sandi ${b.nama}`} onClick={() => resetSandi(b)} className={`${tombolIkon} text-teal`}>
                        <KeyRound className="size-5" aria-hidden />
                      </button>
                    )}
                    {(b.status === "AKTIF" || b.status === "NONAKTIF") && (
                      <button
                        type="button"
                        aria-label={`${b.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"} ${b.nama}`}
                        onClick={() => ubahStatus(b)}
                        className={`${tombolIkon} ${b.status === "AKTIF" ? "text-galat" : "text-sukses"}`}
                      >
                        {b.status === "AKTIF" ? <ShieldOff className="size-5" aria-hidden /> : <ShieldCheck className="size-5" aria-hidden />}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <DialogPengaturan
          judul={form.id ? "Ubah pengguna" : "Tambah pengguna"}
          labelSimpan={form.id ? "Simpan" : "Tambah dan kirim undangan"}
          onSimpan={async () => {
            const hasil = form.id
              ? await ubahPengurusAksi(form.id, form)
              : await tambahPengurusAksi(form);
            if (hasil.ok && hasil.info) setPesan({ jenis: "info", teks: hasil.info });
            return hasil;
          }}
          onTutup={(tersimpan) => {
            setForm(null);
            if (tersimpan) router.refresh();
          }}
        >
          <label className="block text-sm font-semibold text-teks">
            Nama
            <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className={kelasField} />
          </label>
          <label className="block text-sm font-semibold text-teks">
            Email
            <input type="email" value={form.email} disabled={!!form.id} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${kelasField} disabled:bg-latar`} />
          </label>
          <label className="block text-sm font-semibold text-teks">
            Peran
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value === "ADMIN_RW" ? "ADMIN_RW" : "KETUA_RT" })} className={kelasField}>
              {pilihanPeran.map((p) => <option key={p} value={p}>{NAMA_PERAN[p]}</option>)}
            </select>
          </label>
          {form.role === "KETUA_RT" ? (
            <label className="block text-sm font-semibold text-teks">
              RT
              <select value={form.wilayah_id} onChange={(e) => setForm({ ...form, wilayah_id: e.target.value })} className={kelasField}>
                {wilayah.map((w) => <option key={w.id} value={w.id}>RT {w.rt} / RW {w.rw}</option>)}
              </select>
            </label>
          ) : (
            <label className="block text-sm font-semibold text-teks">
              RW
              <select value={form.rw} onChange={(e) => setForm({ ...form, rw: e.target.value })} className={kelasField}>
                {daftarRw.map((rw) => <option key={rw} value={rw}>RW {rw}</option>)}
              </select>
            </label>
          )}
          {!form.id && <p className="text-sm text-teks-sekunder">Tautan untuk mengatur kata sandi dikirim ke email tersebut.</p>}
        </DialogPengaturan>
      )}
    </>
  );
}
