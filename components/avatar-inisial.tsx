const inisial = (nama: string) =>
  nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]!.toUpperCase())
    .join("");

export function AvatarInisial({ nama, kecil = false }: { nama: string; kecil?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-teal-muda font-bold text-teal ${
        kecil ? "size-11 text-base" : "size-14 text-lg"
      }`}
    >
      {inisial(nama)}
    </span>
  );
}
