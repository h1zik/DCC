"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { TrendDimension, TrendPhase } from "@prisma/client";
import { ArrowLeft, FileText, Globe } from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromTrend } from "@/actions/research-brief";
import { actionErrorMessage } from "@/lib/action-error-message";
import { TrendDimensionBadge } from "@/components/research-hub/trend-dimension-badge";
import { TrendPhaseBoard } from "@/components/research-hub/trend-phase-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  TREND_PHASE_LABELS,
  TREND_RADAR_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type TrendDetailData = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  narrative: string | null;
  isGlobal: boolean;
  watchlistName: string | null;
  generatedAt: string | null;
  highlightItemId: string | null;
  items: {
    id: string;
    name: string;
    dimension: TrendDimension;
    phase: TrendPhase;
    score: number | null;
    narrative: string | null;
    isGlobalPipeline: boolean;
    sources: { type: string; snippet: string; url?: string }[];
    relatedProducts: string[];
  }[];
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
};

export function TrendDetailClient({ data }: { data: TrendDetailData }) {
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefItemId, setBriefItemId] = useState(
    data.highlightItemId ?? data.items[0]?.id ?? "",
  );
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState("");

  const selectedItem = data.items.find((i) => i.id === briefItemId);
  const selectedRoom = data.rooms.find((r) => r.id === roomId);

  function openBrief(itemId: string, itemName: string) {
    setBriefItemId(itemId);
    setProjectName(`Trend: ${itemName}`);
    setBriefOpen(true);
  }

  function handleBrief() {
    if (!selectedRoom?.brandId) {
      toast.error("Pilih room dengan brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromTrend({
          trendItemId: briefItemId,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName: projectName || `Trend: ${selectedItem?.name ?? "Produk"}`,
        });
        toast.success("Brief dibuat.");
        setBriefOpen(false);
        window.location.href = `/projects/${result.projectId}`;
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  const periodLabel = `${new Date(data.weekStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${new Date(data.weekEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div>
        <Link
          href="/research-hub/trend-radar"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-xs hover:underline"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Trend Radar
        </Link>
        <h1 className="text-xl font-semibold">
          {data.isGlobal ? "Digest Global" : data.watchlistName ?? "Watchlist"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {periodLabel} · {TREND_RADAR_STATUS_LABELS[data.status as keyof typeof TREND_RADAR_STATUS_LABELS] ?? data.status}
          {data.generatedAt
            ? ` · ${formatRelativeTime(new Date(data.generatedAt))}`
            : ""}
        </p>
      </div>

      {data.narrative ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm leading-relaxed">{data.narrative}</p>
          </CardContent>
        </Card>
      ) : null}

      <TrendPhaseBoard
        digestId={data.id}
        items={data.items.map((i) => ({
          id: i.id,
          name: i.name,
          phase: i.phase,
          dimension: i.dimension,
          isGlobalPipeline: i.isGlobalPipeline,
        }))}
      />

      <div className="grid gap-4">
        {data.items.map((item) => (
          <Card
            key={item.id}
            id={item.id}
            className={cn(
              data.highlightItemId === item.id && "ring-primary ring-2",
            )}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {item.name}
                  <TrendDimensionBadge dimension={item.dimension} />
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    {TREND_PHASE_LABELS[item.phase]}
                  </span>
                  {item.isGlobalPipeline ? (
                    <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
                      <Globe className="size-3" aria-hidden />
                      Global → Local
                    </span>
                  ) : null}
                </CardTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openBrief(item.id, item.name)}
              >
                <FileText className="size-3.5" aria-hidden />
                Explore
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {item.narrative ? (
                <p className="text-muted-foreground leading-relaxed">
                  {item.narrative}
                </p>
              ) : null}
              {item.sources.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium">Sumber data</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    {item.sources.map((s, idx) => (
                      <li key={idx}>
                        <span className="text-foreground font-medium">
                          {s.type}:
                        </span>{" "}
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {s.snippet}
                          </a>
                        ) : (
                          s.snippet
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {item.relatedProducts.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium">Produk terkait</p>
                  <p className="text-muted-foreground text-xs">
                    {item.relatedProducts.join(", ")}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Explore sebagai Product Idea</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-muted-foreground text-sm">
              Tren: <strong>{selectedItem?.name}</strong>
            </p>
            <div className="grid gap-1.5">
              <Label>Room / Brand</Label>
              <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
                <SelectTrigger>
                  {selectedRoom
                    ? `${selectedRoom.name}${selectedRoom.brandName ? ` (${selectedRoom.brandName})` : ""}`
                    : "Pilih room"}
                </SelectTrigger>
                <SelectContent>
                  {data.rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.brandName ? ` — ${r.brandName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Nama proyek</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleBrief} disabled={pending}>
              Buat Brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
