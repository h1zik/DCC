import { AlertTriangle } from "lucide-react";

/**
 * Non-dismissible banner shown whenever a view is rendering fabricated "demo" data
 * (scraper not configured). Keeps fake data clearly distinguishable from real scrapes.
 */
export function DemoDataBanner({ context }: { context?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">Data demo — bukan hasil scrape asli</p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
          {context ? `${context} ` : ""}
          Scraper belum dikonfigurasi, jadi angka dan konten di halaman ini adalah
          contoh fiktif. Jangan dipakai untuk keputusan. Set kredensial scraper untuk
          data nyata.
        </p>
      </div>
    </div>
  );
}
