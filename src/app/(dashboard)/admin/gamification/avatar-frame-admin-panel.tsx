"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  Gift,
  ImageIcon,
  Lock,
  Pencil,
  Plus,
  Save,
  Trophy,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  createGamificationAvatarFrame,
  updateGamificationAvatarFrame,
} from "@/actions/gamification";
import { actionErrorMessage } from "@/lib/action-error-message";
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
import type { AdminAchievementOption } from "./background-admin-panel";

type UnlockType = "FREE" | "LEVEL" | "ACHIEVEMENT" | "CUSTOM_UPLOAD";

export type AdminAvatarFrameItem = {
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

function frameSrc(item: AdminAvatarFrameItem): string {
  return typeof item.styleConfig.src === "string" ? item.styleConfig.src : "";
}

function frameScale(item: AdminAvatarFrameItem): number {
  const n = Number(item.styleConfig.scale);
  return Number.isFinite(n) ? Math.max(0.9, Math.min(2, n)) : 1.28;
}

function frameOffset(
  item: AdminAvatarFrameItem,
  key: "offsetX" | "offsetY",
): number {
  const n = Number(item.styleConfig[key]);
  return Number.isFinite(n) ? Math.max(-50, Math.min(50, n)) : 0;
}

function FramePreview({
  item,
  scale,
  offsetX,
  offsetY,
  className,
}: {
  item: AdminAvatarFrameItem;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  className?: string;
}) {
  const src = frameSrc(item);
  const previewScale = scale ?? frameScale(item);
  const x = offsetX ?? frameOffset(item, "offsetX");
  const y = offsetY ?? frameOffset(item, "offsetY");
  const size = `${Math.round(previewScale * 100)}%`;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_38%,hsl(var(--muted)),transparent_62%)]",
        className,
      )}
    >
      <div className="relative size-28 rounded-full bg-muted/70 shadow-inner sm:size-32">
        <div className="absolute inset-[12%] flex items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background">
          <User className="size-10 text-muted-foreground" aria-hidden />
        </div>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="pointer-events-none absolute max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
            style={{
              left: `calc(50% + ${x}%)`,
              top: `calc(50% + ${y}%)`,
              width: size,
              height: size,
            }}
            decoding="async"
          />
        ) : (
          <ImageIcon
            className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function UnlockChip({
  item,
  achievements,
}: {
  item: AdminAvatarFrameItem;
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

function ScaleField({
  defaultValue,
  onPreview,
}: {
  defaultValue: number;
  onPreview?: (scale: number) => void;
}) {
  const [scale, setScale] = useState(defaultValue);
  return (
    <Field label="Ukuran overlay">
      <div className="flex items-center gap-3">
        <input
          type="range"
          name="scale"
          min={0.9}
          max={2}
          step={0.02}
          value={scale}
          onChange={(e) => {
            const next = Number(e.currentTarget.value);
            setScale(next);
            onPreview?.(next);
          }}
          className="accent-primary h-1.5 flex-1 cursor-pointer"
          aria-label="Ukuran overlay frame"
        />
        <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
          {Math.round(scale * 100)}%
        </span>
      </div>
    </Field>
  );
}

function OffsetField({
  label,
  name,
  defaultValue,
  onPreview,
}: {
  label: string;
  name: "offsetX" | "offsetY";
  defaultValue: number;
  onPreview?: (offset: number) => void;
}) {
  const [offset, setOffset] = useState(defaultValue);
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          name={name}
          min={-50}
          max={50}
          step={1}
          value={offset}
          onChange={(e) => {
            const next = Number(e.currentTarget.value);
            setOffset(next);
            onPreview?.(next);
          }}
          className="accent-primary h-1.5 flex-1 cursor-pointer"
          aria-label={label}
        />
        <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
          {offset > 0 ? "+" : ""}
          {offset}%
        </span>
      </div>
    </Field>
  );
}

function FrameCard({
  item,
  achievements,
}: {
  item: AdminAvatarFrameItem;
  achievements: AdminAchievementOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [previewScale, setPreviewScale] = useState(() => frameScale(item));
  const [previewOffsetX, setPreviewOffsetX] = useState(() =>
    frameOffset(item, "offsetX"),
  );
  const [previewOffsetY, setPreviewOffsetY] = useState(() =>
    frameOffset(item, "offsetY"),
  );

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateGamificationAvatarFrame(formData);
        toast.success("Frame avatar diperbarui.");
        setOpen(false);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memperbarui frame avatar."));
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
          <FramePreview item={item} className="absolute inset-0" />
          <div className="pointer-events-none absolute right-2.5 top-2.5 z-10">
            <StatusDot active={item.isActive} />
          </div>
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
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <UnlockChip item={item} achievements={achievements} />
          </div>
        </div>

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

      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit frame avatar</DialogTitle>
          <DialogDescription>
            Ganti PNG frame, ukuran overlay, urutan tampil, dan syarat unlock.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />

          <FramePreview
            item={item}
            scale={previewScale}
            offsetX={previewOffsetX}
            offsetY={previewOffsetY}
            className="aspect-video rounded-xl border border-border/60"
          />

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
            <Field label="Nama frame">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="File PNG/WebP baru">
              <label className="border-border/70 bg-background hover:border-primary/50 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors">
                <ImageIcon className="text-muted-foreground size-5" aria-hidden />
                <span className="text-foreground text-xs font-medium">
                  Pilih file pengganti
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Opsional, wajib transparan
                </span>
                <input
                  type="file"
                  name="frameFile"
                  accept="image/png,image/webp"
                  className="sr-only"
                />
              </label>
            </Field>
            <ScaleField defaultValue={frameScale(item)} onPreview={setPreviewScale} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <OffsetField
              label="Posisi kiri/kanan"
              name="offsetX"
              defaultValue={frameOffset(item, "offsetX")}
              onPreview={setPreviewOffsetX}
            />
            <OffsetField
              label="Posisi atas/bawah"
              name="offsetY"
              defaultValue={frameOffset(item, "offsetY")}
              onPreview={setPreviewOffsetY}
            />
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
                Saat nonaktif, frame disembunyikan dari user.
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

function AddFrameCard({
  achievements,
}: {
  achievements: AdminAchievementOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onCreate(formData: FormData) {
    startTransition(async () => {
      try {
        await createGamificationAvatarFrame(formData);
        toast.success("Frame avatar ditambahkan.");
        setOpen(false);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menambahkan frame avatar."));
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
            Tambah frame avatar
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            PNG/WebP transparan
          </span>
        </span>
      </DialogTrigger>

      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah frame avatar PNG</DialogTitle>
          <DialogDescription>
            Unggah frame transparan lalu tentukan syarat unlock untuk user.
          </DialogDescription>
        </DialogHeader>

        <form action={onCreate} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
            <Field label="Nama frame">
              <Input name="name" maxLength={120} placeholder="Mahkota Emas" required />
            </Field>
            <Field label="Urutan">
              <Input name="sortOrder" type="number" min={0} defaultValue={500} />
            </Field>
          </div>

          <UnlockFields
            defaultType="LEVEL"
            defaultLevel={5}
            defaultAchievement={achievements[0]?.key ?? null}
            achievements={achievements}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="File frame">
              <label className="border-border/70 bg-background hover:border-primary/50 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors">
                <Upload className="text-muted-foreground size-5" aria-hidden />
                <span className="text-foreground text-xs font-medium">
                  Pilih PNG/WebP
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Wajib transparan
                </span>
                <input
                  type="file"
                  name="frameFile"
                  accept="image/png,image/webp"
                  className="sr-only"
                  required
                />
              </label>
            </Field>
            <ScaleField defaultValue={1.28} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <OffsetField
              label="Posisi kiri/kanan"
              name="offsetX"
              defaultValue={0}
            />
            <OffsetField
              label="Posisi atas/bawah"
              name="offsetY"
              defaultValue={0}
            />
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

export function AvatarFrameAdminPanel({
  frames,
  achievements,
}: {
  frames: AdminAvatarFrameItem[];
  achievements: AdminAchievementOption[];
}) {
  const adminFrames = useMemo(
    () => frames.filter((item) => item.styleConfig.effect === "asset-frame"),
    [frames],
  );
  const activeCount = adminFrames.filter((b) => b.isActive).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Frame avatar
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm">
            Kelola frame reward yang dapat digunakan anggota tim.
          </p>
        </div>
        <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {activeCount} dari {adminFrames.length} aktif
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AddFrameCard achievements={achievements} />
        {adminFrames.map((item) => (
          <FrameCard key={item.id} item={item} achievements={achievements} />
        ))}
      </div>
    </section>
  );
}
