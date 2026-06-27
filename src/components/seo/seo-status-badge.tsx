"use client";

import { SeoAnalysisStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SEO_STATUS_LABELS } from "@/lib/seo/labels";

/** Badge status analisis SEO (shared: keyword, audit, crawler). */
export function SeoStatusBadge({ status }: { status: SeoAnalysisStatus }) {
  const label = SEO_STATUS_LABELS[status];
  if (status === SeoAnalysisStatus.READY) {
    return <Badge variant="secondary">{label}</Badge>;
  }
  if (status === SeoAnalysisStatus.FAILED) {
    return <Badge variant="destructive">{label}</Badge>;
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Loader2 className="size-3 animate-spin" />
      {label}
    </Badge>
  );
}
