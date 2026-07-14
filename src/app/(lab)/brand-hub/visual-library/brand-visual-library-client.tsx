"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
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

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  READY: "Siap",
  FAILED: "Gagal",
};

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

  const selectedPinterest = useMemo(
    () => groups.pinterest.find((p) => p.collection.id === entityId),
    [groups.pinterest, entityId],
  );

  useEffect(() => {
    if (!entityId || !selectedPinterest) return;
    setPinLimits((prev) => {
      if (prev[entityId] !== undefined) return prev;
      const resolved =
        selectedPinterest.collection.maxPinsPerKeyword ?? data.pinterestMaxPins;
      return { ...prev, [entityId]: String(resolved) };
    });
  }, [entityId, selectedPinterest, data.pinterestMaxPins]);

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

  const entitiesKey = entities.map((e) => e.id).join(",");
  const prevEntitiesKey = useRef(entitiesKey);

  useEffect(() => {
    if (prevEntitiesKey.current !== entitiesKey) {
      prevEntitiesKey.current = entitiesKey;
      setEntityId(entities[0]?.id ?? null);
    } else if (!entityId && entities[0]) {
      setEntityId(entities[0].id);
    }
  }, [entitiesKey, entities, entityId]);

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
    const limit = parsePinLimit(pinLimits[id] ?? String(data.pinterestMaxPins));
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
        const limit = parsePinLimit(
          pinLimits[keywordDialogCollectionId] ?? String(data.pinterestMaxPins),
        );
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
      const pinLimit = parsePinLimit(
        pinLimits[collection.id] ?? String(data.pinterestMaxPins),
      );
      const effectiveLimit =
        pinLimit ?? collection.maxPinsPerKeyword ?? data.pinterestMaxPins;
      const approxTotal = effectiveLimit * collection.keywords.length;

      return (
        <div className="flex flex-col gap-4">
          <div className={cn(lab.panel, "flex flex-wrap items-start justify-between gap-3")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{collection.name}</h3>
                <Badge
                  variant={collection.status === "READY" ? "default" : "secondary"}
                >
                  {STATUS_LABEL[collection.status] ?? collection.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {collection.keywords.join(", ")}
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="grid gap-1">
                  <Label htmlFor={`pin-limit-${collection.id}`} className="text-[10px]">
                    Limit pin / keyword
                  </Label>
                  <Input
                    id={`pin-limit-${collection.id}`}
                    type="number"
                    min={data.pinterestPinsMin}
                    max={data.pinterestPinsMax}
                    className="h-8 w-28 text-xs"
                    value={
                      pinLimits[collection.id] ?? String(effectiveLimit)
                    }
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
              {collection.errorMessage ? (
                <p className="text-destructive mt-1 text-xs">
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
              >
                <Trash2 className="size-3.5" />
              </Button>
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
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-xs">
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
          <div className={cn(lab.panel, "flex items-center justify-between gap-2 px-3 py-2")}>
            <span className="text-sm font-medium">{selected.name}</span>
            <Link
              href={brandHubHref(
                `/brand-hub/competitor-tracker/${selected.competitorId}`,
                brandId,
              )}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
            >
              <ExternalLink className="size-3.5" />
              Detail
            </Link>
          </div>
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
          <div className={cn(lab.panel, "flex items-center justify-between gap-2 px-3 py-2")}>
            <span className="text-sm font-medium">{selected.name}</span>
            <Link
              href={brandHubHref(
                `/brand-hub/competitor-tracker/products/${selected.categoryId}`,
                brandId,
              )}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
            >
              <ExternalLink className="size-3.5" />
              Detail
            </Link>
          </div>
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
          <div className={cn(lab.panel, "flex items-center justify-between gap-2 px-3 py-2")}>
            <span className="text-sm font-medium">{selected.name}</span>
            <Link
              href={brandHubHref(
                `/brand-hub/social-listening/${selected.monitorId}`,
                brandId,
              )}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
            >
              <ExternalLink className="size-3.5" />
              Detail
            </Link>
          </div>
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
          <div className={cn(lab.panel, "flex items-center justify-between gap-2 px-3 py-2")}>
            <span className="text-sm font-medium">{selected.name}</span>
            <Link
              href={brandHubHref(
                `/brand-hub/ad-library/${selected.monitorId}`,
                brandId,
              )}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
            >
              <ExternalLink className="size-3.5" />
              Detail
            </Link>
          </div>
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
    <div className={lab.entrance}>
    <>
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
    </>
    </div>
  );
}
