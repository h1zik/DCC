import { cn } from "@/lib/utils";

const TONES = [
  "bg-chart-1/15 text-foreground",
  "bg-chart-2/15 text-foreground",
  "bg-chart-3/15 text-foreground",
  "bg-chart-4/15 text-foreground",
  "bg-chart-5/15 text-foreground",
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar inisial dengan tint deterministik dari token chart — aman untuk
 * semua preset tema. Tidak butuh gambar (tidak ada primitive avatar di app).
 */
export function InitialsAvatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  /** Basis hash warna; default `name`. Isi id agar warna stabil saat rename. */
  seed?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const tone = TONES[hashString(seed ?? name) % TONES.length];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium select-none",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
        tone,
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
