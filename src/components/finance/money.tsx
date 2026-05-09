import { cn } from "@/lib/utils";
import { formatIdrPlain, formatIdrShort } from "@/lib/finance-format";

type Props = {
  /** Nilai dalam IDR. Boleh string, number, Decimal-toString. */
  value: number | string | null | undefined;
  /** Format ringkas (Rp 12,5 Jt) atau penuh (12.500.000). Default: penuh. */
  short?: boolean;
  /** Tone semantik: positif=hijau, negatif=merah, netral=apa adanya. */
  tone?: "auto" | "neutral" | "positive" | "negative";
  /** Sembunyikan nilai 0 sebagai "—" (default: untuk debit/kredit). */
  zeroAsDash?: boolean;
  className?: string;
};

/**
 * Komponen formatter nominal IDR konsisten di seluruh modul keuangan.
 * Selalu menggunakan tabular-nums dan rata kanan untuk kolom angka.
 */
export function Money({
  value,
  short,
  tone = "neutral",
  zeroAsDash,
  className,
}: Props) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;

  const text = (() => {
    if (zeroAsDash && safe === 0) return "—";
    if (short) return formatIdrShort(safe);
    if (safe === 0 && zeroAsDash !== false) return formatIdrPlain(safe);
    if (safe === 0) return "0";
    return formatIdrPlain(safe);
  })();

  const toneClass = (() => {
    if (tone === "neutral") return "";
    if (tone === "positive") return "text-emerald-700 dark:text-emerald-300";
    if (tone === "negative") return "text-rose-700 dark:text-rose-300";
    if (safe > 0) return "text-emerald-700 dark:text-emerald-300";
    if (safe < 0) return "text-rose-700 dark:text-rose-300";
    return "";
  })();

  return (
    <span className={cn("tabular-nums", toneClass, className)}>{text}</span>
  );
}
