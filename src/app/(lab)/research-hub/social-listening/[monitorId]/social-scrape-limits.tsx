"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SocialListeningPlatform } from "@prisma/client";
import { toast } from "sonner";
import { updateSocialListeningMonitorSearchLimits } from "@/actions/research-social-listening";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_INSTAGRAM_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
  parseSearchLimitInput,
} from "@/lib/research/social-listening/search-limits-public";
import { DetailSection } from "./detail-section";

/** Pengaturan jumlah video/post yang diambil per keyword saat sync. */
export function SocialScrapeLimits({
  monitorId,
  platforms,
  tiktokSearchLimit,
  instagramSearchLimit,
}: {
  monitorId: string;
  platforms: SocialListeningPlatform[];
  tiktokSearchLimit: number;
  instagramSearchLimit: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tiktokLimit, setTiktokLimit] = useState(String(tiktokSearchLimit));
  const [instagramLimit, setInstagramLimit] = useState(String(instagramSearchLimit));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron input limit dengan nilai server pasca refresh
    setTiktokLimit(String(tiktokSearchLimit));
    setInstagramLimit(String(instagramSearchLimit));
    setDirty(false);
  }, [tiktokSearchLimit, instagramSearchLimit]);

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSocialListeningMonitorSearchLimits({
          monitorId,
          tiktokSearchLimit: parseSearchLimitInput(
            tiktokLimit,
            tiktokSearchLimit,
            MAX_TIKTOK_SEARCH_LIMIT,
          ),
          instagramSearchLimit: parseSearchLimitInput(
            instagramLimit,
            instagramSearchLimit,
            MAX_INSTAGRAM_SEARCH_LIMIT,
          ),
        });
        setDirty(false);
        toast.success("Limit scrape disimpan. Sync berikutnya memakai nilai baru.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Limit scrape gagal disimpan."));
      }
    });
  }

  const hasTiktok = platforms.includes(SocialListeningPlatform.TIKTOK);
  const hasInstagram = platforms.includes(SocialListeningPlatform.INSTAGRAM);

  return (
    <DetailSection
      title="Limit scrape"
      description="Jumlah video TikTok dan post Instagram yang diambil per keyword, untuk 5 keyword pertama tiap sync. Hasilnya sampel platform: baca tema sebagai sinyal, bukan angka absolut."
    >
      <div className="flex flex-wrap items-end gap-4">
        {hasTiktok ? (
          <div className="grid w-full gap-1.5 sm:w-56">
            <Label htmlFor="detail-tiktok-limit">Video TikTok per keyword</Label>
            <Input
              id="detail-tiktok-limit"
              type="number"
              min={1}
              max={MAX_TIKTOK_SEARCH_LIMIT}
              value={tiktokLimit}
              aria-describedby="detail-tiktok-hint"
              onChange={(e) => {
                setTiktokLimit(e.target.value);
                setDirty(true);
              }}
            />
            <p id="detail-tiktok-hint" className="rh-meta">
              Maksimal {MAX_TIKTOK_SEARCH_LIMIT}.
            </p>
          </div>
        ) : null}
        {hasInstagram ? (
          <div className="grid w-full gap-1.5 sm:w-56">
            <Label htmlFor="detail-ig-limit">Post Instagram per hashtag</Label>
            <Input
              id="detail-ig-limit"
              type="number"
              min={1}
              max={MAX_INSTAGRAM_SEARCH_LIMIT}
              value={instagramLimit}
              aria-describedby="detail-ig-hint"
              onChange={(e) => {
                setInstagramLimit(e.target.value);
                setDirty(true);
              }}
            />
            <p id="detail-ig-hint" className="rh-meta">
              Maksimal {MAX_INSTAGRAM_SEARCH_LIMIT}.
            </p>
          </div>
        ) : null}
        <Button
          variant="outline"
          className="mb-5"
          disabled={pending || !dirty}
          onClick={handleSave}
        >
          {pending ? "Menyimpan…" : "Simpan limit"}
        </Button>
      </div>
    </DetailSection>
  );
}
