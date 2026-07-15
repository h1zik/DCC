"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { ExternalLink, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  appendBrandVisualCollectionKeywords,
  createBrandVisualAssetFromUrl,
  createBrandVisualCollection,
  deleteBrandVisualAsset,
  deleteBrandVisualCollection,
  scrapeBrandVisualCollection,
  updateBrandVisualCollectionPinLimit,
  uploadBrandVisualAsset,
} from "@/actions/brand-visual-research";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  VisualLibraryEmptyPanel,
  VisualLibraryEntityPicker,
  VisualLibraryShell,
  VisualLibrarySourceTabs,
  type VisualLibraryEntityItem,
  type VisualLibrarySourceKey,
} from "@/components/brand-hub/brand-visual-library-shell";
import { MoodboardGrid } from "@/components/brand-hub/moodboard-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandJobProgress } from "../use-brand-job-progress";
import type { VisualLibraryGroups } from "@/lib/brand-research/visual-library-types";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

export type VisualLibraryData = {
  groups: VisualLibraryGroups;
  totalAssetCount: number;
  pinterestMaxPins: number;
  pinterestPinsMin: number;
  pinterestPinsMax: number;
};

const STATUS_META: Record<string, { label: string; pill: string; dot: string }> =
  {
    PENDING: {
      label: "Menunggu",
      pill: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
    COLLECTING: {
      label: "Mengumpulkan",
      pill: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
      dot: "bg-amber-500 animate-pulse",
    },
    READY: {
      label: "Siap",
      pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
    FAILED: {
      label: "Gagal",
      pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
    },
  };

function CollectionStatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        meta.pill,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Bar entitas sumber (kompetitor/social/ads) — tile bento dengan link detail. */
function EntityHeaderBar({ name, href }: { name: string; href: string }) {
  return (
    <div className="bento-tile flex-row items-center justify-between gap-3 py-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-sm font-extrabold uppercase text-pink-700 dark:text-pink-300"
          aria-hidden
        >
          {name.trim().charAt(0) || "?"}
        </span>
        <span className="truncate text-sm font-bold tracking-tight">{name}</span>
      </span>
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition-colors"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        Detail
      </Link>
    </div>
  );
}

function countPinterestAssets(groups: VisualLibraryGroups) {
  return groups.pinterest.reduce((n, p) => n + p.assets.length, 0);
}

function countCompetitorAssets(groups: VisualLibraryGroups) {
  return groups.competitors.reduce((n, c) => n + c.assets.length, 0);
}

function countCompetitorProductAssets(groups: VisualLibraryGroups) {
  return groups.competitorProducts.reduce((n, c) => n + c.assets.length, 0);
}

function countSocialAssets(groups: VisualLibraryGroups) {
  return groups.socialMonitors.reduce((n, m) => n + m.assets.length, 0);
}

function countAdLibraryAssets(groups: VisualLibraryGroups) {
  return groups.adLibraryMonitors.reduce((n, m) => n + m.assets.length, 0);
}

function entitiesForSource(
  source: VisualLibrarySourceKey,
  groups: VisualLibraryGroups,
): VisualLibraryEntityItem[] {
  switch (source) {
    case "pinterest":
      return groups.pinterest.map(({ collection, assets }) => ({
        id: collection.id,
        name: collection.name,
        count: assets.length,
        subtitle: collection.keywords.join(", "),
        status: collection.status,
      }));
    case "competitor":
      return groups.competitors.map((c) => ({
        id: c.competitorId,
        name: c.name,
        count: c.assets.length,
      }));
    case "competitorProduct":
      return groups.competitorProducts.map((c) => ({
        id: c.categoryId,
        name: c.name,
        count: c.assets.length,
      }));
    case "social":
      return groups.socialMonitors.map((m) => ({
        id: m.monitorId,
        name: m.name,
        count: m.assets.length,
      }));
    case "adLibrary":
      return groups.adLibraryMonitors.map((m) => ({
        id: m.monitorId,
        name: m.name,
        count: m.assets.length,
      }));
    default:
      return [];
  }
}

export function BrandVisualLibraryClient({
  data,
  defaultBrandId,
}: {
  data: VisualLibraryData;
  defaultBrandId?: string | null;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId(defaultBrandId);
  const [pending, startTransition] = useTransition();
  const [source, setSource] = useState<VisualLibrarySourceKey>("pinterest");
  const [entityId, setEntityId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [keywordDialogCollectionId, setKeywordDialogCollectionId] = useState<
    string | null
  >(null);
  const [newKeywordsText, setNewKeywordsText] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTab, setManualTab] = useState<"file" | "url">("file");
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [createMaxPins, setCreateMaxPins] = useState(String(data.pinterestMaxPins));
  const [pinLimits, setPinLimits] = useState<Record<string, string>>({});
  const [manualTitle, setManualTitle] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { groups } = data;

  const hasCollecting = groups.pinterest.some(
    (p) => p.collection.status === "COLLECTING",
  );
  useBrandJobProgress({ inProgress: hasCollecting });

  /**
   * Nilai mentah input limit pin: state user bila ada, jika tidak fallback ke
   * limit koleksi sendiri lalu default workspace (pengganti seeding effect).
   */
  function rawPinLimitFor(id: string): string {
    const fromState = pinLimits[id];
    if (fromState !== undefined) return fromState;
    const col = groups.pinterest.find((p) => p.collection.id === id)?.collection;
    return String(col?.maxPinsPerKeyword ?? data.pinterestMaxPins);
  }

  function parsePinLimit(raw: string): number | null {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.min(
      Math.max(Math.round(n), data.pinterestPinsMin),
      data.pinterestPinsMax,
    );
  }

  const sources = useMemo(
    () => [
      {
        key: "pinterest" as const,
        label: "Pinterest",
        count: countPinterestAssets(groups),
      },
      {
        key: "competitor" as const,
        label: "Competitor Shop",
        count: countCompetitorAssets(groups),
      },
      {
        key: "competitorProduct" as const,
        label: "Competitor Product",
        count: countCompetitorProductAssets(groups),
      },
      {
        key: "social" as const,
        label: "Social",
        count: countSocialAssets(groups),
      },
      {
        key: "adLibrary" as const,
        label: "Ad Library",
        count: countAdLibraryAssets(groups),
      },
      {
        key: "manual" as const,
        label: "Manual",
        count: groups.manual.length,
      },
    ],
    [groups],
  );

  const entities = useMemo(
    () => entitiesForSource(source, groups),
    [source, groups],
  );

  // Sinkronkan pilihan entitas saat daftar berubah — pola "adjust state
  // during render" (pengganti effect, perilaku identik).
  const entitiesKey = entities.map((e) => e.id).join(",");
  const [prevEntitiesKey, setPrevEntitiesKey] = useState(entitiesKey);
  if (prevEntitiesKey !== entitiesKey) {
    setPrevEntitiesKey(entitiesKey);
    setEntityId(entities[0]?.id ?? null);
  } else if (!entityId && entities[0]) {
    setEntityId(entities[0].id);
  }

  function handleSourceChange(next: VisualLibrarySourceKey) {
    setSource(next);
    const nextEntities = entitiesForSource(next, groups);
    setEntityId(nextEntities[0]?.id ?? null);
  }

  const filteredAssetCount = useMemo(
    () =>
      countPinterestAssets(groups) +
      countCompetitorAssets(groups) +
      countCompetitorProductAssets(groups) +
      countSocialAssets(groups) +
      countAdLibraryAssets(groups) +
      groups.manual.length,
    [groups],
  );

  const activeSourceCount = useMemo(
    () => sources.filter((s) => s.count > 0).length,
    [sources],
  );
  const competitorVisualCount =
    countCompetitorAssets(groups) +
    countCompetitorProductAssets(groups) +
    countAdLibraryAssets(groups);
  const socialManualCount = countSocialAssets(groups) + groups.manual.length;

  function handleCreate() {
    const kw = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!name.trim() || kw.length === 0) {
      toast.error("Nama dan keyword diperlukan.");
      return;
    }
    const maxPins = parsePinLimit(createMaxPins);
    if (maxPins == null) {
      toast.error(
        `Limit pin harus ${data.pinterestPinsMin}–${data.pinterestPinsMax}.`,
      );
      return;
    }
    startTransition(async () => {
      try {
        const result = await createBrandVisualCollection({
          name,
          keywords: kw,
          ownerBrandId: brandId,
          maxPinsPerKeyword: maxPins,
        });
        await scrapeBrandVisualCollection({ collectionId: result.id });
        toast.success("Koleksi dibuat — Pinterest scrape berjalan di background.");
        setOpen(false);
        setName("");
        setKeywords("");
        setSource("pinterest");
        setEntityId(result.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat koleksi."));
      }
    });
  }

  async function savePinLimitAndScrape(
    id: string,
    opts: { replace: boolean; keywords?: string[] },
  ) {
    const limit = parsePinLimit(rawPinLimitFor(id));
    if (limit == null) {
      toast.error(
        `Limit pin harus ${data.pinterestPinsMin}–${data.pinterestPinsMax}.`,
      );
      return;
    }
    await updateBrandVisualCollectionPinLimit({
      collectionId: id,
      maxPinsPerKeyword: limit,
    });
    await scrapeBrandVisualCollection({
      collectionId: id,
      replace: opts.replace,
      keywords: opts.keywords,
    });
  }

  function handleRetryScrape(id: string) {
    startTransition(async () => {
      try {
        await savePinLimitAndScrape(id, { replace: false });
        toast.success("Scrape Pinterest dijalankan (pin lama tetap ada).");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Scrape gagal."));
      }
    });
  }

  function handleRefreshReplace(id: string) {
    if (
      !confirm(
        "Scrape ulang akan menghapus semua pin di koleksi ini dan mengambil ulang dari semua keyword. Lanjutkan?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await savePinLimitAndScrape(id, { replace: true });
        toast.success("Scrape ulang dijalankan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Scrape gagal."));
      }
    });
  }

  function openKeywordDialog(collectionId: string) {
    setKeywordDialogCollectionId(collectionId);
    setNewKeywordsText("");
    setKeywordDialogOpen(true);
  }

  function handleAppendKeywords() {
    if (!keywordDialogCollectionId) return;
    const kw = newKeywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (kw.length === 0) {
      toast.error("Masukkan minimal satu keyword baru.");
      return;
    }
    startTransition(async () => {
      try {
        const limit = parsePinLimit(rawPinLimitFor(keywordDialogCollectionId));
        if (limit == null) {
          toast.error(
            `Limit pin harus ${data.pinterestPinsMin}–${data.pinterestPinsMax}.`,
          );
          return;
        }
        await updateBrandVisualCollectionPinLimit({
          collectionId: keywordDialogCollectionId,
          maxPinsPerKeyword: limit,
        });
        const result = await appendBrandVisualCollectionKeywords({
          collectionId: keywordDialogCollectionId,
          keywords: kw,
        });
        toast.success(
          `Keyword ditambahkan (${result.added.join(", ")}) — scrape berjalan.`,
        );
        setKeywordDialogOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambah keyword."));
      }
    });
  }

  function handleDeleteCollection(id: string) {
    if (!confirm("Hapus koleksi ini?")) return;
    startTransition(async () => {
      try {
        await deleteBrandVisualCollection(id);
        toast.success("Koleksi dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function handleManualSubmit() {
    startTransition(async () => {
      try {
        if (manualTab === "url") {
          if (!manualUrl.trim()) {
            toast.error("URL gambar diperlukan.");
            return;
          }
          await createBrandVisualAssetFromUrl({
            imageUrl: manualUrl.trim(),
            title: manualTitle || null,
            tags: manualTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            ownerBrandId: brandId,
          });
        } else {
          if (!selectedFile) {
            toast.error("Pilih file gambar.");
            return;
          }
          const fd = new FormData();
          fd.append("file", selectedFile);
          if (manualTitle) fd.append("title", manualTitle);
          if (manualTags) fd.append("tags", manualTags);
          if (brandId) fd.append("ownerBrandId", brandId);
          await uploadBrandVisualAsset(fd);
        }
        toast.success("Asset manual ditambahkan.");
        setManualOpen(false);
        setManualTitle("");
        setManualTags("");
        setManualUrl("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSource("manual");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambahkan asset."));
      }
    });
  }

  function handleDeleteAsset(id: string) {
    if (!confirm("Hapus asset ini dari Visual Library?")) return;
    startTransition(async () => {
      try {
        await deleteBrandVisualAsset(id);
        toast.success("Asset dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus asset."));
      }
    });
  }

  const sourceAction =
    source === "pinterest" ? (
      <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
        <Plus className="size-3.5" aria-hidden />
        Koleksi
      </Button>
    ) : source === "manual" ? (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setManualOpen(true)}
        disabled={pending}
      >
        <Upload className="size-3.5" aria-hidden />
        Upload
      </Button>
    ) : null;

  function renderContent() {
    if (source === "pinterest") {
      if (groups.pinterest.length === 0) {
        return (
          <VisualLibraryEmptyPanel
            hint="Buat koleksi Pinterest dengan keyword moodboard brand."
            action={
              <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
                <Plus className="size-3.5" />
                Koleksi Pinterest
              </Button>
            }
          />
        );
      }

      const selected = groups.pinterest.find(
        (p) => p.collection.id === entityId,
      );
      if (!selected) return null;

      const { collection, assets } = selected;
      const pinLimit = parsePinLimit(rawPinLimitFor(collection.id));
      const effectiveLimit =
        pinLimit ?? collection.maxPinsPerKeyword ?? data.pinterestMaxPins;
      const approxTotal = effectiveLimit * collection.keywords.length;

      return (
        <div className="flex flex-col gap-4">
          <div className="bento-tile justify-start gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-sm font-extrabold uppercase text-pink-700 dark:text-pink-300"
                    aria-hidden
                  >
                    {collection.name.trim().charAt(0) || "?"}
                  </span>
                  <h3 className="text-sm font-bold tracking-tight">
                    {collection.name}
                  </h3>
                  <CollectionStatusPill status={collection.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {collection.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="bg-muted/60 text-muted-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                {collection.errorMessage ? (
                  <p className="text-destructive mt-2 text-xs">
                    {collection.errorMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => openKeywordDialog(collection.id)}
                >
                  <Plus className="size-3.5" />
                  Keyword
                </Button>
                {assets.length === 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleRetryScrape(collection.id)}
                  >
                    <RefreshCw className="size-3.5" />
                    Scrape
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleRefreshReplace(collection.id)}
                  >
                    <RefreshCw className="size-3.5" />
                    Scrape ulang
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleDeleteCollection(collection.id)}
                  aria-label="Hapus koleksi"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="border-border/60 flex flex-wrap items-end gap-3 border-t pt-3">
              <div className="grid gap-1">
                <Label
                  htmlFor={`pin-limit-${collection.id}`}
                  className="text-[10px]"
                >
                  Limit pin / keyword
                </Label>
                <Input
                  id={`pin-limit-${collection.id}`}
                  type="number"
                  min={data.pinterestPinsMin}
                  max={data.pinterestPinsMax}
                  className="h-8 w-28 text-xs"
                  value={rawPinLimitFor(collection.id)}
                  onChange={(e) =>
                    setPinLimits((prev) => ({
                      ...prev,
                      [collection.id]: e.target.value,
                    }))
                  }
                />
              </div>
              <p className="text-muted-foreground pb-1 text-[10px]">
                ≈ {approxTotal} pin max ({collection.keywords.length} keyword)
              </p>
            </div>
          </div>

          <DataSourceProvenancePanel entries={collection.dataProvenance} />

          {assets.length > 0 ? (
            <MoodboardGrid
              assets={assets.map((a) => ({
                id: a.id,
                imageUrl: a.imageUrl,
                title: a.title,
                deletable: true,
              }))}
              onDelete={handleDeleteAsset}
            />
          ) : (
            <p className="border-border/70 bg-card/40 text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-center text-xs">
              Belum ada pin — scrape sedang berjalan atau gagal.
            </p>
          )}
        </div>
      );
    }

    if (source === "competitor") {
      if (groups.competitors.length === 0) {
        return (
          <VisualLibraryEmptyPanel
            hint="Buka Competitor Tracker, lalu klik Harvest Visuals di detail kompetitor."
            href={brandHubHref("/brand-hub/competitor-tracker", brandId)}
          />
        );
      }

      const selected = groups.competitors.find((c) => c.competitorId === entityId);
      if (!selected) return null;

      return (
        <div className="flex flex-col gap-4">
          <EntityHeaderBar
            name={selected.name}
            href={brandHubHref(
              `/brand-hub/competitor-tracker/${selected.competitorId}`,
              brandId,
            )}
          />
          <MoodboardGrid
            assets={selected.assets.map((a) => ({
              id: a.id,
              imageUrl: a.imageUrl,
              title: a.title,
              deletable: true,
            }))}
            onDelete={handleDeleteAsset}
          />
        </div>
      );
    }

    if (source === "competitorProduct") {
      if (groups.competitorProducts.length === 0) {
        return (
          <VisualLibraryEmptyPanel
            hint="Buka Competitor Products, lalu klik Harvest Visual di detail kategori."
            href={brandHubHref("/brand-hub/competitor-tracker/products", brandId)}
          />
        );
      }

      const selected = groups.competitorProducts.find(
        (c) => c.categoryId === entityId,
      );
      if (!selected) return null;

      return (
        <div className="flex flex-col gap-4">
          <EntityHeaderBar
            name={selected.name}
            href={brandHubHref(
              `/brand-hub/competitor-tracker/products/${selected.categoryId}`,
              brandId,
            )}
          />
          <MoodboardGrid
            assets={selected.assets.map((a) => ({
              id: a.id,
              imageUrl: a.imageUrl,
              title: a.title,
              deletable: true,
            }))}
            onDelete={handleDeleteAsset}
          />
        </div>
      );
    }

    if (source === "social") {
      if (groups.socialMonitors.length === 0) {
        return (
          <VisualLibraryEmptyPanel
            hint="Refresh monitor Social Listening, lalu klik Harvest Visuals."
            href={brandHubHref("/brand-hub/social-listening", brandId)}
          />
        );
      }

      const selected = groups.socialMonitors.find((m) => m.monitorId === entityId);
      if (!selected) return null;

      return (
        <div className="flex flex-col gap-4">
          <EntityHeaderBar
            name={selected.name}
            href={brandHubHref(
              `/brand-hub/social-listening/${selected.monitorId}`,
              brandId,
            )}
          />
          <MoodboardGrid
            assets={selected.assets.map((a) => ({
              id: a.id,
              imageUrl: a.imageUrl,
              title: a.title,
              deletable: true,
            }))}
            onDelete={handleDeleteAsset}
          />
        </div>
      );
    }

    if (source === "adLibrary") {
      if (groups.adLibraryMonitors.length === 0) {
        return (
          <VisualLibraryEmptyPanel
            hint="Buka Ad Library, lalu klik Harvest Visual di detail monitor."
            href={brandHubHref("/brand-hub/ad-library", brandId)}
          />
        );
      }

      const selected = groups.adLibraryMonitors.find(
        (m) => m.monitorId === entityId,
      );
      if (!selected) return null;

      return (
        <div className="flex flex-col gap-4">
          <EntityHeaderBar
            name={selected.name}
            href={brandHubHref(
              `/brand-hub/ad-library/${selected.monitorId}`,
              brandId,
            )}
          />
          <MoodboardGrid
            assets={selected.assets.map((a) => ({
              id: a.id,
              imageUrl: a.imageUrl,
              videoUrl: a.videoUrl,
              title: a.title,
              deletable: true,
            }))}
            onDelete={handleDeleteAsset}
          />
        </div>
      );
    }

    if (groups.manual.length === 0) {
      return (
        <VisualLibraryEmptyPanel
          hint="Upload gambar atau paste URL untuk referensi kustom."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setManualOpen(true)}
              disabled={pending}
            >
              <Upload className="size-3.5" />
              Upload Manual
            </Button>
          }
        />
      );
    }

    return (
      <MoodboardGrid
        assets={groups.manual.map((a) => ({
          id: a.id,
          imageUrl: a.imageUrl,
          title: a.title,
          deletable: true,
        }))}
        onDelete={handleDeleteAsset}
      />
    );
  }

  const showEntityPicker = source !== "manual" && entities.length > 0;

  return (
    <div className={cn(lab.entrance, "flex flex-col gap-5")}>
      {/* Papan bento ringkasan library */}
      {data.totalAssetCount > 0 ? (
        <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4">
          <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Total asset
            </span>
            <span className="bento-value text-white dark:text-pink-950">
              {data.totalAssetCount}
            </span>
            <span className="text-[11px] font-medium text-pink-100/90 dark:text-pink-900/80">
              dari {activeSourceCount}/{sources.length} sumber aktif
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
              Pin Pinterest
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {countPinterestAssets(groups)}
            </span>
            <span className="text-[11px] font-medium text-pink-800/60 dark:text-pink-200/50">
              {groups.pinterest.length} koleksi moodboard
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Visual kompetitor
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {competitorVisualCount}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
              toko, produk & iklan
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Social & manual
            </span>
            <span className="bento-value text-violet-950 dark:text-violet-300">
              {socialManualCount}
            </span>
            <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/50">
              monitor social + upload sendiri
            </span>
          </div>
        </div>
      ) : null}

      <VisualLibraryShell
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <VisualLibrarySourceTabs
              sources={sources}
              active={source}
              onChange={handleSourceChange}
            />
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-muted-foreground hidden text-xs sm:block">
                {filteredAssetCount} asset · limit default {data.pinterestMaxPins}/keyword
              </p>
              {sourceAction}
            </div>
          </div>
        }
        entityPicker={
          showEntityPicker ? (
            <VisualLibraryEntityPicker
              entities={entities}
              activeId={entityId}
              onChange={setEntityId}
            />
          ) : undefined
        }
      >
        {renderContent()}
      </VisualLibraryShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koleksi Pinterest</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama koleksi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Keywords (pisah koma)</Label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="bodycare aesthetic, minimalist packaging"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Limit pin per keyword</Label>
              <Input
                type="number"
                min={data.pinterestPinsMin}
                max={data.pinterestPinsMax}
                value={createMaxPins}
                onChange={(e) => setCreateMaxPins(e.target.value)}
              />
              <p className="text-muted-foreground text-[10px]">
                {data.pinterestPinsMin}–{data.pinterestPinsMax} pin per keyword scrape.
                Default workspace: {data.pinterestMaxPins}.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={pending}>
              Buat & Scrape
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah keyword Pinterest</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Pin baru dari keyword ini akan ditambahkan tanpa menghapus gambar
              yang sudah ada.
            </p>
            <div className="grid gap-1.5">
              <Label>Keyword baru (pisah koma)</Label>
              <Input
                value={newKeywordsText}
                onChange={(e) => setNewKeywordsText(e.target.value)}
                placeholder="summer glow, glass skin"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeywordDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleAppendKeywords} disabled={pending}>
              Tambah & scrape
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Manual</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 pb-2">
            <Button
              type="button"
              size="sm"
              variant={manualTab === "file" ? "default" : "outline"}
              onClick={() => setManualTab("file")}
            >
              File
            </Button>
            <Button
              type="button"
              size="sm"
              variant={manualTab === "url" ? "default" : "outline"}
              onClick={() => setManualTab("url")}
            >
              URL
            </Button>
          </div>
          <div className="grid gap-3 py-2">
            {manualTab === "file" ? (
              <div className="grid gap-1.5">
                <Label>Gambar (JPG/PNG/GIF/WebP, max 10 MB)</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                {selectedFile ? (
                  <p className="text-muted-foreground text-xs">{selectedFile.name}</p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>URL gambar</Label>
                <Input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://example.com/reference.jpg"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Title (opsional)</Label>
              <Input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tags (pisah koma, opsional)</Label>
              <Input
                value={manualTags}
                onChange={(e) => setManualTags(e.target.value)}
                placeholder="packaging, pastel, minimal"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleManualSubmit} disabled={pending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
