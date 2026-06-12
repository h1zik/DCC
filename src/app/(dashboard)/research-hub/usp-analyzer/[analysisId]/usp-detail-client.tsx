"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { UspGapStatus } from "@prisma/client";
import { toast } from "sonner";
import { createProductBriefFromUsp } from "@/actions/research-brief";
import { createProductConcept } from "@/actions/research-concept-lab";
import { refreshUspGapAnalysis } from "@/actions/research-usp-gap";
import { ProductConceptMode } from "@prisma/client";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ClaimAnalysisPanel } from "@/components/research-hub/claim-analysis-panel";
import { DifferentiationScoreBadge } from "@/components/research-hub/differentiation-score-badge";
import {
  GapMatrixTable,
  type GapMatrixRow,
} from "@/components/research-hub/gap-matrix-table";
import { PositioningScatterChart } from "@/components/research-hub/positioning-scatter-chart";
import {
  UspCandidateCards,
  type UspCandidate,
} from "@/components/research-hub/usp-candidate-cards";
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
import { USP_GAP_STATUS_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type UspDetailData = {
  id: string;
  analysisId: string;
  category: string;
  status: UspGapStatus;
  errorMessage: string | null;
  aiSummary: string | null;
  differentiationScore: number | null;
  gapMatrix: GapMatrixRow[];
  claimAnalysis: { overused?: string[]; underserved?: string[] };
  positioningMap: {
    axisX: string;
    axisY: string;
    points: { name: string; brand: string; x: number; y: number }[];
  };
  uspCandidates: UspCandidate[];
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
};

function statusTone(status: UspGapStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "GATHERING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function UspDetailClient({ data }: { data: UspDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [uspIndex, setUspIndex] = useState(0);
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`USP: ${data.category}`);

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const inProgress =
    data.status === "GATHERING" ||
    data.status === "ANALYZING" ||
    data.status === "PENDING";

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshUspGapAnalysis(data.id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function openBrief(index: number) {
    setUspIndex(index);
    setBriefOpen(true);
  }

  function handleCreateConcept(index: number) {
    const usp = data.uspCandidates[index]?.usp ?? data.category;
    startTransition(async () => {
      try {
        const result = await createProductConcept({
          mode: ProductConceptMode.AI_GENERATED,
          title: usp.slice(0, 120),
          category: data.category,
          uspGapAnalysisId: data.analysisId,
          uspIndex: index,
        });
        toast.success("Konsep produk dibuat.");
        router.push(`/research-hub/concept-lab/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat konsep."));
      }
    });
  }

  function handleBrief() {
    if (!selectedRoom?.brandId) {
      toast.error("Pilih room dengan brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromUsp({
          analysisId: data.id,
          uspIndex,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Product brief dibuat.");
        setBriefOpen(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/research-hub/usp-analyzer"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> Kembali
          </Link>
          <h1 className="text-xl font-semibold">{data.category}</h1>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              statusTone(data.status),
            )}
          >
            {USP_GAP_STATUS_LABELS[data.status]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <DifferentiationScoreBadge score={data.differentiationScore} />
          <Button size="sm" onClick={handleRefresh} disabled={pending}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {data.errorMessage ? (
        <p className="text-rose-700 dark:text-rose-300 text-sm">
          {data.errorMessage}
        </p>
      ) : null}

      {data.aiSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-relaxed">
            {data.aiSummary}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gap Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <GapMatrixTable rows={data.gapMatrix} />
        </CardContent>
      </Card>

      <ClaimAnalysisPanel data={data.claimAnalysis} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Positioning Map</CardTitle>
        </CardHeader>
        <CardContent>
          <PositioningScatterChart
            axisX={data.positioningMap.axisX}
            axisY={data.positioningMap.axisY}
            points={data.positioningMap.points}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">USP Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <UspCandidateCards
            candidates={data.uspCandidates}
            onCreateBrief={openBrief}
            onCreateConcept={handleCreateConcept}
            briefPending={pending}
            conceptPending={pending}
          />
        </CardContent>
      </Card>

      <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Product Brief dari USP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">
              {data.uspCandidates[uspIndex]?.usp ?? "—"}
            </p>
            <div className="space-y-2">
              <Label>Room</Label>
              <Select
                value={roomId}
                onValueChange={(v) => v && setRoomId(v)}
              >
                <SelectTrigger />
                <SelectContent>
                  {data.rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
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
