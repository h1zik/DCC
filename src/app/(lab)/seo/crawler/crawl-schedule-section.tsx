"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoCrawlFrequency } from "@prisma/client";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabSection, lab } from "@/components/lab/lab-primitives";
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
    <LabSection
      title="Audit terjadwal"
      description="Crawl ulang otomatis — isu baru vs crawl sebelumnya dilaporkan lewat notifikasi."
    >
      <div className={cn(lab.panel, "grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end")}>
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
            onValueChange={(v) => setFrequency(v as SeoCrawlFrequency)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FREQ_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
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
            <div key={s.id} className={cn(lab.card, "flex items-center gap-3 p-3")}>
              <CalendarClock className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
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
              <Badge variant={s.isActive ? "secondary" : "outline"}>
                {s.isActive ? "Aktif" : "Jeda"}
              </Badge>
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
    </LabSection>
  );
}
