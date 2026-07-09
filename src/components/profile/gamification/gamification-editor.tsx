"use client";

/**
 * Editor gamifikasi profil: kiri = live preview kartu profil (render animasi
 * kosmetik SUNGGUHAN via runtime yang sama dgn halaman view), kanan = editor
 * bertab (Tampilan / Showcase / Achievements). Perubahan equip di-stage lalu
 * Simpan/Batal eksplisit; server RE-VALIDASI kepemilikan (equip hanya yang berhak).
 */
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, Sparkles, Upload, User, X } from "lucide-react";
import {
  resolveProfileCosmetics,
  type CosmeticLite,
} from "@/lib/gamification/cosmetics";
import type {
  CosmeticOption,
  GamificationEditorData,
} from "@/lib/gamification/editor-data";
import {
  clearCustomBackground,
  updateProfileConfig,
  uploadCustomBackground,
} from "@/actions/gamification";
import { updateProfileTaglineSticker } from "@/actions/profile";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  bannerGradientCss,
  isProfileBannerPreset,
  PROFILE_STICKERS,
  PROFILE_STICKER_IDS,
} from "@/lib/profile-appearance";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { LiveBackground } from "./live-background";
import { ProfileAvatarFrame } from "./animated-avatar-frame";
import { AchievementBadge } from "./achievement-visuals";
import { Nameplate } from "./nameplate";
import { ToggleSwitch } from "./toggle-switch";
import { useAnimationsPref } from "./use-animations-pref";
import {
  MiniBackgroundPreview,
  MiniBorderPreview,
  MiniNameplatePreview,
} from "./cosmetic-mini-preview";

type Cfg = GamificationEditorData["config"];

/* ── Swatch per tipe kosmetik ─────────────────────────────────────────────── */

function Swatch({ c, url }: { c: CosmeticOption; url: string | null }) {
  if (c.type === "PROFILE_BACKGROUND") {
    const effect = String(c.styleConfig.effect ?? "gradient");
    if (effect === "gradient") {
      const preset = isProfileBannerPreset(c.previewRef) ? c.previewRef : "twilight";
      return (
        <div
          className="h-12 w-full rounded-md"
          style={{ background: bannerGradientCss(preset) }}
        />
      );
    }
    if (effect === "image") {
      return url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-12 w-full rounded-md object-cover" />
      ) : (
        <div className="text-muted-foreground flex h-12 w-full items-center justify-center rounded-md border border-dashed border-border">
          <Upload className="size-4" aria-hidden />
        </div>
      );
    }
    // Earned animated background → live mini preview (down-fidelity aurora).
    const params: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.styleConfig)) {
      if (typeof v === "number") params[k] = v;
    }
    return (
      <MiniBackgroundPreview
        background={{ effect, palette: "theme", params }}
      />
    );
  }
  if (c.type === "AVATAR_BORDER") {
    const effect = String(c.styleConfig.effect ?? "static-frame");
    if (effect === "static-frame") {
      return (
        <div className="flex h-12 items-center justify-center">
          <span
            className="size-9 rounded-full border-2"
            style={{
              borderColor: "var(--chart-1)",
              background:
                "color-mix(in oklab, var(--chart-1) 12%, transparent)",
            }}
          />
        </div>
      );
    }
    // Earned animated border → live mini preview (cincin gradient ber-rotasi).
    return <MiniBorderPreview border={{ effect }} />;
  }
  if (c.type === "NAMEPLATE") {
    const effect = String(c.styleConfig.effect ?? "plain");
    return <MiniNameplatePreview effect={effect} />;
  }
  // TITLE / ACCENT — teks statis.
  return (
    <div className="flex h-12 items-center justify-center">
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
        {String(c.styleConfig.text ?? c.name)}
      </span>
    </div>
  );
}

/* ── Grid pilihan kosmetik ────────────────────────────────────────────────── */

function CosmeticGrid({
  items,
  selectedId,
  onSelect,
  uploadUrl,
}: {
  items: CosmeticOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  uploadUrl?: string | null;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada item.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((c) => {
        const selected = selectedId === c.id;
        const locked = c.locked;
        return (
          <button
            key={c.id}
            type="button"
            disabled={locked}
            onClick={() => onSelect(selected ? null : c.id)}
            title={locked ? c.requirement ?? "Terkunci" : c.name}
            className={cn(
              "group relative flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-all",
              selected
                ? "border-primary ring-2 ring-primary/30"
                : "border-border/70 hover:border-primary/40",
              locked && "cursor-not-allowed opacity-60",
            )}
          >
            <Swatch c={c} url={uploadUrl ?? null} />
            <span className="text-foreground truncate text-xs font-medium">
              {c.name}
            </span>
            {locked ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-background/60 backdrop-blur-[1px]">
                <Lock className="text-muted-foreground size-4" aria-hidden />
                <span className="text-muted-foreground px-1 text-center text-[10px] leading-tight">
                  {c.requirement}
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── Showcase sortable chip ───────────────────────────────────────────────── */

function SortableChip({
  id,
  label,
  onRemove,
}: {
  id: string;
  label: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border-border/70 bg-card flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-sm",
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className="text-muted-foreground cursor-grab touch-none"
        {...attributes}
        {...listeners}
        aria-label="Seret untuk mengurutkan"
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <span className="text-foreground max-w-32 truncate font-medium">{label}</span>
      <button type="button" onClick={onRemove} aria-label="Hapus dari showcase">
        <X className="text-muted-foreground hover:text-foreground size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/* ── Editor utama ─────────────────────────────────────────────────────────── */

export function GamificationEditor({
  data,
  legacy,
  avatarImageUrl,
  displayName,
  initialTagline = "",
  initialSticker = null,
}: {
  data: GamificationEditorData;
  legacy: { bannerPreset: string; avatarFrame: string; accentHex: string | null };
  avatarImageUrl: string | null;
  displayName: string;
  initialTagline?: string;
  initialSticker?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [animate, setAnimate] = useAnimationsPref();
  const fileRef = useRef<HTMLInputElement>(null);

  const [cfg, setCfg] = useState<Cfg>(data.config);
  const [tagline, setTagline] = useState(initialTagline);
  const [sticker, setSticker] = useState<string | null>(initialSticker);
  const [dirty, setDirty] = useState(false);

  const itemsById = new Map<string, CosmeticLite>(
    data.cosmetics.map((c) => [
      c.id,
      { key: c.key, type: c.type, previewRef: c.previewRef, styleConfig: c.styleConfig },
    ]),
  );
  const byType = (t: string) => data.cosmetics.filter((c) => c.type === t);
  const achById = new Map(data.achievements.map((a) => [a.id, a]));
  const unlockedAch = data.achievements.filter((a) => a.unlocked);

  const preview = resolveProfileCosmetics({
    config: cfg,
    itemsById,
    legacy,
  });

  function patch(next: Partial<Cfg>) {
    setCfg((c) => ({ ...c, ...next }));
    setDirty(true);
  }

  function onSave() {
    startTransition(async () => {
      try {
        await Promise.all([
          updateProfileConfig({
            equippedBackgroundId: cfg.equippedBackgroundId,
            equippedBorderId: cfg.equippedBorderId,
            equippedNameplateId: cfg.equippedNameplateId,
            equippedTitleId: cfg.equippedTitleId,
            accentColor: cfg.accentColor,
            customBorderColor: cfg.customBorderColor,
            showcaseAchievementIds: cfg.showcaseAchievementIds,
          }),
          updateProfileTaglineSticker({ tagline, sticker }),
        ]);
        toast.success("Profil disimpan.");
        setDirty(false);
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menyimpan."));
      }
    });
  }

  function onCancel() {
    setCfg(data.config);
    setTagline(initialTagline);
    setSticker(initialSticker);
    setDirty(false);
  }

  function onPickBackground(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("background", file);
    startUpload(async () => {
      try {
        await uploadCustomBackground(fd);
        toast.success("Latar diunggah & dipasang.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal mengunggah latar."));
      }
    });
  }

  function onClearBackground() {
    startUpload(async () => {
      try {
        await clearCustomBackground();
        toast.success("Latar unggahan dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus latar."));
      }
    });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = cfg.showcaseAchievementIds;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    patch({ showcaseAchievementIds: arrayMove(ids, from, to) });
  }

  const accent = preview.accentColor ?? "#888888";

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
      style={{ ["--profile-accent" as string]: accent }}
    >
      {/* ── LIVE PREVIEW ── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="border-border/70 relative overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="relative isolate h-32">
            <LiveBackground background={preview.background} animate={animate} />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
          <div className="relative -mt-10 flex flex-col items-center px-4 pb-5">
            <ProfileAvatarFrame border={preview.border} animate={animate}>
              <div className="relative size-20 overflow-hidden rounded-full border-[3px] border-background bg-muted">
                {avatarImageUrl ? (
                  <Image src={avatarImageUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
                ) : (
                  <div className="text-muted-foreground flex size-full items-center justify-center">
                    <User className="size-8" aria-hidden />
                  </div>
                )}
              </div>
            </ProfileAvatarFrame>
            <p className="text-foreground mt-2 text-base font-bold">
              {preview.nameplate ? (
                <Nameplate effect={preview.nameplate.effect} animate={animate}>
                  {displayName}
                </Nameplate>
              ) : (
                displayName
              )}
            </p>
            {preview.title ? (
              <span className="border-[color:var(--profile-accent)]/40 mt-1 rounded-full border bg-background/70 px-2 py-0.5 text-xs font-medium">
                {preview.title}
              </span>
            ) : null}
            <span className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-xs">
              <Sparkles className="size-3.5" style={{ color: "var(--chart-1)" }} aria-hidden />
              Level {data.level}
            </span>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Pratinjau langsung — animasi sungguhan sesuai yang kamu pilih.
        </p>
      </div>

      {/* ── EDITOR ── */}
      <div className="min-w-0">
        <Tabs defaultValue="tampilan">
          <TabsList>
            <TabsTrigger value="tampilan">Tampilan</TabsTrigger>
            <TabsTrigger value="showcase">Showcase</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          {/* TAB TAMPILAN */}
          <TabsContent value="tampilan" className="space-y-6 pt-4">
            <section>
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                Slogan & stiker
              </h3>
              <input
                type="text"
                value={tagline}
                maxLength={160}
                onChange={(e) => {
                  setTagline(e.target.value);
                  setDirty(true);
                }}
                placeholder="Slogan singkat di bawah nama (opsional)"
                className="border-border/70 focus-visible:ring-ring w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSticker(null);
                    setDirty(true);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs",
                    sticker === null
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-border/70 hover:border-primary/40",
                  )}
                >
                  Tanpa
                </button>
                {PROFILE_STICKER_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    title={PROFILE_STICKERS[id].label}
                    onClick={() => {
                      setSticker(id);
                      setDirty(true);
                    }}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border text-base",
                      sticker === id
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border/70 hover:border-primary/40",
                    )}
                  >
                    {PROFILE_STICKERS[id].emoji}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-foreground mb-2 text-sm font-semibold">Background</h3>
              <CosmeticGrid
                items={byType("PROFILE_BACKGROUND")}
                selectedId={cfg.equippedBackgroundId}
                onSelect={(id) => patch({ equippedBackgroundId: id })}
                uploadUrl={cfg.customBackgroundUrl}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => onPickBackground(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" /> Upload latar custom
                </Button>
                {cfg.customBackgroundUrl ? (
                  <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={onClearBackground}>
                    Hapus latar
                  </Button>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="text-foreground mb-2 text-sm font-semibold">Frame avatar</h3>
              <CosmeticGrid
                items={byType("AVATAR_BORDER")}
                selectedId={cfg.equippedBorderId}
                onSelect={(id) => patch({ equippedBorderId: id })}
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="text-muted-foreground text-xs">Warna border</label>
                <input
                  type="color"
                  value={cfg.customBorderColor ?? "#888888"}
                  onChange={(e) => patch({ customBorderColor: e.target.value })}
                  className="size-7 cursor-pointer rounded border border-border bg-transparent"
                  aria-label="Warna border kustom"
                />
              </div>
            </section>

            <section>
              <h3 className="text-foreground mb-2 text-sm font-semibold">Nameplate</h3>
              <CosmeticGrid
                items={byType("NAMEPLATE")}
                selectedId={cfg.equippedNameplateId}
                onSelect={(id) => patch({ equippedNameplateId: id })}
              />
            </section>

            <section>
              <h3 className="text-foreground mb-2 text-sm font-semibold">Gelar (Title)</h3>
              <CosmeticGrid
                items={byType("TITLE")}
                selectedId={cfg.equippedTitleId}
                onSelect={(id) => patch({ equippedTitleId: id })}
              />
            </section>

            <section className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-foreground text-sm font-medium">Accent</label>
                <input
                  type="color"
                  value={cfg.accentColor ?? "#888888"}
                  onChange={(e) => patch({ accentColor: e.target.value })}
                  className="size-7 cursor-pointer rounded border border-border bg-transparent"
                  aria-label="Warna aksen"
                />
                {cfg.accentColor ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => patch({ accentColor: null })}>
                    Default tema
                  </Button>
                ) : null}
              </div>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <span className="text-foreground font-medium">Animasi</span>
                <ToggleSwitch
                  checked={animate}
                  onChange={setAnimate}
                  label="Animasi profil"
                />
              </div>
            </section>
          </TabsContent>

          {/* TAB SHOWCASE */}
          <TabsContent value="showcase" className="space-y-4 pt-4">
            <p className="text-muted-foreground text-sm">
              Pilih pencapaian yang tampil di profil (maks {data.showcaseSlots} slot,
              bertambah seiring level). Seret untuk mengurutkan.
            </p>
            {cfg.showcaseAchievementIds.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={cfg.showcaseAchievementIds}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap gap-2">
                    {cfg.showcaseAchievementIds.map((id) => (
                      <SortableChip
                        key={id}
                        id={id}
                        label={achById.get(id)?.name ?? "?"}
                        onRemove={() =>
                          patch({
                            showcaseAchievementIds: cfg.showcaseAchievementIds.filter(
                              (x) => x !== id,
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-muted-foreground text-sm italic">Belum ada item terpilih.</p>
            )}

            <div>
              <h4 className="text-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                Tersedia
              </h4>
              <div className="flex flex-wrap gap-2">
                {unlockedAch
                  .filter((a) => !cfg.showcaseAchievementIds.includes(a.id))
                  .map((a) => {
                    const full = cfg.showcaseAchievementIds.length >= data.showcaseSlots;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={full}
                        onClick={() =>
                          patch({
                            showcaseAchievementIds: [...cfg.showcaseAchievementIds, a.id],
                          })
                        }
                        className={cn(
                          "border-border/70 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          full
                            ? "cursor-not-allowed opacity-50"
                            : "hover:border-primary/50 hover:bg-muted/40",
                        )}
                        title={full ? "Slot penuh" : `Tambah ${a.name}`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                {unlockedAch.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">
                    Buka achievement dulu untuk mengisi showcase.
                  </p>
                ) : null}
              </div>
            </div>
          </TabsContent>

          {/* TAB ACHIEVEMENTS */}
          <TabsContent value="achievements" className="pt-4" id="achievements">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {data.achievements.map((a) => (
                <AchievementBadge key={a.key} ach={a} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* SAVE BAR */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
          {dirty ? (
            <span className="text-muted-foreground mr-auto text-xs">
              Ada perubahan belum disimpan
            </span>
          ) : null}
          <Button type="button" variant="ghost" disabled={pending || !dirty} onClick={onCancel}>
            Batal
          </Button>
          <Button type="button" disabled={pending || !dirty} onClick={onSave}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
