"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoCrawlFrequency } from "@prisma/client";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { lab } from "@/components/lab/lab-primitives";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoCrawlSchedule,
  deleteSeoCrawlSchedule,
  toggleSeoCrawlSchedule,
} from "@/actions/seo-crawler";
import { cn } from "@/lib/utils";

export type CrawlScheduleRow = {
  id: string;
  domain: string;
  maxPages: number;
  frequency: SeoCrawlFrequency;
  isActive: boolean;
  nextRunAt: string;
  lastCrawlId: string | null;
};

const FREQ_LABELS: Record<SeoCrawlFrequency, string> = {
  WEEKLY: "Mingguan",
  BIWEEKLY: "2 mingguan",
  MONTHLY: "Bulanan",
};

const FREQ_ITEMS: SelectItemDef[] = Object.entries(FREQ_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function CrawlScheduleSection({
  schedules,
}: {
  schedules: CrawlScheduleRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [domain, setDomain] = useState("");
  const [frequency, setFrequency] = useState<SeoCrawlFrequency>(
    SeoCrawlFrequency.WEEKLY,
  );

  function handleCreate() {
    if (!domain.trim()) {
      toast.error("Domain wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoCrawlSchedule({
          domain: domain.trim(),
          frequency,
        });
        setDomain("");
        toast.success("Jadwal audit dibuat — crawl pertama jalan pada cron berikutnya.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat jadwal."));
      }
    });
  }

  function handleToggle(s: CrawlScheduleRow) {
    startTransition(async () => {
      try {
        await toggleSeoCrawlSchedule(s.id, !s.isActive);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah jadwal."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoCrawlSchedule(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus jadwal."));
      }
    });
  }

  return (
    <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="bento-label inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5" aria-hidden />
          Audit terjadwal
        </span>
        <span className="text-muted-foreground text-[11px]">
          isu baru vs crawl sebelumnya dilaporkan lewat notifikasi
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label>Domain</Label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="brandanda.com"
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Frekuensi</Label>
          <Select
            value={frequency}
            items={FREQ_ITEMS}
            onValueChange={(v) => {
              if (v) setFrequency(v as SeoCrawlFrequency);
            }}
          >
            <SelectTrigger>{FREQ_LABELS[frequency]}</SelectTrigger>
            <SelectContent>
              {FREQ_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Jadwalkan
        </Button>
      </div>

      {schedules.length > 0 ? (
        <div className="flex flex-col gap-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-xl border px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-semibold tracking-tight">
                  {s.domain}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {FREQ_LABELS[s.frequency]} · {s.maxPages} halaman · berikutnya{" "}
                  {new Date(s.nextRunAt).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  s.isActive
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    s.isActive ? "bg-emerald-500" : "bg-muted-foreground/50",
                  )}
                />
                {s.isActive ? "Aktif" : "Jeda"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggle(s)}
                disabled={pending}
              >
                {s.isActive ? "Jeda" : "Aktifkan"}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(s.id)}
                disabled={pending}
                aria-label="Hapus jadwal"
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
