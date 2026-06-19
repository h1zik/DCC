"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
import { BrandHubEmptyState } from "@/components/brand-hub/brand-hub-primitives";
import { cn } from "@/lib/utils";

export type SocialMonitorRow = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  isActive: boolean;
  latestStatus: SocialListeningStatus | null;
  mentionCount: number;
  thumbnailMentionCount: number;
  collectedAt: string | null;
  errorMessage: string | null;
};

function statusTone(status: SocialListeningStatus | null) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "COLLECTING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function BrandSocialListeningClient({
  monitors,
}: {
  monitors: SocialMonitorRow[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {monitors.length} monitor dari Research Hub
        </p>
        <Badge variant="secondary" className="text-[10px]">
          Dikelola Market Analyst
        </Badge>
      </div>

      {monitors.length === 0 ? (
        <BrandHubEmptyState
          icon={MessageSquare}
          title="Belum ada monitor sosial"
          description="Mintakan Market Analyst menambahkan monitor di Research Hub."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monitor</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mentions</TableHead>
                <TableHead className="text-right">Visual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitors.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      href={`/brand-hub/social-listening/${m.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                      {m.keywords.join(", ")}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.platforms
                      .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                        statusTone(m.latestStatus),
                      )}
                    >
                      {m.latestStatus
                        ? SOCIAL_LISTENING_STATUS_LABELS[m.latestStatus]
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.mentionCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.thumbnailMentionCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
