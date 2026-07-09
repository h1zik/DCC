"use client";

/**
 * Editor gamifikasi profil: kiri = live preview kartu profil (render animasi
 * kosmetik SUNGGUHAN via runtime yang sama dgn halaman view), kanan = editor
 * bertab (Tampilan / Showcase / Achievements). Perubahan equip di-stage lalu
 * Simpan/Batal eksplisit; server RE-VALIDASI kepemilikan (equip hanya yang berhak).
 */
import { useEffect, useState, useTransition } from "react";
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
import {
  Award,
  GripVertical,
  Layers,
  Lock,
  Sparkles,
  Trophy,
  User,
  X,
} from "lucide-react";
import {
  resolveProfileCosmetics,
  type CosmeticLite,
} from "@/lib/gamification/cosmetics";
import type {
  CosmeticOption,
  GamificationEditorData,
} from "@/lib/gamification/editor-data";
import { updateProfileConfig } from "@/actions/gamification";
import { updateProfileTaglineSticker } from "@/actions/profile";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  THEMED_BANNER_GRADIENT,
  bannerGradientCss,
  isProfileBannerPreset,
  PROFILE_STICKERS,
  PROFILE_STICKER_IDS,
} from "@/lib/profile-appearance";
import {
  EditGroup,
  EditStickyBar,
} from "@/components/profile/edit/edit-ui";
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
  backgroundFromStyleConfig,
  borderFromStyleConfig,
} from "./cosmetic-mini-preview";

const THEMED_BASE = THEMED_BANNER_GRADIENT;

type Cfg = GamificationEditorData["config"];

/**
 * Label ringkas untuk kartu kosmetik. Nama katalog panjang (mis. "Nameplate
 * Molten", 'Gelar "Level 10"') terpotong di sel grid sempit — di dalam grup yang
 * sudah berjudul (Nameplate / Gelar) prefiks itu mubazir. Nama asli tetap
 * dipakai untuk tooltip.
 */
function cosmeticLabel(c: CosmeticOption): string {
  if (c.type === "TITLE") {
    const m = /^Gelar\s+["“](.+)["”]$/.exec(c.name);
    return m ? m[1]! : c.name;
  }
  if (c.type === "NAMEPLATE") {
    return c.name.replace(/^Nameplate\s+/i, "");
  }
  return c.name;
}

/* ── Swatch per tipe kosmetik ─────────────────────────────────────────────── */

function Swatch({ c }: { c: CosmeticOption }) {
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
    const bgDesc = backgroundFromStyleConfig(c.styleConfig);
    if (bgDesc) {
      return <MiniBackgroundPreview background={bgDesc} />;
    }
    return (
      <div
        className="relative h-12 w-full overflow-hidden rounded-md"
        style={{ background: THEMED_BASE }}
      >
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/90">
          ✦ animasi
        </span>
      </div>
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
    // Earned animated border → live mini preview.
    const borderDesc = borderFromStyleConfig(c.styleConfig);
    if (borderDesc) {
      return <MiniBorderPreview border={borderDesc} />;
    }
  }
  if (c.type === "NAMEPLATE") {
    const effect = String(c.styleConfig.effect ?? "plain");
    return <MiniNameplatePreview effect={effect} />;
  }
  if (c.type === "TITLE") {
    // Chip aksen ala pratinjau — bukan teks abu polos.
    return (
      <div className="flex h-12 items-center justify-center px-1">
        <span className="max-w-full truncate rounded-full border border-[color:var(--profile-accent)]/40 bg-[color:var(--profile-accent)]/10 px-2.5 py-1 text-[11px] font-medium text-foreground">
          {String(c.styleConfig.text ?? cosmeticLabel(c))}
        </span>
      </div>
    );
  }
  // ACCENT / lainnya — teks statis.
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
  gridClassName = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
}: {
  items: CosmeticOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Override kolom grid (mis. seksi sempit side-by-side). */
  gridClassName?: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada item.</p>;
  }
  return (
    <div className={cn("grid gap-2", gridClassName)}>
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
              "group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all",
              selected
                ? "border-primary ring-2 ring-primary/25 shadow-sm"
                : "border-border/60 hover:border-primary/35 hover:shadow-sm",
              locked && "cursor-not-allowed",
            )}
          >
            <div
              className={cn(
                "bg-muted/30 relative p-2",
                locked && "opacity-70 grayscale-[0.35]",
              )}
            >
              <Swatch c={c} />
            </div>
            <div className="border-border/40 flex min-h-[2.5rem] flex-1 items-center border-t px-2 py-1.5">
              <span className="text-foreground line-clamp-2 text-[11px] font-medium leading-tight">
                {cosmeticLabel(c)}
              </span>
            </div>
            {locked ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background/55 p-2 backdrop-blur-[2px]">
                <Lock className="text-muted-foreground size-4" aria-hidden />
                <span className="text-muted-foreground text-center text-[10px] leading-snug">
                  {c.requirement}
                </span>
              </span>
            ) : null}
            {selected && !locked ? (
              <span
                className="bg-primary absolute right-1.5 top-1.5 size-2 rounded-full shadow-sm"
                aria-hidden
              />
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
  const [animate, setAnimate] = useAnimationsPref();

  const [cfg, setCfg] = useState<Cfg>(data.config);
  const [tagline, setTagline] = useState(initialTagline);
  const [sticker, setSticker] = useState<string | null>(initialSticker);
  const [dirty, setDirty] = useState(false);
  const [editorTab, setEditorTab] = useState("tampilan");

  useEffect(() => {
    if (window.location.hash.replace("#", "") === "achievements") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hash deep-link
      setEditorTab("achievements");
    }
  }, []);

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
  const unlockedCount = data.achievements.filter((a) => a.unlocked).length;

  return (
    <div
      className="border-border/60 bg-card/80 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm"
      style={{ ["--profile-accent" as string]: accent }}
    >
      <div className="grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:divide-x lg:divide-border/50">
        {/* ── LIVE PREVIEW ── */}
        <aside className="border-border/50 border-b bg-muted/20 p-5 lg:border-b-0 lg:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-foreground text-xs font-semibold uppercase tracking-wider">
              Pratinjau langsung
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[11px]">Animasi</span>
              <ToggleSwitch
                checked={animate}
                onChange={setAnimate}
                label="Animasi profil"
              />
            </div>
          </div>

          <div className="border-border/70 relative overflow-hidden rounded-2xl border bg-card shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="relative isolate aspect-[31/10] min-h-40 overflow-hidden">
              <LiveBackground background={preview.background} animate={animate} />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="relative -mt-12 flex flex-col items-center px-4 pb-5 pt-0">
              <ProfileAvatarFrame border={preview.border} animate={animate}>
                <div className="relative size-[4.5rem] overflow-hidden rounded-full border-[3px] border-background bg-muted shadow-lg sm:size-20">
                  {avatarImageUrl ? (
                    <Image
                      src={avatarImageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center">
                      <User className="size-8" aria-hidden />
                    </div>
                  )}
                </div>
              </ProfileAvatarFrame>
              <p className="text-foreground mt-2.5 text-center text-base font-bold leading-tight">
                {preview.nameplate ? (
                  <Nameplate effect={preview.nameplate.effect} animate={animate}>
                    {displayName}
                  </Nameplate>
                ) : (
                  displayName
                )}
              </p>
              {tagline.trim() ? (
                <p className="text-muted-foreground mt-1 line-clamp-2 max-w-[220px] text-center text-xs">
                  {tagline.trim()}
                </p>
              ) : null}
              {preview.title ? (
                <span className="border-[color:var(--profile-accent)]/40 mt-1.5 rounded-full border bg-background/80 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm">
                  {preview.title}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="border-border/50 bg-background/60 rounded-xl border px-3 py-2.5">
              <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                Level
              </p>
              <p className="text-foreground mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums">
                <Sparkles className="size-3.5 text-[var(--chart-1)]" aria-hidden />
                {data.level}
              </p>
            </div>
            <div className="border-border/50 bg-background/60 rounded-xl border px-3 py-2.5">
              <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                Achievement
              </p>
              <p className="text-foreground mt-0.5 text-sm font-semibold tabular-nums">
                {unlockedCount}
                <span className="text-muted-foreground font-normal">
                  /{data.achievements.length}
                </span>
              </p>
            </div>
          </div>
        </aside>

        {/* ── EDITOR ── */}
        <div className="relative min-w-0">
          <Tabs value={editorTab} onValueChange={setEditorTab} className="gap-0">
            <div className="border-border/50 border-b p-3 sm:px-6 sm:py-4">
              {/* h-auto HARUS pakai modifier yang sama dgn base (group-data-horizontal
                  /tabs:h-8) — kalau tidak, tailwind-merge tak bisa menimpanya dan
                  konten py-2 meluber dari track 32px (thumb aktif jadi terpotong). */}
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/70 p-1 group-data-horizontal/tabs:h-auto">
                <TabsTrigger
                  value="tampilan"
                  className="h-auto min-w-0 gap-1.5 rounded-lg px-2 py-2 text-xs font-medium sm:text-sm"
                >
                  <Layers className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">Tampilan</span>
                </TabsTrigger>
                <TabsTrigger
                  value="showcase"
                  className="h-auto min-w-0 gap-1.5 rounded-lg px-2 py-2 text-xs font-medium sm:text-sm"
                >
                  <Trophy className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">Showcase</span>
                </TabsTrigger>
                <TabsTrigger
                  value="achievements"
                  className="h-auto min-w-0 gap-1.5 rounded-lg px-2 py-2 text-xs font-medium sm:text-sm"
                >
                  <Award className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">Achievement</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="px-4 py-5 sm:px-6">
              <TabsContent value="tampilan" className="mt-0 space-y-8">
                <EditGroup
                  title="Slogan & stiker"
                  description="Teks singkat dan emoji flair di samping nama."
                >
                  <input
                    type="text"
                    value={tagline}
                    maxLength={160}
                    onChange={(e) => {
                      setTagline(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Misalnya: Always on time, always curious"
                    className="border-border/70 focus-visible:ring-ring w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSticker(null);
                        setDirty(true);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        sticker === null
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      Tanpa stiker
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
                          "flex size-9 items-center justify-center rounded-lg border text-base transition-colors",
                          sticker === id
                            ? "border-primary bg-primary/5"
                            : "border-border/70 hover:border-primary/40",
                        )}
                      >
                        {PROFILE_STICKERS[id].emoji}
                      </button>
                    ))}
                  </div>
                </EditGroup>

                <EditGroup
                  title="Background"
                  description="Pilih dari katalog. Background baru terbuka seiring naik level atau meraih achievement."
                >
                  <CosmeticGrid
                    items={byType("PROFILE_BACKGROUND")}
                    selectedId={cfg.equippedBackgroundId}
                    onSelect={(id) => patch({ equippedBackgroundId: id })}
                  />
                </EditGroup>

                <EditGroup title="Frame avatar" description="Bingkai di sekitar foto profil.">
                  <CosmeticGrid
                    items={byType("AVATAR_BORDER")}
                    selectedId={cfg.equippedBorderId}
                    onSelect={(id) => patch({ equippedBorderId: id })}
                  />
                  <div className="border-border/50 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2.5">
                    <input
                      type="color"
                      value={cfg.customBorderColor ?? "#888888"}
                      onChange={(e) => patch({ customBorderColor: e.target.value })}
                      className="size-8 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent"
                      aria-label="Warna border kustom"
                    />
                    <div className="min-w-0">
                      <p className="text-foreground text-xs font-medium">
                        Warna kustom
                      </p>
                      <p className="text-muted-foreground text-[11px] leading-tight">
                        Untuk frame “Warna Border Kustom”.
                      </p>
                    </div>
                  </div>
                </EditGroup>

                <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
                  <EditGroup title="Nameplate" description="Banner di belakang nama.">
                    <CosmeticGrid
                      items={byType("NAMEPLATE")}
                      selectedId={cfg.equippedNameplateId}
                      onSelect={(id) => patch({ equippedNameplateId: id })}
                      gridClassName="grid-cols-2"
                    />
                  </EditGroup>
                  <EditGroup title="Gelar" description="Title di bawah identitas.">
                    <CosmeticGrid
                      items={byType("TITLE")}
                      selectedId={cfg.equippedTitleId}
                      onSelect={(id) => patch({ equippedTitleId: id })}
                      gridClassName="grid-cols-2"
                    />
                  </EditGroup>
                </div>

                <EditGroup title="Warna aksen" description="Menyelaraskan highlight profil dengan tema.">
                  <div className="border-border/50 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2.5">
                    <input
                      type="color"
                      value={cfg.accentColor ?? "#888888"}
                      onChange={(e) => patch({ accentColor: e.target.value })}
                      className="size-8 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent"
                      aria-label="Warna aksen"
                    />
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                      {cfg.accentColor
                        ? `Aksen kustom · ${cfg.accentColor.toUpperCase()}`
                        : "Mengikuti tema aktif"}
                    </span>
                    {cfg.accentColor ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto shrink-0"
                        onClick={() => patch({ accentColor: null })}
                      >
                        Reset ke tema
                      </Button>
                    ) : null}
                  </div>
                </EditGroup>
              </TabsContent>

              <TabsContent value="showcase" className="mt-0 space-y-5">
                <EditGroup
                  title="Pilih pencapaian"
                  description={`Maks. ${data.showcaseSlots} slot — bertambah tiap 5 level. Seret untuk mengurutkan.`}
                >
                  {cfg.showcaseAchievementIds.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={onDragEnd}
                    >
                      <SortableContext
                        items={cfg.showcaseAchievementIds}
                        strategy={horizontalListSortingStrategy}
                      >
                        <div className="flex min-h-10 flex-wrap gap-2">
                          {cfg.showcaseAchievementIds.map((id) => (
                            <SortableChip
                              key={id}
                              id={id}
                              label={achById.get(id)?.name ?? "?"}
                              onRemove={() =>
                                patch({
                                  showcaseAchievementIds:
                                    cfg.showcaseAchievementIds.filter(
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
                    <p className="text-muted-foreground rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm">
                      Belum ada achievement di showcase. Tambahkan dari daftar
                      di bawah.
                    </p>
                  )}

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Tersedia ({unlockedAch.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {unlockedAch
                        .filter((a) => !cfg.showcaseAchievementIds.includes(a.id))
                        .map((a) => {
                          const full =
                            cfg.showcaseAchievementIds.length >= data.showcaseSlots;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              disabled={full}
                              onClick={() =>
                                patch({
                                  showcaseAchievementIds: [
                                    ...cfg.showcaseAchievementIds,
                                    a.id,
                                  ],
                                })
                              }
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                full
                                  ? "cursor-not-allowed opacity-40"
                                  : "border-border/70 hover:border-primary/50 hover:bg-primary/5",
                              )}
                              title={full ? "Slot penuh" : `Tambah ${a.name}`}
                            >
                              + {a.name}
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
                </EditGroup>
              </TabsContent>

              <TabsContent value="achievements" className="mt-0" id="achievements">
                <EditGroup
                  title="Galeri achievement"
                  description={`${unlockedCount} dari ${data.achievements.length} terbuka.`}
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {data.achievements.map((a) => (
                      <AchievementBadge key={a.key} ach={a} />
                    ))}
                  </div>
                </EditGroup>
              </TabsContent>

              <EditStickyBar
                dirty={dirty}
                pending={pending}
                onSave={onSave}
                onCancel={onCancel}
              />
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
