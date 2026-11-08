"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary seluruh Research Hub — tampil di dalam layout hub sehingga
 * navigasi modul tetap bisa dipakai. Mencakup halaman list dan detail.
 */
export default function ResearchHubError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[research-hub]", error);
  }, [error]);

  return (
    <div className="flex max-w-xl flex-col gap-4 py-10">
      <h1 className="rh-title-detail">Halaman ini gagal dimuat</h1>
      <p className="rh-lede">
        Data riset tidak bisa diambil dari server. Biasanya ini sementara,
        coba muat ulang. Job scrape dan analisis yang sedang jalan tidak
        terpengaruh.
      </p>
      {error.digest ? (
        <p className="rh-meta">
          Kode error untuk tim teknis: <span className="rh-num font-medium">{error.digest}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => unstable_retry()}>
          <RotateCcw className="size-4" aria-hidden />
          Muat ulang
        </Button>
        <Button variant="outline" render={<Link href="/research-hub" />}>
          Ke overview Research Hub
        </Button>
      </div>
    </div>
  );
}
