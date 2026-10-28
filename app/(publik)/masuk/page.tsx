import { redirect } from "next/navigation";
import { KartuForm } from "@/components/kartu-form";
import { getPengguna } from "@/lib/auth";
import { FormMasuk } from "./form-masuk";

export default async function Masuk() {
  if (await getPengguna()) redirect("/");
  return (
    <KartuForm judul="Masuk">
      <FormMasuk />
    </KartuForm>
  );
}
