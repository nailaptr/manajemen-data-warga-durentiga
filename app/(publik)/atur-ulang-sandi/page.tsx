import Link from "next/link";
import { KartuForm } from "@/components/kartu-form";
import { FormAturUlang } from "./form-atur-ulang";

export default async function AturUlangSandi({ searchParams }: PageProps<"/atur-ulang-sandi">) {
  const { token } = await searchParams;
  return (
    <KartuForm judul="Atur ulang kata sandi">
      {typeof token === "string" && token ? (
        <FormAturUlang token={token} />
      ) : (
        <p className="text-base">
          Tautan tidak valid.{" "}
          <Link href="/lupa-sandi" className="font-medium text-teal">
            Minta tautan baru
          </Link>
        </p>
      )}
    </KartuForm>
  );
}
