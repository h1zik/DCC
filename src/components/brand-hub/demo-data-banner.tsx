import { AlertTriangle } from "lucide-react";

/**
 * Non-dismissible banner shown whenever a view is rendering fabricated "demo" data
 * (scraper not configured). Keeps fake data clearly distinguishable from real scrapes.
 */
export function DemoDataBanner({ context }: { context?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-transparent bg-[#ffedcd] px-4 py-3.5 text-sm text-amber-900 shadow-[0_1px_2px_rgb(30_25_15/0.05)] dark:bg-amber-400/10 dark:text-amber-200">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300"
        aria-hidden
      >
        <AlertTriangle className="size-4" />
      </span>
      <div>
        <p className="font-bold tracking-tight">
          Data demo — bukan hasil scrape asli
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/90">
          {context ? `${context} ` : ""}
          Scraper belum dikonfigurasi, jadi angka dan konten di halaman ini adalah
          contoh fiktif. Jangan dipakai untuk keputusan. Set kredensial scraper untuk
          data nyata.
        </p>
      </div>
    </div>
  );
}
