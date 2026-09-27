"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Filter halaman disimpan di query string supaya bisa dibagikan & bertahan
 * saat refresh. Nilai kosong menghapus parameternya.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = useCallback((key: string) => params.get(key) ?? "", [params]);

  const set = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  return { get, set, pending, query: params.toString() };
}
