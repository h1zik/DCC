"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  influencerFilterQuery,
  parseInfluencerFilters,
  type InfluencerFilterState,
} from "@/lib/brand-research/influencer/list-filter";

/**
 * Filter daftar influencer yang bertahan saat pengguna membuka satu profil
 * lalu kembali.
 *
 * Filter disimpan di URL, bukan di state komponen: halaman daftar dilepas dari
 * DOM begitu pengguna membuka detail, dan state apa pun ikut hilang bersamanya.
 * Menaruhnya di URL sekaligus membuat tampilan yang sudah disaring bisa
 * di-refresh dan dikirim ke rekan sebagai link.
 *
 * State lokal tetap dipertahankan sebagai sumber render supaya kotak pencarian
 * responsif: Next.js menerapkan perubahan URL di dalam `startTransition`, jadi
 * merender langsung dari `useSearchParams` akan membuat ketikan tertinggal.
 * URL adalah cerminan, bukan jalur balik.
 */
export function useInfluencerFilters(): {
  filters: InfluencerFilterState;
  setFilters: (next: InfluencerFilterState) => void;
  /** Query filter saat ini, untuk disematkan ke link "lihat detail". */
  query: string;
} {
  const searchParams = useSearchParams();

  // Dibaca dari URL saat render pertama — sama persis dengan yang dipakai
  // server merender, jadi tidak ada ketidakcocokan hidrasi.
  const [filters, setFiltersState] = useState<InfluencerFilterState>(() =>
    parseInfluencerFilters(searchParams),
  );

  const setFilters = useCallback((next: InfluencerFilterState) => {
    setFiltersState(next);
    if (typeof window === "undefined") return;

    // Ditulis dari `window.location` yang sebenarnya, bukan dari nilai hook,
    // supaya parameter lain (mis. `brandId`) selalu ikut apa adanya.
    const query = influencerFilterQuery(
      next,
      new URLSearchParams(window.location.search),
    );
    // `history.replaceState` — bukan `router.replace` — karena penyaringan
    // dikerjakan sepenuhnya di klien: tidak ada gunanya memaksa server
    // merender ulang tiap ketikan. "replace" juga menjaga tombol kembali
    // browser menunjuk halaman sebelumnya, bukan menelusuri tiap perubahan
    // filter satu per satu.
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, []);

  return { filters, setFilters, query: influencerFilterQuery(filters) };
}
