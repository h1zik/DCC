"use client";

import { createElement, useState, useTransition, type ReactNode } from "react";
import {
  Award,
  CalendarCheck,
  CalendarHeart,
  CircleCheckBig,
  Crown,
  DatabaseZap,
  FileIcon,
  Film,
  Flame,
  Gauge,
  ImageIcon,
  Layers,
  Lock,
  Moon,
  Pencil,
  Save,
  Siren,
  Sparkles,
  Trophy,
  Undo2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { updateGamificationAchievementSymbol } from "@/actions/gamification";
import { actionErrorMessage } from "@/lib/action-error-message";
import { CosmeticLottiePlayer } from "@/components/profile/gamification/cosmetic-lottie-player";
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

type AchievementSymbolMedia = "image" | "video" | "lottie" | "file";

export type AdminAchievementSymbolItem = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  icon: string;
  symbolSrc: string | null;
  symbolMedia: string | null;
  symbolPoster: string | null;
  symbolFileName: string | null;
  hidden: boolean;
  isActive: boolean;
  sortOrder: number;
};

const ICONS: Record<string, LucideIcon> = {
  CalendarCheck,
  CalendarHeart,
  Flame,
  CircleCheckBig,
  Gauge,
  Sparkles,
  Siren,
  DatabaseZap,
  Crown,
  TrendingUp: Trophy,
  Moon,
  Undo2,
  Lock,
  Trophy,
};

const ICON_OPTIONS = Object.keys(ICONS).sort();

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Award;
}

function mediaFor(item: AdminAchievementSymbolItem): AchievementSymbolMedia | null {
  if (
    item.symbolMedia === "image" ||
    item.symbolMedia === "video" ||
    item.symbolMedia === "lottie" ||
    item.symbolMedia === "file"
  ) {
    return item.symbolMedia;
  }
  return null;
}

function MediaChip({ item }: { item: AdminAchievementSymbolItem }) {
  const media = mediaFor(item);
  const meta: { icon: LucideIcon; label: string } =
    media === "video"
      ? { icon: Film, label: "Video" }
      : media === "lottie"
        ? { icon: Layers, label: "Lottie" }
        : media === "file"
          ? { icon: FileIcon, label: "File" }
          : media === "image"
            ? { icon: ImageIcon, label: "Image" }
            : { icon: iconFor(item.icon), label: "Lucide" };
  const Icon = meta.icon;

  return (
    <span className="border-border/70 bg-background/80 text-foreground inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
      <Icon className="text-[color:var(--chart-1)] size-3 shrink-0" aria-hidden />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

function AchievementSymbolPreview({
  item,
  className,
}: {
  item: AdminAchievementSymbolItem;
  className?: string;
}) {
  const media = mediaFor(item);
  const hasAsset = Boolean(item.symbolSrc && media);
  const fallback = createElement(iconFor(item.icon), {
    className: "size-9",
    "aria-hidden": true,
  });

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-muted/70 to-background",
        className,
      )}
    >
      <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-full bg-background/80 ring-2 ring-border/70">
        {hasAsset && item.symbolSrc ? (
          media === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.symbolSrc}
              alt=""
              className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain"
              decoding="async"
            />
          ) : media === "video" ? (
            <video
              src={item.symbolSrc}
              poster={item.symbolPoster ?? undefined}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain"
              aria-hidden
            />
          ) : media === "lottie" ? (
            <CosmeticLottiePlayer
              src={item.symbolSrc}
              poster={item.symbolPoster ?? undefined}
              active
              fit="contain"
              className="!inset-2 !h-[calc(100%-1rem)] !w-[calc(100%-1rem)]"
            />
          ) : (
            <FileIcon className="size-9 text-muted-foreground" aria-hidden />
          )
        ) : (
          fallback
        )}
      </div>
    </div>
  );
}

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

function AchievementSymbolCard({ item }: { item: AdminAchievementSymbolItem }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateGamificationAchievementSymbol(formData);
        toast.success("Simbol achievement diperbarui.");
        setOpen(false);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memperbarui simbol achievement."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="group border-border/70 hover:border-primary/50 relative flex min-h-48 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md has-[button:focus-visible]:border-ring has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50">
        <AchievementSymbolPreview item={item} className="aspect-video rounded-none border-0" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
          <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium shadow-md">
            <Pencil className="size-4" />
            Edit
          </span>
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
            <MediaChip item={item} />
            <span className="text-muted-foreground text-[11px]">{item.tier}</span>
          </div>
        </div>

        <DialogTrigger
          render={
            <button
              type="button"
              aria-label={`Edit simbol ${item.name}`}
              className="absolute inset-0 z-20 cursor-pointer rounded-2xl outline-none"
            />
          }
        />
      </div>

      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit simbol achievement</DialogTitle>
          <DialogDescription>
            Upload simbol visual untuk profil user. Bila file dikosongkan, sistem
            tetap memakai ikon fallback.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />

          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <AchievementSymbolPreview item={item} className="aspect-square" />
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-foreground text-sm font-semibold">{item.name}</p>
                <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">
                  {item.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <MediaChip item={item} />
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                  {item.category}
                </span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                  {item.tier}
                </span>
              </div>
            </div>
          </div>

          <Field label="Ikon fallback">
            <Input
              name="icon"
              list="achievement-icon-options"
              defaultValue={item.icon}
              maxLength={48}
              required
            />
            <datalist id="achievement-icon-options">
              {ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon} />
              ))}
            </datalist>
          </Field>

          <Field label="File simbol baru">
            <label className="border-border/70 bg-background hover:border-primary/50 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors">
              <Upload className="text-muted-foreground size-5" aria-hidden />
              <span className="text-foreground text-xs font-medium">
                Pilih file pengganti
              </span>
              <span className="text-muted-foreground text-[11px]">
                PNG/JPG/WebP/GIF, MP4, Lottie JSON/.lottie, atau PDF
              </span>
              <input
                type="file"
                name="symbolFile"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,.mp4,.json,.lottie,application/json,application/pdf,.pdf"
                className="sr-only"
              />
            </label>
          </Field>

          {item.symbolSrc ? (
            <label className="border-border/60 bg-muted/30 flex items-center gap-2.5 rounded-lg border p-3 text-sm text-foreground">
              <input
                type="checkbox"
                name="removeSymbol"
                className="size-4 rounded border-input accent-primary"
              />
              <span>
                <span className="font-medium">Hapus file simbol kustom</span>
                <span className="text-muted-foreground block text-xs">
                  Achievement akan kembali memakai ikon fallback.
                </span>
              </span>
            </label>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Batal
            </DialogClose>
            <Button type="submit" disabled={pending}>
              <Save className="size-4" />
              Simpan simbol
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AchievementSymbolAdminPanel({
  achievements,
}: {
  achievements: AdminAchievementSymbolItem[];
}) {
  const customCount = achievements.filter((a) => a.symbolSrc).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--chart-1)]">
            Katalog achievement
          </span>
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Simbol achievement
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm">
            Ganti simbol dasar dengan gambar, video pendek, Lottie, atau file
            pendukung yang tampil di profile showcase user.
          </p>
        </div>
        <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
          <span className="text-foreground font-semibold tabular-nums">
            {achievements.length}
          </span>
          <span>achievement</span>
          <span aria-hidden>.</span>
          <span className="text-foreground font-semibold tabular-nums">
            {customCount}
          </span>
          <span>custom</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {achievements.map((item) => (
          <AchievementSymbolCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
