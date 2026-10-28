"use client";

import type {
  ContentPlanJenis,
  ContentPlanPlatform,
  ContentPlanUsage,
  User,
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  JENIS_BADGE_CLASS,
  JENIS_LABEL,
  PLATFORM_BADGE_CLASS,
  PLATFORM_LABEL,
  PLATFORM_SHORT_LABEL,
  USAGE_BADGE_CLASS,
  USAGE_LABEL,
} from "@/lib/content-plan-ui";
import { cn } from "@/lib/utils";

/** Anggota ruangan yang bisa dipilih sebagai PIC. */
export type PicOption = Pick<User, "id" | "name" | "email" | "image">;

/** Date/ISO string → nilai `input[type=date]` (YYYY-MM-DD, zona lokal). */
export function toDateInput(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function JenisBadge({ jenis }: { jenis: ContentPlanJenis }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full whitespace-normal px-1.5 py-0.5 text-left text-[9px] leading-tight font-medium sm:text-[10px]",
        JENIS_BADGE_CLASS[jenis],
      )}
    >
      {JENIS_LABEL[jenis]}
    </Badge>
  );
}

export function UsageBadge({ usage }: { usage: ContentPlanUsage }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full whitespace-normal px-1.5 py-0.5 text-left text-[9px] leading-tight font-medium sm:text-[10px]",
        USAGE_BADGE_CLASS[usage],
      )}
    >
      {USAGE_LABEL[usage]}
    </Badge>
  );
}

export function PlatformBadge({
  platform,
  short,
}: {
  platform: ContentPlanPlatform;
  short?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 shrink-0 rounded-md border px-1.5 text-[11px] font-semibold",
        PLATFORM_BADGE_CLASS[platform],
      )}
      title={PLATFORM_LABEL[platform]}
    >
      {short ? PLATFORM_SHORT_LABEL[platform] : PLATFORM_LABEL[platform]}
    </Badge>
  );
}
