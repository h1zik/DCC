"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { toast } from "sonner";
import { createProductBriefFromSocialInsight } from "@/actions/research-brief";
import { refreshSocialListeningMonitor } from "@/actions/research-social-listening";
import { actionErrorMessage } from "@/lib/action-error-message";
import { SocialInfluencerTable } from "@/components/research-hub/social-influencer-table";
import {
  SocialMentionFeed,
  type MentionFeedRow,
} from "@/components/research-hub/social-mention-feed";
import { SocialPainPointsCard } from "@/components/research-hub/social-pain-points-list";
import { SocialViralCards } from "@/components/research-hub/social-viral-cards";
import { SocialWishlistCard } from "@/components/research-hub/social-wishlist-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type SocialDetailData = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  batchStatus: SocialListeningStatus | null;
  errorMessage: string | null;
  aiSummary: string | null;
  topPainPoints: { theme: string; count: number }[];
  topWishlist: { theme: string; count: number }[];
  influencers: {
    author: string;
    platform: string;
    mentions: number;
    totalEngagement: number;
    topUrl: string | null;
  }[];
  viralContent: {
    text: string;
    author: string | null;
    platform: string;
    url: string | null;
    views: number;
    likes: number;
  }[];
  mentions: MentionFeedRow[];
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
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

export function SocialDetailClient({ data }: { data: SocialDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [insightType, setInsightType] = useState<"pain" | "wishlist" | "viral">(
    "pain",
  );
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Social: ${data.name}`);

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const inProgress =
    data.batchStatus === "COLLECTING" ||
    data.batchStatus === "ANALYZING" ||
    data.batchStatus === "PENDING";

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshSocialListeningMonitor(data.id);
        toast.success("Sync dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
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
        const result = await createProductBriefFromSocialInsight({
          monitorId: data.id,
          insightType,
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
            href="/research-hub/social-listening"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> Kembali
          </Link>
          <h1 className="text-xl font-semibold">{data.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.keywords.join(", ")} ·{" "}
            {data.platforms
              .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
              .join(", ")}
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              statusTone(data.batchStatus),
            )}
          >
            {data.batchStatus
              ? SOCIAL_LISTENING_STATUS_LABELS[data.batchStatus]
              : "Belum sync"}
          </span>
        </div>
        <div className="flex gap-2">
          <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline" disabled={!data.aiSummary}>
                  <FileText className="mr-1.5 size-3.5" />
                  Buat Brief
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Product Brief dari Social Insight</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Jenis insight</Label>
                  <Select
                    value={insightType}
                    onValueChange={(v) =>
                      setInsightType(v as "pain" | "wishlist" | "viral")
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem value="pain">Top Pain Points</SelectItem>
                      <SelectItem value="wishlist">Top Wishlist</SelectItem>
                      <SelectItem value="viral">Viral Content</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
          <Button size="sm" onClick={handleRefresh} disabled={pending}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {data.errorMessage ? (
        <p className="text-amber-700 dark:text-amber-300 text-sm">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SocialPainPointsCard items={data.topPainPoints} />
        <SocialWishlistCard items={data.topWishlist} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Influencer Radar</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialInfluencerTable rows={data.influencers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Viral Content Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialViralCards items={data.viralContent} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mention Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialMentionFeed rows={data.mentions} />
        </CardContent>
      </Card>
    </div>
  );
}
