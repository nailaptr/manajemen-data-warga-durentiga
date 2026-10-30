import type { ChipFilter } from "@/lib/filter-ui";
import { FilterChip } from "./filter-chip";

// Chip filter aktif dan pesan galat filter, dipakai sebagai isi `chip` pada FilterStatistik.
export function ChipFilterAktif({ chip, galat }: { chip: ChipFilter[]; galat: string | null }) {
  return (
    <>
      {galat && (
        <p role="alert" className="mt-4 text-sm text-galat">
          {galat}. Filter pada URL diabaikan.
        </p>
      )}
      {chip.length > 0 && (
        <ul className="mt-4 flex list-none flex-wrap gap-2 p-0" aria-label="Filter aktif">
          {chip.map((c) => (
            <li key={c.label}>
              <FilterChip label={c.label} hrefHapus={c.href} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
