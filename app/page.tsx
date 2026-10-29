import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Beranda() {
  const pengguna = await getSession();
  if (!pengguna) redirect("/masuk");
  redirect(pengguna.role === "WARGA" ? "/beranda" : "/dashboard");
}
