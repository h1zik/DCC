import {
  describeDirectChatFile,
  type DirectChatFileFamily,
} from "@/lib/direct-chat-attachments-shared";
import { cn } from "@/lib/utils";

/**
 * Warna mengikuti konvensi tipe dokumen yang sudah dikenal pengguna (PDF merah,
 * spreadsheet hijau, dst.) — di sini warna adalah informasi, bukan dekorasi.
 */
const FAMILY_TONE: Record<DirectChatFileFamily, string> = {
  pdf: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  doc: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  sheet: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  slides: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  archive: "bg-stone-500/15 text-stone-700 dark:text-stone-300",
  image: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  video: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  audio: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  text: "bg-muted text-muted-foreground",
  other: "bg-muted text-muted-foreground",
};

/** Lencana tipe file — bentuk lembar kertas dengan sudut terlipat. */
export function DirectChatFileBadge({
  fileName,
  mimeType,
  className,
}: {
  fileName: string;
  mimeType: string;
  className?: string;
}) {
  const { label, family } = describeDirectChatFile(fileName, mimeType);
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-9 shrink-0 items-end justify-center rounded-[5px] rounded-tr-[12px] pb-1.5 text-[9px] leading-none font-bold tracking-wide",
        FAMILY_TONE[family],
        className,
      )}
    >
      {label}
    </span>
  );
}
