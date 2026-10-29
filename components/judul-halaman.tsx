export function JudulHalaman({ judul, deskripsi }: { judul: string; deskripsi?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-teks lg:text-3xl">{judul}</h1>
      {deskripsi && <p className="mt-1 text-base text-teks-sekunder">{deskripsi}</p>}
    </div>
  );
}
