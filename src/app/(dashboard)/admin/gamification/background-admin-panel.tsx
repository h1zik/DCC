"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  Film,
  Gift,
  ImageIcon,
  Layers,
  Lock,
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trophy,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import {
  createGamificationBackground,
  updateGamificationBackground,
} from "@/actions/gamification";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { CosmeticAssetMedia } from "@/lib/gamification/cosmetic-assets";
import { backgroundFromStyleConfig } from "@/components/profile/gamification/cosmetic-mini-preview";
import { LiveBackground } from "@/components/profile/gamification/live-background";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type UnlockType = "FREE" | "LEVEL" | "ACHIEVEMENT";

export type AdminBackgroundItem = {
  id: string;
  key: string;
  name: string;
  previewRef: string;
  styleConfig: Record<string, unknown>;
  unlockType: UnlockType;
  unlockLevel: number | null;
  unlockAchievementKey: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type AdminAchievementOption = {
  key: string;
  name: string;
};

/* ── Helper baca styleConfig ───────────────────────────────────────────────── */

function srcFromConfig(item: AdminBackgroundItem): string {
  return typeof item.styleConfig.src === "string" ? item.styleConfig.src : "";
}

function posterFromConfig(item: AdminBackgroundItem): string | undefined {
  return typeof item.styleConfig.poster === "string"
    ? item.styleConfig.poster
    : undefined;
}

function mediaFromConfig(item: AdminBackgroundItem): CosmeticAssetMedia {
  const media = item.styleConfig.media;
  if (media === "video" || media === "lottie" || media === "image") return media;
  return "image";
}

/** Focal point tersimpan → {x,y} dalam persen (default tengah). */
function focalFromConfig(item: AdminBackgroundItem): { x: number; y: number } {
  const raw =
    typeof item.styleConfig.focalPoint === "string"
      ? item.styleConfig.focalPoint
      : "";
  const m = raw.match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!m) return { x: 50, y: 50 };
  const clamp = (v: string) => Math.max(0, Math.min(100, Number(v)));
  return { x: clamp(m[1]), y: clamp(m[2]) };
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;

/** Zoom tersimpan (default 1 = cover). */
function zoomFromConfig(item: AdminBackgroundItem): number {
  const z = item.styleConfig.zoom;
  const n = typeof z === "number" ? z : Number(z);
  return Number.isFinite(n) && n > 0
    ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, n))
    : 1;
}

/** Mode fit tersimpan (default cover). */
function fitFromConfig(item: AdminBackgroundItem): "cover" | "contain" {
  return item.styleConfig.fit === "contain" ? "contain" : "cover";
}

const MEDIA_META: Record<
  CosmeticAssetMedia,
  { label: string; icon: typeof Film }
> = {
  video: { label: "Video", icon: Film },
  lottie: { label: "Lottie", icon: Layers },
  image: { label: "Image", icon: ImageIcon },
};

/* ── Live preview (dipakai di kartu & dialog) ─────────────────────────────── */

function useBackgroundPreview(item: AdminBackgroundItem) {
  const src = srcFromConfig(item);
  const media = mediaFromConfig(item);
  return useMemo(
    () =>
      backgroundFromStyleConfig(item.styleConfig) ?? {
        effect: "asset-loop" as const,
        src,
        poster: posterFromConfig(item),
        media,
      },
    [item, media, src],
  );
}

function BackgroundPreview({
  item,
  className,
  animate = true,
  focalPoint,
  zoom,
  fit,
}: {
  item: AdminBackgroundItem;
  className?: string;
  animate?: boolean;
  /** Override focal point (dipakai editor untuk pratinjau real-time). */
  focalPoint?: string;
  /** Override zoom (dipakai editor untuk pratinjau real-time). */
  zoom?: number;
  /** Override fit (dipakai editor untuk pratinjau real-time). */
  fit?: "cover" | "contain";
}) {
  const base = useBackgroundPreview(item);
  const preview =
    base.effect === "asset-loop"
      ? {
          ...base,
          focalPoint: focalPoint ?? base.focalPoint,
          zoom: zoom ?? base.zoom,
          fit: fit ?? base.fit,
        }
      : base;
  const hasSrc = preview.effect === "asset-loop" && preview.src;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-muted/60 to-muted/20",
        className,
      )}
    >
      {hasSrc ? (
        <LiveBackground background={preview} animate={animate} />
      ) : (
        <div className="text-muted-foreground/50 absolute inset-0 flex items-center justify-center">
          <ImageIcon className="size-8" aria-hidden />
        </div>
      )}
    </div>
  );
}

/* ── Background framer (geser + zoom untuk pas ke area profil) ─────────────── */

const clampPct = (v: number) => Math.max(0, Math.min(100, v));
const clampZoom = (v: number) =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(v * 100) / 100));

/**
 * Bingkai = area background yang tampil di profil user. Admin men-drag gambar
 * untuk menggeser (pan) dan memakai slider/scroll untuk zoom. Pratinjau memakai
 * CSS yang sama persis dengan profil → WYSIWYG.
 */
function BackgroundFramer({ item }: { item: AdminBackgroundItem }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [focal, setFocal] = useState(() => focalFromConfig(item));
  const [zoom, setZoom] = useState(() => zoomFromConfig(item));
  const [fit, setFit] = useState(() => fitFromConfig(item));
  const [dragging, setDragging] = useState(false);
  // Titik awal drag: posisi pointer + focal saat mulai (grab-to-pan).
  const dragStart = useRef<{ px: number; py: number; fx: number; fy: number }>({
    px: 0,
    py: 0,
    fx: 50,
    fy: 50,
  });

  const focalValue = `${Math.round(focal.x)}% ${Math.round(focal.y)}%`;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStart.current = { px: e.clientX, py: e.clientY, fx: focal.x, fy: focal.y };
      setDragging(true);
    },
    [focal.x, focal.y],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const rect = areaRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const { px, py, fx, fy } = dragStart.current;
      // Grab: geser gambar searah pointer → focal bergerak berlawanan.
      const dx = ((e.clientX - px) / rect.width) * 100;
      const dy = ((e.clientY - py) / rect.height) * 100;
      setFocal({
        x: clampPct(fx - dx / zoom),
        y: clampPct(fy - dy / zoom),
      });
    },
    [zoom],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  }, []);

  const onWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    setZoom((z) => clampZoom(z - e.deltaY * 0.0015));
  }, []);

  const nudgeZoom = useCallback((delta: number) => {
    setZoom((z) => clampZoom(z + delta));
  }, []);

  const reset = useCallback(() => {
    setFocal({ x: 50, y: 50 });
    setZoom(1);
  }, []);

  return (
    <div className="space-y-2">
      <div
        ref={areaRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        className={cn(
          // Rasio 31/10 dikunci = identik dengan band background di profil user
          // & pratinjau edit profile. Frame editor sebentuk dengan hasil akhir →
          // crop/pan/zoom benar-benar WYSIWYG, tanpa bar kosong.
          "border-border/60 relative aspect-[31/10] w-full touch-none select-none overflow-hidden rounded-xl border",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <BackgroundPreview
          item={item}
          focalPoint={focalValue}
          zoom={zoom}
          fit={fit}
          className="absolute inset-0"
        />
        {/* Rule-of-thirds guide */}
        <div className="pointer-events-none absolute inset-0 z-10 opacity-40">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
        </div>
        <span className="bg-black/55 text-white pointer-events-none absolute left-2 top-2 z-20 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          Area profil
        </span>
      </div>

      {/* Toggle mode fit */}
      <div className="border-border/60 grid grid-cols-2 gap-1 rounded-lg border p-1">
        {(
          [
            { key: "cover", label: "Penuhi bingkai", hint: "bisa terpotong" },
            { key: "contain", label: "Tampilkan utuh", hint: "gambar penuh" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFit(opt.key)}
            aria-pressed={fit === opt.key}
            className={cn(
              "flex flex-col items-center rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              fit === opt.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                "text-[10px]",
                fit === opt.key
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground/70",
              )}
            >
              {opt.hint}
            </span>
          </button>
        ))}
      </div>

      {/* Kontrol zoom */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => nudgeZoom(-0.1)}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Perkecil"
        >
          <ZoomOut className="size-4" />
        </Button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(clampZoom(Number(e.currentTarget.value)))}
          className="accent-primary h-1.5 flex-1 cursor-pointer"
          aria-label="Zoom"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => nudgeZoom(0.1)}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Perbesar"
        >
          <ZoomIn className="size-4" />
        </Button>
        <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={reset}
          aria-label="Reset posisi & zoom"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <input type="hidden" name="focalPoint" value={focalValue} />
      <input type="hidden" name="zoom" value={zoom} />
      <input type="hidden" name="fit" value={fit} />
      <p className="text-muted-foreground text-[11px]">
        {fit === "contain"
          ? "Gambar tampil utuh tanpa terpotong; sisa area terisi warna tema. Zoom untuk memperbesar."
          : "Geser gambar untuk memposisikan, scroll atau slider untuk zoom. Bingkai = area yang tampil di profil user."}
      </p>
    </div>
  );
}

/* ── Chip badge unlock / media / status ───────────────────────────────────── */

function UnlockChip({
  item,
  achievements,
}: {
  item: AdminBackgroundItem;
  achievements: AdminAchievementOption[];
}) {
  let icon: ReactNode;
  let text: string;
  if (item.unlockType === "FREE") {
    icon = <Gift className="size-3" aria-hidden />;
    text = "Gratis";
  } else if (item.unlockType === "LEVEL") {
    icon = <Lock className="size-3" aria-hidden />;
    text = `Level ${item.unlockLevel ?? "?"}`;
  } else {
    icon = <Trophy className="size-3" aria-hidden />;
    text =
      achievements.find((a) => a.key === item.unlockAchievementKey)?.name ??
      item.unlockAchievementKey ??
      "Achievement";
  }
  return (
    <span className="border-border/70 bg-background/80 text-foreground inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
      <span className="text-[color:var(--chart-1)] shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

function MediaChip({ media }: { media: CosmeticAssetMedia }) {
  const meta = MEDIA_META[media];
  const Icon = meta.icon;
  return (
    <span className="bg-black/55 text-white inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

/* ── Field & Unlock inputs (native — FormData) ────────────────────────────── */

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const selectClass =
  "border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function UnlockFields({
  defaultType,
  defaultLevel,
  defaultAchievement,
  achievements,
}: {
  defaultType: UnlockType;
  defaultLevel: number | null;
  defaultAchievement: string | null;
  achievements: AdminAchievementOption[];
}) {
  const initial =
    defaultType === "FREE" || defaultType === "ACHIEVEMENT" ? defaultType : "LEVEL";
  const [unlockType, setUnlockType] = useState<"FREE" | "LEVEL" | "ACHIEVEMENT">(
    initial,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Syarat unlock">
        <select
          name="unlockType"
          value={unlockType}
          onChange={(e) =>
            setUnlockType(e.currentTarget.value as "FREE" | "LEVEL" | "ACHIEVEMENT")
          }
          className={selectClass}
        >
          <option value="LEVEL">Level tertentu</option>
          <option value="ACHIEVEMENT">Achievement tertentu</option>
          <option value="FREE">Gratis</option>
        </select>
      </Field>
      {unlockType === "LEVEL" ? (
        <Field label="Level">
          <Input
            name="unlockLevel"
            type="number"
            min={1}
            max={50}
            defaultValue={defaultLevel ?? 5}
          />
        </Field>
      ) : null}
      {unlockType === "ACHIEVEMENT" ? (
        <Field label="Achievement">
          <select
            name="unlockAchievementKey"
            defaultValue={defaultAchievement ?? achievements[0]?.key ?? ""}
            className={selectClass}
          >
            {achievements.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}

/* ── Kartu background (display + dialog edit) ──────────────────────────────── */

function BackgroundCard({
  item,
  achievements,
}: {
  item: AdminBackgroundItem;
  achievements: AdminAchievementOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const media = mediaFromConfig(item);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateGamificationBackground(formData);
        toast.success("Background diperbarui.");
        setOpen(false);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memperbarui background."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group border-border/70 hover:border-primary/50 relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md has-[button:focus-visible]:border-ring has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50",
          !item.isActive && "opacity-75",
        )}
      >
        <div className="relative aspect-video w-full">
          <BackgroundPreview item={item} className="absolute inset-0" />
          {/* Overlay chip atas */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2.5">
            <MediaChip media={media} />
            <StatusDot active={item.isActive} />
          </div>
          {/* Affordance edit saat hover (dekoratif — seluruh kartu klik-able) */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
            <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium shadow-md">
              <Pencil className="size-4" />
              Edit
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5">
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">
              {item.name}
            </p>
            <p className="text-muted-foreground truncate font-mono text-[11px]">
              {item.key}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <UnlockChip item={item} achievements={achievements} />
            <span className="text-muted-foreground text-[11px]">
              · urutan {item.sortOrder}
            </span>
          </div>
        </div>

        {/* Trigger transparan menutupi seluruh kartu — klik di mana saja untuk edit. */}
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label={`Edit ${item.name}`}
              className="absolute inset-0 z-20 cursor-pointer rounded-2xl outline-none"
            />
          }
        />
      </div>

      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit background</DialogTitle>
          <DialogDescription>
            Ubah nama, urutan tampil, dan syarat unlock kosmetik ini.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />

          <BackgroundFramer item={item} />

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
            <Field label="Nama background">
              <Input name="name" defaultValue={item.name} maxLength={120} required />
            </Field>
            <Field label="Urutan">
              <Input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={item.sortOrder}
              />
            </Field>
          </div>

          <UnlockFields
            defaultType={item.unlockType}
            defaultLevel={item.unlockLevel}
            defaultAchievement={item.unlockAchievementKey}
            achievements={achievements}
          />

          <label className="border-border/60 bg-muted/30 flex items-center gap-2.5 rounded-lg border p-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={item.isActive}
              className="size-4 rounded border-input accent-primary"
            />
            <span>
              <span className="font-medium">Tampilkan di edit profile</span>
              <span className="text-muted-foreground block text-xs">
                Saat nonaktif, kosmetik disembunyikan dari user.
              </span>
            </span>
          </label>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Batal
            </DialogClose>
            <Button type="submit" disabled={pending}>
              <Save className="size-4" />
              Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className="bg-black/55 text-white inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm"
      title={active ? "Aktif" : "Disembunyikan"}
    >
      <span
        className="size-1.5 rounded-full"
        style={{
          background: active ? "var(--color-success)" : "var(--color-warning)",
        }}
        aria-hidden
      />
      {active ? "Aktif" : "Hidden"}
    </span>
  );
}

/* ── Kartu "tambah" + dialog create ───────────────────────────────────────── */

function AddBackgroundCard({
  achievements,
}: {
  achievements: AdminAchievementOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onCreate(formData: FormData) {
    startTransition(async () => {
      try {
        await createGamificationBackground(formData);
        toast.success("Background animasi ditambahkan.");
        setOpen(false);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menambahkan background."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="group border-border/70 hover:border-primary/60 hover:bg-accent/40 flex min-h-[13rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors"
          />
        }
      >
        <span
          className="text-[color:var(--chart-1)] inline-flex size-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
          style={{
            background: "color-mix(in oklab, var(--chart-1) 12%, transparent)",
          }}
        >
          <Plus className="size-6" />
        </span>
        <span>
          <span className="text-foreground block text-sm font-semibold">
            Tambah background
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            WebP, MP4, Lottie JSON / .lottie
          </span>
        </span>
      </DialogTrigger>

      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah background animasi</DialogTitle>
          <DialogDescription>
            Unggah aset lalu tentukan syarat unlock. Poster statis opsional dipakai
            saat animasi dimatikan.
          </DialogDescription>
        </DialogHeader>

        <form action={onCreate} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
            <Field label="Nama background">
              <Input name="name" maxLength={120} placeholder="Aurora lembur" required />
            </Field>
            <Field label="Urutan">
              <Input name="sortOrder" type="number" min={0} defaultValue={200} />
            </Field>
          </div>

          <UnlockFields
            defaultType="LEVEL"
            defaultLevel={5}
            defaultAchievement={achievements[0]?.key ?? null}
            achievements={achievements}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="File animasi">
              <label className="border-border/70 bg-background hover:border-primary/50 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors">
                <Film className="text-muted-foreground size-5" aria-hidden />
                <span className="text-foreground text-xs font-medium">
                  Pilih file animasi
                </span>
                <span className="text-muted-foreground text-[11px]">
                  WebP, MP4, JSON, .lottie · Maks. 20 MB
                </span>
                <input
                  type="file"
                  name="animationFile"
                  accept="image/png,image/jpeg,image/webp,video/mp4,.mp4,.json,.lottie,application/json"
                  className="sr-only"
                  required
                />
              </label>
            </Field>
            <Field label="Poster statis">
              <label className="border-border/70 bg-background hover:border-primary/50 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors">
                <ImageIcon className="text-muted-foreground size-5" aria-hidden />
                <span className="text-foreground text-xs font-medium">
                  Pilih poster
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Opsional · PNG/JPG/WebP
                </span>
                <input
                  type="file"
                  name="posterFile"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                />
              </label>
            </Field>
          </div>

          <label className="border-border/60 bg-muted/30 flex items-center gap-2.5 rounded-lg border p-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="size-4 rounded border-input accent-primary"
            />
            <span className="font-medium">Aktif setelah dibuat</span>
          </label>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Batal
            </DialogClose>
            <Button type="submit" disabled={pending}>
              <Upload className="size-4" />
              Tambahkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Panel ────────────────────────────────────────────────────────────────── */

export function BackgroundAdminPanel({
  backgrounds,
  achievements,
}: {
  backgrounds: AdminBackgroundItem[];
  achievements: AdminAchievementOption[];
}) {
  const animatedBackgrounds = backgrounds.filter((item) => {
    const effect = String(item.styleConfig.effect ?? "");
    return effect !== "gradient" && effect !== "image";
  });
  const activeCount = animatedBackgrounds.filter((b) => b.isActive).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--chart-1)]">
            Katalog kosmetik
          </span>
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Background animasi
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm">
            Reward background untuk edit profile—kunci berdasarkan level atau
            achievement agar user termotivasi mengejarnya.
          </p>
        </div>
        <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
          <span className="text-foreground font-semibold tabular-nums">
            {animatedBackgrounds.length}
          </span>
          <span>di katalog</span>
          <span aria-hidden>·</span>
          <span className="text-foreground font-semibold tabular-nums">
            {activeCount}
          </span>
          <span>aktif</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AddBackgroundCard achievements={achievements} />
        {animatedBackgrounds.map((item) => (
          <BackgroundCard key={item.id} item={item} achievements={achievements} />
        ))}
      </div>

      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <LockKeyhole className="size-3.5" aria-hidden />
        Background terkunci otomatis di editor user sampai syarat unlock terpenuhi.
      </p>
    </section>
  );
}
