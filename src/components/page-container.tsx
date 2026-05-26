import { cn } from "@/lib/utils";

/** Lebar konten maksimum (selaras dengan shell dashboard). */
export const PAGE_MAX_WIDTH_CLASS = "max-w-[var(--page-max-width)]";

/** Padding area konten utama (selaras dengan shell dashboard). */
export const PAGE_PADDING_CLASS = "p-6";

/** Jarak vertikal antar blok di satu halaman. */
export const PAGE_GAP_CLASS = "gap-6";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  /** `relaxed` untuk halaman dengan banyak section (mis. dashboard CEO). */
  gap?: "default" | "relaxed";
};

/**
 * Wrapper isi halaman: jarak vertikal konsisten.
 * Margin kiri/kanan/atas ditangani `DashboardShell` (padding + max-width).
 */
export function PageContainer({
  children,
  className,
  gap = "default",
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        gap === "relaxed" ? "gap-8" : PAGE_GAP_CLASS,
        className,
      )}
    >
      {children}
    </div>
  );
}
