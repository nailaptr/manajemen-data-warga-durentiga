import { redirect } from "next/navigation";
import { getPengguna } from "@/lib/auth";

export default async function Beranda() {
  const pengguna = await getPengguna();
  if (!pengguna) redirect("/masuk");
  redirect(pengguna.role === "WARGA" ? "/beranda" : "/dashboard");
}
