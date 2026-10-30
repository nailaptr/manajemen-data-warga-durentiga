import { redirect } from "next/navigation";
import { KartuForm } from "@/components/kartu-form";
import { getSession } from "@/lib/auth";
import { FormDaftar } from "./form-daftar";

export default async function Daftar() {
  if (await getSession()) redirect("/");
  return (
    <KartuForm judul="Daftar akun warga">
      <p className="-mt-3 mb-5 text-base text-teks-sekunder">
        Hubungkan akun dengan data keluarga Anda. Pengurus RT akan memeriksa sebelum akun aktif.
      </p>
      <FormDaftar />
    </KartuForm>
  );
}
