"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContentPlanFeedVisibility, ContentPlanJenis } from "@prisma/client";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  clearContentPlanFeedAvatar,
  clearContentPlanFeedCover,
  reorderContentPlanFeed,
  resetContentPlanFeedOrder,
  saveContentPlanFeedProfile,
  setContentPlanFeedCoverIndex,
  setContentPlanFeedVisibility,
  uploadContentPlanFeedAvatar,
  uploadContentPlanFeedCover,
  type ContentPlanFeedProfileInput,
} from "@/actions/content-plan-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  contentPlanFeedCoverPath,
  isContentPlanImagePath,
  isContentPlanVideoPath,
  JENIS_LABEL,
} from "@/lib/content-plan-ui";
import {
  contentPlanFeedExclusionReason,
  contentPlanFeedIsPublished,
  contentPlanFeedPostingTime,
  FEED_EXCLUSION_LABEL,
  mergeContentPlanFeedOrder,
  type FeedExclusionReason,
} from "@/lib/content-plan-feed-order";
import type { ContentPlanTableRow } from "./content-planning-client";
import {
  BadgeCheck,
  ChevronDown,
  Clapperboard,
  Eye,
  EyeOff,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  Menu,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  SquareUser,
  Trash2,
  Upload,
  UserPlus,
  Wand2,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tipe & util                                                          */
/* ------------------------------------------------------------------ */

/** Profil feed yang tersimpan di DB (null bila ruangan belum pernah menyesuaikan). */
export type ContentPlanFeedProfileData = {
  username: string;
  displayName: string;
  bio: string;
  avatarPath: string | null;
  followersLabel: string;
  followingLabel: string;
  includeArchived: boolean;
  instagramOnly: boolean;
  includeUndated: boolean;
};

/** Nilai awal bila profil belum pernah disimpan — diturunkan dari brand/ruangan. */
export type ContentPlanFeedDefaults = {
  username: string;
  displayName: string;
  avatarPath: string | null;
};

export type ContentPlanFeedRowPatch = {
  id: string;
  patch: Partial<ContentPlanTableRow>;
};

const DEFAULT_FOLLOWERS = "12,4K";
const DEFAULT_FOLLOWING = "180";

/** Bentuk username ala Instagram dari nama brand/ruangan. */
export function slugifyFeedUsername(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._]/g, "")
      .slice(0, 30) || "brandaccount"
  );
}

function resolveProfile(
  profile: ContentPlanFeedProfileData | null,
  defaults: ContentPlanFeedDefaults,
): ContentPlanFeedProfileData {
  return {
    username: profile?.username?.trim() || slugifyFeedUsername(defaults.username),
    displayName: profile?.displayName?.trim() || defaults.displayName,
    bio: profile?.bio ?? "",
    avatarPath: profile?.avatarPath ?? null,
    followersLabel: profile?.followersLabel?.trim() || DEFAULT_FOLLOWERS,
    followingLabel: profile?.followingLabel?.trim() || DEFAULT_FOLLOWING,
    includeArchived: profile?.includeArchived ?? true,
    instagramOnly: profile?.instagramOnly ?? true,
    includeUndated: profile?.includeUndated ?? true,
  };
}

const MONTH_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function feedDateLabel(row: ContentPlanTableRow): string {
  const v = row.tanggalPosting;
  const d = v ? (typeof v === "string" ? new Date(v) : v) : null;
  if (!d || Number.isNaN(d.getTime())) return "Tanpa tgl";
  return `${d.getDate()} ${MONTH_SHORT_ID[d.getMonth()] ?? ""}`;
}

function rowTitle(row: ContentPlanTableRow): string {
  return row.konten?.trim() || JENIS_LABEL[row.jenisKonten];
}

/** Warna placeholder tile bila belum ada file design — beda per jenis konten. */
const PLACEHOLDER_CLASS: Record<ContentPlanJenis, string> = {
  [ContentPlanJenis.REELS]:
    "from-fuchsia-500/25 via-violet-500/15 to-transparent text-fuchsia-900 dark:text-fuchsia-100",
  [ContentPlanJenis.CAROUSEL]:
    "from-sky-500/25 via-cyan-500/15 to-transparent text-sky-900 dark:text-sky-100",
  [ContentPlanJenis.SINGLE_FEED]:
    "from-amber-500/25 via-orange-500/15 to-transparent text-amber-900 dark:text-amber-100",
};

/* ------------------------------------------------------------------ */
/* Media tile                                                           */
/* ------------------------------------------------------------------ */

function FeedCoverMedia({
  path,
  alt,
  sizes,
}: {
  path: string;
  alt: string;
  sizes?: string;
}) {
  if (isContentPlanImagePath(path)) {
    return (
      <Image
        src={path}
        alt={alt}
        fill
        sizes={sizes ?? "140px"}
        className="object-cover"
        unoptimized
      />
    );
  }
  if (isContentPlanVideoPath(path)) {
    return (
      <video
        src={path}
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        aria-label={alt}
      />
    );
  }
  return (
    <div className="bg-muted text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
      <ImageIcon className="size-5 opacity-60" aria-hidden />
      <span className="text-[9px] leading-tight">File non-gambar</span>
    </div>
  );
}

function FeedAvatar({
  path,
  fallback,
  className,
}: {
  path: string | null;
  fallback: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      {path ? (
        <Image
          src={path}
          alt="Avatar profil"
          fill
          sizes="96px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xl font-semibold">
          {fallback.slice(0, 1).toUpperCase() || "B"}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tile grid                                                            */
/* ------------------------------------------------------------------ */

type TileActions = {
  onPreview: (row: ContentPlanTableRow) => void;
  onEdit: (row: ContentPlanTableRow) => void;
  onPickCover: (row: ContentPlanTableRow) => void;
  onSetVisibility: (row: ContentPlanTableRow, v: ContentPlanFeedVisibility) => void;
};

function FeedTile({
  row,
  reelsAspect,
  dragging,
  onPreview,
  onEdit,
  onPickCover,
  onSetVisibility,
}: TileActions & {
  row: ContentPlanTableRow;
  reelsAspect: boolean;
  dragging?: boolean;
}) {
  const cover = contentPlanFeedCoverPath(row);
  const canPreview = (row.designFilePaths?.length ?? 0) > 0;
  const published = contentPlanFeedIsPublished(row);
  const title = rowTitle(row);
  const pinned = row.feedVisibility === ContentPlanFeedVisibility.SHOWN;

  return (
    <div
      className={cn(
        "group bg-background relative overflow-hidden",
        reelsAspect ? "aspect-[9/16]" : "aspect-[3/4]",
        dragging && "ring-primary ring-2 ring-inset",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 block h-full w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        aria-label={`${title}${canPreview ? " — buka preview" : " — edit baris"}`}
        onClick={() => (canPreview ? onPreview(row) : onEdit(row))}
      >
        {cover ? (
          <FeedCoverMedia path={cover} alt={title} />
        ) : (
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end bg-gradient-to-br p-1.5",
              PLACEHOLDER_CLASS[row.jenisKonten],
            )}
          >
            <span className="line-clamp-3 text-[10px] leading-tight font-medium">
              {title}
            </span>
            <span className="mt-0.5 text-[8px] opacity-70">Belum ada design</span>
          </div>
        )}
      </button>

      {/* Ikon jenis, pojok kanan atas — seperti Instagram */}
      {row.jenisKonten === ContentPlanJenis.CAROUSEL ? (
        <Layers
          className="pointer-events-none absolute top-1.5 right-1.5 size-3.5 text-white drop-shadow-md"
          aria-label="Carousel"
        />
      ) : row.jenisKonten === ContentPlanJenis.REELS ? (
        <Clapperboard
          className="pointer-events-none absolute top-1.5 right-1.5 size-3.5 text-white drop-shadow-md"
          aria-label="Reels"
        />
      ) : null}

      {/* Chip jadwal untuk konten yang belum tayang */}
      {!published ? (
        <span
          className={cn(
            "pointer-events-none absolute bottom-1 left-1 rounded px-1 py-px text-[8px] font-semibold tabular-nums text-white",
            row.tanggalPosting ? "bg-black/60" : "bg-amber-600/90",
          )}
        >
          {feedDateLabel(row)}
        </span>
      ) : null}

      {/* Penanda "selalu tampil" (mengabaikan aturan otomatis) */}
      {pinned ? (
        <Pin
          className="pointer-events-none absolute top-1.5 left-1.5 size-3 text-white drop-shadow-md group-hover:opacity-0"
          aria-label="Selalu tampil di feed"
        />
      ) : null}

      {/* Hapus dari feed — muncul saat hover */}
      <button
        type="button"
        className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive focus-visible:opacity-100"
        aria-label={`Hapus "${title}" dari feed`}
        title="Hapus dari feed"
        onClick={(e) => {
          e.stopPropagation();
          onSetVisibility(row, ContentPlanFeedVisibility.HIDDEN);
        }}
      >
        <X className="size-3" />
      </button>

      {/* Menu aksi tile */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
          aria-label={`Aksi untuk ${title}`}
        >
          <MoreHorizontal className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="text-muted-foreground truncate px-2 py-1 text-[11px]">{title}</div>
          <DropdownMenuSeparator />
          {canPreview ? (
            <DropdownMenuItem onClick={() => onPreview(row)}>
              <Eye className="size-4" />
              Preview
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <Pencil className="size-4" />
            Edit baris
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPickCover(row)}>
            <ImageIcon className="size-4" />
            Atur cover
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {row.feedVisibility === ContentPlanFeedVisibility.AUTO ? (
            <DropdownMenuItem
              onClick={() => onSetVisibility(row, ContentPlanFeedVisibility.SHOWN)}
            >
              <Pin className="size-4" />
              Selalu tampilkan
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onSetVisibility(row, ContentPlanFeedVisibility.AUTO)}
            >
              <Wand2 className="size-4" />
              Ikuti aturan otomatis
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onSetVisibility(row, ContentPlanFeedVisibility.HIDDEN)}
          >
            <EyeOff className="size-4" />
            Hapus dari feed
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Pembungkus sortable: seluruh tile jadi pegangan drag (klik tetap jalan berkat jarak aktivasi). */
function SortableFeedTile({
  row,
  disabled,
  ...actions
}: TileActions & { row: ContentPlanTableRow; disabled: boolean }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { zIndex: 30, position: "relative" as const } : null),
      }}
      className={cn(!disabled && "touch-none", isDragging && "opacity-90 shadow-xl")}
      {...listeners}
    >
      <FeedTile row={row} reelsAspect={false} dragging={isDragging} {...actions} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog cover                                                         */
/* ------------------------------------------------------------------ */

function FeedCoverDialog({
  roomId,
  row,
  onClose,
  onRowPatched,
}: {
  roomId: string;
  row: ContentPlanTableRow | null;
  onClose: () => void;
  onRowPatched: (rowId: string, patch: Partial<ContentPlanTableRow>) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const slides = row?.designFilePaths ?? [];
  const hasCustom = Boolean(row?.feedCoverPath?.trim());
  const activeIndex =
    row && slides.length > 0
      ? Math.max(0, Math.min(row.feedCoverIndex ?? 0, slides.length - 1))
      : 0;

  return (
    <Dialog
      open={row !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cover di grid feed</DialogTitle>
          <DialogDescription>
            Pilih slide design yang tampil sebagai thumbnail, atau unggah gambar cover
            khusus (mis. thumbnail reels).
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="space-y-4">
            {slides.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium">Dari slide design</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {slides.map((p, i) => {
                    const active = !hasCustom && i === activeIndex;
                    return (
                      <button
                        key={`${p}-${i}`}
                        type="button"
                        disabled={pending}
                        className={cn(
                          "relative aspect-[3/4] overflow-hidden rounded-md border transition-all",
                          active
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border hover:border-foreground/40",
                        )}
                        aria-pressed={active}
                        aria-label={`Pakai slide ${i + 1} sebagai cover`}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await setContentPlanFeedCoverIndex(roomId, row.id, i);
                              onRowPatched(row.id, { feedCoverIndex: i, feedCoverPath: null });
                              toast.success(`Cover: slide ${i + 1}.`);
                              router.refresh();
                            } catch (e) {
                              toast.error(actionErrorMessage(e, "Gagal mengatur cover."));
                            }
                          });
                        }}
                      >
                        <FeedCoverMedia path={p} alt={`Slide ${i + 1}`} />
                        <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">
                          {i + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Baris ini belum punya file design. Unggah cover khusus di bawah supaya
                tile-nya tidak kosong di simulasi.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium">Cover khusus</p>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={cn(
                    "relative aspect-[3/4] w-20 overflow-hidden rounded-md border",
                    hasCustom ? "border-primary ring-2 ring-primary/40" : "border-dashed",
                  )}
                >
                  {hasCustom && row.feedCoverPath ? (
                    <FeedCoverMedia path={row.feedCoverPath} alt="Cover khusus" />
                  ) : (
                    <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                      <ImageIcon className="size-5 opacity-60" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("file", file);
                      startTransition(async () => {
                        try {
                          const res = await uploadContentPlanFeedCover(roomId, row.id, fd);
                          onRowPatched(row.id, { feedCoverPath: res.feedCoverPath });
                          toast.success("Cover khusus dipakai.");
                          router.refresh();
                        } catch (err) {
                          toast.error(actionErrorMessage(err, "Gagal mengunggah cover."));
                        }
                      });
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    {hasCustom ? "Ganti cover khusus" : "Unggah cover khusus"}
                  </Button>
                  {hasCustom ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      className="text-destructive justify-start"
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await clearContentPlanFeedCover(roomId, row.id);
                            onRowPatched(row.id, { feedCoverPath: null });
                            toast.success("Cover khusus dihapus.");
                            router.refresh();
                          } catch (err) {
                            toast.error(actionErrorMessage(err, "Gagal menghapus cover."));
                          }
                        });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Hapus cover khusus
                    </Button>
                  ) : null}
                  <p className="text-muted-foreground text-[11px]">
                    Gambar saja, maksimal 20 MB. Disarankan rasio 3:4.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Panel kustomisasi                                                    */
/* ------------------------------------------------------------------ */

function FeedProfileForm({
  roomId,
  profile,
  defaults,
  onProfileChange,
}: {
  roomId: string;
  profile: ContentPlanFeedProfileData;
  defaults: ContentPlanFeedDefaults;
  onProfileChange: (next: ContentPlanFeedProfileData) => void;
}) {
  const router = useRouter();
  const avatarRef = useRef<HTMLInputElement>(null);
  const [savePending, startSave] = useTransition();
  const [avatarPending, startAvatar] = useTransition();

  const [draft, setDraft] = useState({
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    followersLabel: profile.followersLabel,
    followingLabel: profile.followingLabel,
  });

  const dirty =
    draft.username !== profile.username ||
    draft.displayName !== profile.displayName ||
    draft.bio !== profile.bio ||
    draft.followersLabel !== profile.followersLabel ||
    draft.followingLabel !== profile.followingLabel;

  const effectiveAvatar = profile.avatarPath ?? defaults.avatarPath;

  const saveDraft = () => {
    const input: ContentPlanFeedProfileInput = {
      username: draft.username.trim(),
      displayName: draft.displayName.trim(),
      bio: draft.bio.trim(),
      followersLabel: draft.followersLabel.trim() || DEFAULT_FOLLOWERS,
      followingLabel: draft.followingLabel.trim() || DEFAULT_FOLLOWING,
    };
    startSave(async () => {
      try {
        await saveContentPlanFeedProfile(roomId, input);
        const next: ContentPlanFeedProfileData = {
          ...profile,
          username: input.username || slugifyFeedUsername(defaults.username),
          displayName: input.displayName || defaults.displayName,
          bio: input.bio ?? "",
          followersLabel: input.followersLabel ?? DEFAULT_FOLLOWERS,
          followingLabel: input.followingLabel ?? DEFAULT_FOLLOWING,
        };
        onProfileChange(next);
        setDraft({
          username: next.username,
          displayName: next.displayName,
          bio: next.bio,
          followersLabel: next.followersLabel,
          followingLabel: next.followingLabel,
        });
        toast.success("Profil feed disimpan.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menyimpan profil feed."));
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <FeedAvatar
          path={effectiveAvatar}
          fallback={draft.displayName || draft.username}
          className="size-14"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              startAvatar(async () => {
                try {
                  const res = await uploadContentPlanFeedAvatar(roomId, fd);
                  onProfileChange({ ...profile, avatarPath: res.avatarPath });
                  toast.success("Avatar diperbarui.");
                  router.refresh();
                } catch (err) {
                  toast.error(actionErrorMessage(err, "Gagal mengunggah avatar."));
                }
              });
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={avatarPending}
              onClick={() => avatarRef.current?.click()}
            >
              <Upload className="size-3" />
              {avatarPending ? "Mengunggah…" : "Ganti avatar"}
            </Button>
            {profile.avatarPath ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={avatarPending}
                onClick={() => {
                  startAvatar(async () => {
                    try {
                      await clearContentPlanFeedAvatar(roomId);
                      onProfileChange({ ...profile, avatarPath: null });
                      toast.success("Avatar kembali ke logo ruangan.");
                      router.refresh();
                    } catch (err) {
                      toast.error(actionErrorMessage(err, "Gagal menghapus avatar."));
                    }
                  });
                }}
              >
                <RotateCcw className="size-3" />
                Pakai logo
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-[11px]">
            {profile.avatarPath
              ? "Avatar khusus simulasi."
              : defaults.avatarPath
                ? "Memakai logo ruangan/brand."
                : "Belum ada avatar — memakai inisial."}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="grid gap-1">
          <Label htmlFor="cp-feed-username" className="text-xs">
            Username
          </Label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs">
              @
            </span>
            <Input
              id="cp-feed-username"
              value={draft.username}
              onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
              className="h-8 pl-6 text-xs"
              maxLength={60}
              placeholder={slugifyFeedUsername(defaults.username)}
            />
          </div>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="cp-feed-name" className="text-xs">
            Nama tampilan
          </Label>
          <Input
            id="cp-feed-name"
            value={draft.displayName}
            onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
            className="h-8 text-xs"
            maxLength={80}
            placeholder={defaults.displayName}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="cp-feed-bio" className="text-xs">
            Bio
          </Label>
          <Textarea
            id="cp-feed-bio"
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            className="min-h-16 text-xs"
            maxLength={400}
            placeholder="Tagline brand, link, jam operasional…"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="cp-feed-followers" className="text-xs">
              Pengikut
            </Label>
            <Input
              id="cp-feed-followers"
              value={draft.followersLabel}
              onChange={(e) => setDraft((d) => ({ ...d, followersLabel: e.target.value }))}
              className="h-8 text-xs"
              maxLength={20}
              placeholder={DEFAULT_FOLLOWERS}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cp-feed-following" className="text-xs">
              Mengikuti
            </Label>
            <Input
              id="cp-feed-following"
              value={draft.followingLabel}
              onChange={(e) => setDraft((d) => ({ ...d, followingLabel: e.target.value }))}
              className="h-8 text-xs"
              maxLength={20}
              placeholder={DEFAULT_FOLLOWING}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={savePending}
            onClick={() =>
              setDraft({
                username: profile.username,
                displayName: profile.displayName,
                bio: profile.bio,
                followersLabel: profile.followersLabel,
                followingLabel: profile.followingLabel,
              })
            }
          >
            Batal
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={!dirty || savePending} onClick={saveDraft}>
          {savePending ? "Menyimpan…" : "Simpan profil"}
        </Button>
      </div>
    </div>
  );
}

function FeedToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5"
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        className="mt-0.5"
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        {hint ? <span className="text-muted-foreground block text-[11px]">{hint}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Komponen utama                                                       */
/* ------------------------------------------------------------------ */

type FeedTab = "grid" | "reels";

export function ContentPlanFeedSimulation({
  roomId,
  rows,
  profile: savedProfile,
  defaults,
  hasActiveFilters,
  onPreview,
  onEdit,
  onAddRow,
  onRowPatched,
  onRowsPatched,
}: {
  roomId: string;
  /** Semua baris (aktif + arsip) yang sudah lolos filter toolbar. */
  rows: ContentPlanTableRow[];
  profile: ContentPlanFeedProfileData | null;
  defaults: ContentPlanFeedDefaults;
  hasActiveFilters: boolean;
  onPreview: (row: ContentPlanTableRow) => void;
  onEdit: (row: ContentPlanTableRow) => void;
  onAddRow: () => void;
  onRowPatched: (rowId: string, patch: Partial<ContentPlanTableRow>) => void;
  onRowsPatched: (patches: ContentPlanFeedRowPatch[]) => void;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ContentPlanFeedProfileData>(() =>
    resolveProfile(savedProfile, defaults),
  );
  const [tab, setTab] = useState<FeedTab>("grid");
  const [coverRowId, setCoverRowId] = useState<string | null>(null);
  const [togglePending, startToggle] = useTransition();
  const [orderPending, startOrder] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const coverRow = useMemo(
    () => (coverRowId ? (rows.find((r) => r.id === coverRowId) ?? null) : null),
    [coverRowId, rows],
  );

  const prefs = useMemo(
    () => ({
      includeArchived: profile.includeArchived,
      instagramOnly: profile.instagramOnly,
      includeUndated: profile.includeUndated,
    }),
    [profile.includeArchived, profile.instagramOnly, profile.includeUndated],
  );

  /** Baris yang tampil (urut grid) dan yang di luar feed (dengan alasannya). */
  const { feedRows, excludedRows } = useMemo(() => {
    const shown: ContentPlanTableRow[] = [];
    const excluded: { row: ContentPlanTableRow; reason: FeedExclusionReason }[] = [];
    for (const r of rows) {
      const reason = contentPlanFeedExclusionReason(r, prefs);
      if (reason) excluded.push({ row: r, reason });
      else shown.push(r);
    }
    const ordered = mergeContentPlanFeedOrder(
      shown.map((r) => ({
        id: r.id,
        feedPosition: r.feedPosition,
        postingTime: contentPlanFeedPostingTime(r),
        row: r,
      })),
    ).map((k) => k.row);
    return { feedRows: ordered, excludedRows: excluded };
  }, [rows, prefs]);

  const tabRows = useMemo(
    () =>
      tab === "reels"
        ? feedRows.filter((r) => r.jenisKonten === ContentPlanJenis.REELS)
        : feedRows,
    [feedRows, tab],
  );
  const tabIds = useMemo(() => tabRows.map((r) => r.id), [tabRows]);

  const scheduledCount = useMemo(
    () => feedRows.filter((r) => !contentPlanFeedIsPublished(r)).length,
    [feedRows],
  );
  const hasManualOrder = useMemo(
    () => rows.some((r) => r.feedPosition != null),
    [rows],
  );

  const updateToggle = useCallback(
    (
      key: "includeArchived" | "instagramOnly" | "includeUndated",
      next: boolean,
    ) => {
      const prev = profile;
      setProfile((p) => ({ ...p, [key]: next }));
      startToggle(async () => {
        try {
          await saveContentPlanFeedProfile(roomId, { [key]: next });
          router.refresh();
        } catch (e) {
          setProfile(prev);
          toast.error(actionErrorMessage(e, "Gagal menyimpan pengaturan feed."));
        }
      });
    },
    [profile, roomId, router],
  );

  const setVisibility = useCallback(
    (row: ContentPlanTableRow, next: ContentPlanFeedVisibility) => {
      const prev = row.feedVisibility;
      if (prev === next) return;
      onRowPatched(row.id, { feedVisibility: next });
      startToggle(async () => {
        try {
          await setContentPlanFeedVisibility(roomId, row.id, next);
          toast.success(
            next === ContentPlanFeedVisibility.HIDDEN
              ? "Dihapus dari feed."
              : next === ContentPlanFeedVisibility.SHOWN
                ? "Ditambahkan ke feed."
                : "Kembali mengikuti aturan otomatis.",
          );
          router.refresh();
        } catch (e) {
          onRowPatched(row.id, { feedVisibility: prev });
          toast.error(actionErrorMessage(e, "Gagal mengubah keikutsertaan feed."));
        }
      });
    },
    [onRowPatched, roomId, router],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = tabIds.indexOf(String(active.id));
      const to = tabIds.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      const nextIds = arrayMove(tabIds, from, to);
      const rollback: ContentPlanFeedRowPatch[] = tabRows.map((r) => ({
        id: r.id,
        patch: { feedPosition: r.feedPosition },
      }));
      onRowsPatched(nextIds.map((id, i) => ({ id, patch: { feedPosition: i } })));
      startOrder(async () => {
        try {
          await reorderContentPlanFeed(roomId, nextIds);
          router.refresh();
        } catch (e) {
          onRowsPatched(rollback);
          toast.error(actionErrorMessage(e, "Gagal menyimpan urutan feed."));
        }
      });
    },
    [tabIds, tabRows, onRowsPatched, roomId, router],
  );

  const resetOrder = useCallback(() => {
    const rollback: ContentPlanFeedRowPatch[] = rows
      .filter((r) => r.feedPosition != null)
      .map((r) => ({ id: r.id, patch: { feedPosition: r.feedPosition } }));
    onRowsPatched(rollback.map((p) => ({ id: p.id, patch: { feedPosition: null } })));
    startOrder(async () => {
      try {
        await resetContentPlanFeedOrder(roomId);
        toast.success("Urutan feed kembali mengikuti tanggal posting.");
        router.refresh();
      } catch (e) {
        onRowsPatched(rollback);
        toast.error(actionErrorMessage(e, "Gagal mereset urutan feed."));
      }
    });
  }, [rows, onRowsPatched, roomId, router]);

  const tileActions: TileActions = {
    onPreview,
    onEdit,
    onPickCover: (r) => setCoverRowId(r.id),
    onSetVisibility: setVisibility,
  };

  const avatar = profile.avatarPath ?? defaults.avatarPath;
  /** Bio tampil apa adanya baris per baris; dibatasi agar header profil tidak melar. */
  const bioLines = profile.bio.trim() ? profile.bio.split("\n").slice(0, 8) : [];
  const dragEnabled = tab === "grid" && tabRows.length > 1 && !orderPending;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* ------------------------------------------------------------ */}
      {/* Bingkai ponsel                                                 */}
      {/* ------------------------------------------------------------ */}
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-muted-foreground text-xs">
            Simulasi profil Instagram — {feedRows.length} post di grid
            {scheduledCount > 0 ? `, ${scheduledCount} belum tayang` : ""}.
            {hasActiveFilters ? " Filter toolbar ikut diterapkan." : ""}
          </p>
          <div className="flex items-center gap-2">
            {hasManualOrder ? (
              <>
                <Badge variant="outline" className="text-[10px]">
                  Urutan manual
                </Badge>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={orderPending}
                  title="Hapus semua posisi manual; grid kembali mengikuti tanggal & jam posting."
                  onClick={resetOrder}
                >
                  <RotateCcw className="size-3" />
                  Reset ke urutan tanggal
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground text-[11px]">
                Seret tile untuk mengatur posisi. Tanpa geser: terbaru di kiri atas.
              </p>
            )}
          </div>
        </div>

        <div
          className="border-border bg-card mx-auto w-full max-w-[420px] overflow-hidden rounded-[2rem] border shadow-lg"
          aria-label="Simulasi tampilan profil Instagram"
        >
          {/* Bar atas */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-semibold"
              onClick={() => setTab("grid")}
            >
              <span className="truncate">{profile.username}</span>
              <ChevronDown className="size-3.5 opacity-70" aria-hidden />
            </button>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="hover:text-foreground text-foreground/80"
                aria-label="Tambah baris konten baru"
                title="Baris baru"
                onClick={onAddRow}
              >
                <Plus className="size-5" strokeWidth={2.25} aria-hidden />
              </button>
              <Menu className="text-foreground/80 size-5" aria-hidden />
            </div>
          </div>

          {/* Profil */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-5">
              <div className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
                <div className="bg-card rounded-full p-[2px]">
                  <FeedAvatar
                    path={avatar}
                    fallback={profile.displayName || profile.username}
                    className="size-[74px]"
                  />
                </div>
              </div>
              <div className="flex flex-1 items-center justify-around text-center">
                <div>
                  <p className="text-base leading-tight font-semibold tabular-nums">
                    {feedRows.length}
                  </p>
                  <p className="text-xs">posts</p>
                </div>
                <div>
                  <p className="text-base leading-tight font-semibold tabular-nums">
                    {profile.followersLabel}
                  </p>
                  <p className="text-xs">followers</p>
                </div>
                <div>
                  <p className="text-base leading-tight font-semibold tabular-nums">
                    {profile.followingLabel}
                  </p>
                  <p className="text-xs">following</p>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              <p className="inline-flex items-center gap-1 text-sm font-semibold">
                {profile.displayName}
                <BadgeCheck className="size-3.5 fill-sky-500 text-white" aria-hidden />
              </p>
              {bioLines.length > 0 ? (
                <div className="text-sm leading-snug">
                  {bioLines.map((l, i) => (
                    <p key={i} className="min-h-[1.25rem] break-words">
                      {l}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  Bio belum diisi — atur di panel kanan.
                </p>
              )}
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className="flex h-8 flex-1 items-center justify-center rounded-lg bg-sky-500 text-sm font-semibold text-white">
                Follow
              </div>
              <div className="bg-muted flex h-8 flex-1 items-center justify-center rounded-lg text-sm font-semibold">
                Message
              </div>
              <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                <UserPlus className="size-4" aria-hidden />
              </div>
            </div>
          </div>

          {/* Tab grid / reels / tagged */}
          <div className="border-border flex border-t">
            <button
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center border-b-2 py-2.5 transition-colors",
                tab === "grid"
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground border-transparent",
              )}
              aria-pressed={tab === "grid"}
              aria-label="Grid semua post"
              onClick={() => setTab("grid")}
            >
              <Grid3x3 className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center border-b-2 py-2.5 transition-colors",
                tab === "reels"
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground border-transparent",
              )}
              aria-pressed={tab === "reels"}
              aria-label="Tab Reels"
              onClick={() => setTab("reels")}
            >
              <Clapperboard className="size-5" aria-hidden />
            </button>
            <div
              className="text-muted-foreground/50 flex flex-1 items-center justify-center border-b-2 border-transparent py-2.5"
              aria-hidden
            >
              <SquareUser className="size-5" />
            </div>
          </div>

          {/* Grid */}
          {tabRows.length === 0 ? (
            <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-xs">
              <Grid3x3 className="size-8 opacity-40" aria-hidden />
              <p>
                {tab === "reels"
                  ? "Belum ada baris berjenis Reels yang masuk feed."
                  : rows.length === 0
                    ? "Belum ada baris content plan."
                    : "Tidak ada post di feed. Tambahkan dari panel kanan."}
              </p>
              {rows.length === 0 ? (
                <Button type="button" size="xs" variant="outline" onClick={onAddRow}>
                  <Plus className="size-3" />
                  Baris baru
                </Button>
              ) : null}
            </div>
          ) : tab === "grid" ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={tabIds} strategy={rectSortingStrategy}>
                <div className="bg-border grid grid-cols-3 gap-px">
                  {tabRows.map((row) => (
                    <SortableFeedTile
                      key={row.id}
                      row={row}
                      disabled={!dragEnabled}
                      {...tileActions}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="bg-border grid grid-cols-3 gap-px">
              {tabRows.map((row) => (
                <FeedTile key={row.id} row={row} reelsAspect {...tileActions} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Panel kustomisasi                                              */}
      {/* ------------------------------------------------------------ */}
      <aside className="min-w-0 space-y-4 lg:self-start">
        <section className="border-border bg-card rounded-xl border p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Di luar feed
              {excludedRows.length > 0 ? (
                <span className="bg-muted text-muted-foreground ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                  {excludedRows.length}
                </span>
              ) : null}
            </h3>
            <Button type="button" size="xs" variant="outline" onClick={onAddRow}>
              <Plus className="size-3" />
              Baris baru
            </Button>
          </div>
          {excludedRows.length === 0 ? (
            <p className="text-muted-foreground text-[11px]">
              Semua baris sudah tampil di feed. Pakai tombol X di tile (saat hover) untuk
              mengeluarkan post, atau buat baris baru.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground mb-1.5 text-[11px]">
                Klik Tambah untuk memasukkan post ke grid (selalu tampil, mengabaikan aturan
                otomatis).
              </p>
              <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto pr-0.5">
                {excludedRows.map(({ row: r, reason }) => (
                  <li
                    key={r.id}
                    className="hover:bg-muted/40 flex items-center gap-2 rounded-md px-1.5 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{rowTitle(r)}</p>
                      <p className="text-muted-foreground text-[10px]">
                        {FEED_EXCLUSION_LABEL[reason]}
                        {r.tanggalPosting ? ` · ${feedDateLabel(r)}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={togglePending}
                      onClick={() => setVisibility(r, ContentPlanFeedVisibility.SHOWN)}
                    >
                      <Plus className="size-3" />
                      Tambah
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="border-border bg-card rounded-xl border p-3">
          <h3 className="mb-1 text-sm font-semibold">Aturan otomatis</h3>
          <p className="text-muted-foreground mb-1 text-[11px]">
            Berlaku untuk baris yang belum diatur manual lewat Tambah / Hapus.
          </p>
          <div className="-mx-1.5 flex flex-col">
            <FeedToggleRow
              id="cp-feed-include-archived"
              label="Sertakan konten arsip"
              hint="Konten yang sudah tayang & diarsipkan ikut tampil supaya feed terlihat utuh."
              checked={profile.includeArchived}
              disabled={togglePending}
              onChange={(v) => updateToggle("includeArchived", v)}
            />
            <FeedToggleRow
              id="cp-feed-instagram-only"
              label="Hanya platform Instagram"
              hint="Baris dengan platform lain saja (mis. TikTok) tidak ikut. Baris tanpa platform tetap tampil."
              checked={profile.instagramOnly}
              disabled={togglePending}
              onChange={(v) => updateToggle("instagramOnly", v)}
            />
            <FeedToggleRow
              id="cp-feed-include-undated"
              label="Sertakan baris tanpa tanggal"
              hint="Ditaruh paling atas sebagai rencana berikutnya, dengan chip kuning."
              checked={profile.includeUndated}
              disabled={togglePending}
              onChange={(v) => updateToggle("includeUndated", v)}
            />
          </div>
        </section>

        <section className="border-border bg-card rounded-xl border p-3">
          <h3 className="text-sm font-semibold">Profil simulasi</h3>
          <p className="text-muted-foreground mb-3 text-[11px]">
            Berlaku untuk semua anggota ruangan. Tidak mengubah akun Instagram asli.
          </p>
          <FeedProfileForm
            roomId={roomId}
            profile={profile}
            defaults={defaults}
            onProfileChange={setProfile}
          />
        </section>
      </aside>

      <FeedCoverDialog
        roomId={roomId}
        row={coverRow}
        onClose={() => setCoverRowId(null)}
        onRowPatched={onRowPatched}
      />
    </div>
  );
}
