"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ContentPlanJenis,
  ContentPlanStatusKerja,
  ContentPlanUsage,
  type User,
} from "@prisma/client";
import { toast } from "sonner";
import { createKanbanTasksFromContentPlanDesign } from "@/actions/content-plan-to-kanban";
import {
  applyContentPlanPostingTimes,
  suggestContentPlanPostingTimes,
} from "@/actions/content-plan-posting-times";
import type { PostingTimeSuggestion } from "@/lib/content-plan-posting-suggest";
import {
  clearContentPlanCopywritingFile,
  clearContentPlanDesignFiles,
  deleteRoomContentPlanItem,
  removeContentPlanDesignSlide,
  uploadContentPlanCopywritingFile,
  uploadContentPlanDesignFile,
  upsertRoomContentPlanItem,
} from "@/actions/room-content-planning";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  contentPlanDownloadApiPath,
  contentPlanHasStoredFiles,
} from "@/lib/content-plan-files";
import { MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  CalendarDays,
  Camera,
  ChevronDown,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Heart,
  LayoutGrid,
  Layers,
  LayoutList,
  ListFilter,
  MessageCircle,
  Music2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Column, ColumnDef } from "@tanstack/react-table";

const JENIS_LABEL: Record<ContentPlanJenis, string> = {
  [ContentPlanJenis.REELS]: "Reels",
  [ContentPlanJenis.CAROUSEL]: "Carousel",
  [ContentPlanJenis.SINGLE_FEED]: "Single Feed",
};

const STATUS_LABEL: Record<ContentPlanStatusKerja, string> = {
  [ContentPlanStatusKerja.BARU]: "Baru",
  [ContentPlanStatusKerja.DALAM_PROSES]: "Dalam Proses",
  [ContentPlanStatusKerja.DALAM_PENINJAUAN]: "Dalam Peninjauan",
  [ContentPlanStatusKerja.DIPUBLIKASIKAN]: "Dipublikasikan",
  [ContentPlanStatusKerja.DITANGGUHKAN]: "Ditangguhkan",
  [ContentPlanStatusKerja.DIJEDA]: "Dijeda",
};

const JENIS_BADGE_CLASS: Record<ContentPlanJenis, string> = {
  [ContentPlanJenis.REELS]:
    "border-fuchsia-500/35 bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300",
  [ContentPlanJenis.CAROUSEL]:
    "border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300",
  [ContentPlanJenis.SINGLE_FEED]:
    "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

const USAGE_LABEL: Record<ContentPlanUsage, string> = {
  [ContentPlanUsage.AWARENESS]: "Awareness",
  [ContentPlanUsage.CONSIDERATION]: "Consideration",
  [ContentPlanUsage.CONVERSION]: "Conversion",
};

const USAGE_BADGE_CLASS: Record<ContentPlanUsage, string> = {
  [ContentPlanUsage.AWARENESS]:
    "border-cyan-500/35 bg-cyan-500/12 text-cyan-800 dark:text-cyan-300",
  [ContentPlanUsage.CONSIDERATION]:
    "border-violet-500/35 bg-violet-500/12 text-violet-800 dark:text-violet-300",
  [ContentPlanUsage.CONVERSION]:
    "border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
};

/** Base UI Select: onValueChange juga terpanggil saat sync internal (reason `none`). */
type InlineSelectChangeDetails = {
  reason?: string;
  isCanceled?: boolean;
};

function isInlineSelectUserPick(details?: InlineSelectChangeDetails): boolean {
  return details?.reason === "item-press" && !details?.isCanceled;
}

/** Select inline di tabel: tanpa kotak border agar mirip spreadsheet. */
const INLINE_SELECT_TRIGGER =
  "h-auto min-h-8 w-full max-w-full min-w-0 justify-start whitespace-normal border-0 bg-transparent shadow-none px-0.5 hover:bg-muted/40 dark:bg-transparent dark:hover:bg-muted/40 focus-visible:border-transparent focus-visible:ring-0 aria-invalid:ring-0";

/** Trigger status: max 2 baris di badge; tinggi/teks selaras kolom jenis konten. */
const STATUS_SELECT_TRIGGER = cn(
  INLINE_SELECT_TRIGGER,
  "items-start gap-1 py-0 pl-0.5 pr-0.5 [&>svg]:mt-0.5 [&>svg]:shrink-0",
);

/** Lebar kolom status diperbesar agar label status lebih lega. */
const STATUS_COL_BOX = "w-[10.5rem] max-w-full shrink-0 overflow-hidden";

const STATUS_BADGE_CLASS: Record<ContentPlanStatusKerja, string> = {
  [ContentPlanStatusKerja.BARU]:
    "border-slate-500/35 bg-slate-500/12 text-slate-700 dark:text-slate-300",
  [ContentPlanStatusKerja.DALAM_PROSES]:
    "border-blue-500/35 bg-blue-500/12 text-blue-700 dark:text-blue-300",
  [ContentPlanStatusKerja.DALAM_PENINJAUAN]:
    "border-violet-500/35 bg-violet-500/12 text-violet-700 dark:text-violet-300",
  [ContentPlanStatusKerja.DIPUBLIKASIKAN]:
    "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  [ContentPlanStatusKerja.DITANGGUHKAN]:
    "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300",
  [ContentPlanStatusKerja.DIJEDA]:
    "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

export type ContentPlanTableRow = {
  id: string;
  konten: string;
  jenisKonten: ContentPlanJenis;
  usage: ContentPlanUsage;
  detailKonten: string | null;
  copywritingFilePath: string | null;
  copywritingLink: string | null;
  designFilePaths: string[];
  designLink: string | null;
  picUserId: string | null;
  picUserIds: string[];
  statusCopywriting: ContentPlanStatusKerja;
  statusDesign: ContentPlanStatusKerja;
  deadlineCopywriting: Date | string | null;
  deadlineDesign: Date | string | null;
  tanggalPosting: Date | string | null;
  jamPosting: string | null;
  catatan: string | null;
  pic: Pick<User, "id" | "name" | "email" | "image"> | null;
  pics?: Pick<User, "id" | "name" | "email" | "image">[];
  createdBy: Pick<User, "id" | "name" | "email">;
};

type PicOption = Pick<User, "id" | "name" | "email" | "image">;

/** Pakai komponen tanggal lokal agar konsisten dengan formatDateShort (bukan UTC). */
function toDateInput(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Kunci hari lokal (YYYY-MM-DD) untuk mengelompokkan tanggal posting. */
function cpPostingDayKey(v: Date | string | null | undefined): string | null {
  const s = toDateInput(v);
  return s || null;
}

/** Label dd/mm/yy dari kunci hari "YYYY-MM-DD" (tanpa lewat Date agar bebas timezone). */
function formatDayKeyLabel(key: string): string {
  const [y, m, d] = key.split("-");
  if (!y || !m || !d) return key;
  return `${d}/${m}/${y.slice(-2)}`;
}

/** Menit sejak 00:00 dari string "HH:mm" (untuk sorting dalam satu hari). */
function jamPostingMinutes(jam: string | null | undefined): number {
  if (!jam) return 0;
  const m = /^(\d{2}):(\d{2})$/.exec(jam);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatDateShort(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function cpDateSortValue(v: Date | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const d = typeof v === "string" ? new Date(v) : v;
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function CpColumnHeader({
  column,
  children,
  className,
}: {
  column: Column<ContentPlanTableRow, unknown>;
  children: React.ReactNode;
  className?: string;
}) {
  if (!column.getCanSort()) {
    return <span className={className}>{children}</span>;
  }
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      className={cn(
        "text-foreground inline-flex max-w-full min-w-0 items-center gap-0.5 text-left font-medium hover:underline",
        className,
      )}
      onClick={column.getToggleSortingHandler()}
    >
      <span className="min-w-0">{children}</span>
      {sorted === "asc" ? (
        <ArrowUp className="text-muted-foreground size-3 shrink-0" aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDown className="text-muted-foreground size-3 shrink-0" aria-hidden />
      ) : (
        <ArrowUpDown className="text-muted-foreground size-3 shrink-0 opacity-40" aria-hidden />
      )}
    </button>
  );
}

function isImagePath(publicPath: string): boolean {
  const lower = publicPath.split("?")[0]?.toLowerCase() ?? "";
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(lower);
}

function isVideoPath(publicPath: string): boolean {
  const lower = publicPath.split("?")[0]?.toLowerCase() ?? "";
  return /\.(mp4|webm|mov|m4v|ogg)$/i.test(lower);
}

/** Semua jenis konten memakai frame yang sama dengan preview carousel. */
const PREVIEW_MEDIA_ASPECT = "aspect-[4/5]";

function previewDialogTitle(jenis: ContentPlanJenis): string {
  switch (jenis) {
    case ContentPlanJenis.CAROUSEL:
      return "Preview Carousel";
    case ContentPlanJenis.REELS:
      return "Preview Reels";
    case ContentPlanJenis.SINGLE_FEED:
      return "Preview Single Feed";
    default:
      return "Preview";
  }
}

function previewSimulationHint(jenis: ContentPlanJenis): string {
  switch (jenis) {
    case ContentPlanJenis.CAROUSEL:
      return "Simulasi tampilan carousel saat sudah diposting.";
    case ContentPlanJenis.REELS:
      return "Simulasi tampilan reels saat sudah diposting.";
    case ContentPlanJenis.SINGLE_FEED:
      return "Simulasi tampilan single feed saat sudah diposting.";
    default:
      return "Simulasi tampilan konten saat sudah diposting.";
  }
}

function ExternalOrText({ value }: { value: string | null }) {
  if (!value?.trim()) return null;
  const t = value.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) {
    return (
      <a
        href={t}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-foreground block min-w-0 truncate text-xs underline-offset-2 hover:underline"
        title={t}
      >
        Link
      </a>
    );
  }
  return (
    <span className="text-muted-foreground block min-w-0 truncate text-xs" title={t}>
      {t}
    </span>
  );
}

function FileLink({ path, short }: { path: string | null; short: string }) {
  if (!path) return null;
  return (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-foreground text-xs underline-offset-2 hover:underline"
    >
      {short}
    </a>
  );
}

function ContentPlanDownloadButton({
  roomId,
  row,
  variant = "outline",
  size = "xs",
  showLabel = true,
  className,
}: {
  roomId: string;
  row: Pick<ContentPlanTableRow, "id" | "copywritingFilePath" | "designFilePaths">;
  variant?: "outline" | "ghost";
  size?: "xs" | "icon-sm" | "icon-xs";
  showLabel?: boolean;
  className?: string;
}) {
  if (!contentPlanHasStoredFiles(row)) return null;
  const href = contentPlanDownloadApiPath(roomId, row.id);
  if (size === "icon-sm" || size === "icon-xs") {
    const iconSize = size === "icon-xs" ? "icon-xs" : "icon-sm";
    return (
      <a
        href={href}
        download
        title="Unduh file konten"
        aria-label="Unduh file konten"
        className={cn(
          buttonVariants({ variant, size: iconSize }),
          size === "icon-xs" ? "size-6 shrink-0" : "size-7 shrink-0",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Download className={size === "icon-xs" ? "size-3" : "size-3.5"} />
      </a>
    );
  }
  return (
    <a
      href={href}
      download
      title="Unduh file konten"
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={(e) => e.stopPropagation()}
    >
      <Download className="size-3.5" />
      {showLabel ? "Unduh" : null}
    </a>
  );
}

function StatusBadge({ status }: { status: ContentPlanStatusKerja }) {
  const label = STATUS_LABEL[status];
  return (
    <Badge
      variant="outline"
      title={label}
      className={cn(
        "inline-flex h-auto min-h-0 min-w-0 w-full max-w-full flex-1 shrink items-start justify-start overflow-visible whitespace-normal px-1.5 py-0.5 text-left text-[9px] leading-tight font-medium sm:text-[10px]",
        STATUS_BADGE_CLASS[status],
      )}
    >
      <span className="min-w-0 flex-1 break-words text-left line-clamp-2">{label}</span>
    </Badge>
  );
}

function JenisBadge({ jenis }: { jenis: ContentPlanJenis }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full whitespace-normal px-1.5 py-0.5 text-left text-[9px] leading-tight font-medium sm:text-[10px]",
        JENIS_BADGE_CLASS[jenis],
      )}
    >
      {JENIS_LABEL[jenis]}
    </Badge>
  );
}

function UsageBadge({ usage }: { usage: ContentPlanUsage }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full whitespace-normal px-1.5 py-0.5 text-left text-[9px] leading-tight font-medium sm:text-[10px]",
        USAGE_BADGE_CLASS[usage],
      )}
    >
      {USAGE_LABEL[usage]}
    </Badge>
  );
}

function InlineTextCell({
  value,
  placeholder,
  active,
  onActivate,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  active: boolean;
  onActivate: () => void;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value, active]);

  if (!active) {
    const label = value?.trim() ? value : "";
    return (
      <button
        type="button"
        onClick={onActivate}
        className="hover:bg-muted/40 min-h-7 w-full rounded px-1 py-0.5 text-left"
        title={label ? `${label}\n(Klik untuk edit)` : "Klik untuk edit"}
      >
        <span className="min-w-0 whitespace-normal break-words text-left text-sm leading-snug">
          {value || (
            <span className="text-muted-foreground">{placeholder || "—"}</span>
          )}
        </span>
      </button>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(draft);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCommit(value);
        }
      }}
      className="h-8"
    />
  );
}

function PicCell({ pics }: { pics: Pick<User, "id" | "name" | "email" | "image">[] }) {
  if (!pics.length) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const MAX_VISIBLE = 4;
  const visible = pics.slice(0, MAX_VISIBLE);
  const extra = pics.length - visible.length;
  const fullList = pics
    .map((u) => u.name?.trim() || u.email)
    .join(", ");

  return (
    <div
      className="flex min-w-0 max-w-full items-center -space-x-1.5"
      aria-label={`PIC: ${fullList}`}
      title={fullList}
    >
      {visible.map((p, i) => {
        const label = p.name?.trim() || p.email;
        const initial = label.slice(0, 1).toUpperCase();
        return p.image ? (
          <Image
            key={p.id}
            src={p.image}
            alt={label}
            width={22}
            height={22}
            unoptimized
            title={label}
            className="ring-background border-border size-[22px] shrink-0 rounded-full border object-cover ring-2"
            style={{ zIndex: visible.length - i }}
          />
        ) : (
          <span
            key={p.id}
            title={label}
            className="ring-background border-border bg-muted text-muted-foreground relative flex size-[22px] shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ring-2"
            style={{ zIndex: visible.length - i }}
          >
            {initial}
          </span>
        );
      })}
      {extra > 0 ? (
        <span
          className="ring-background border-border bg-muted text-muted-foreground relative flex size-[22px] shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ring-2 tabular-nums"
          aria-label={`+${extra} PIC lainnya`}
          title={fullList}
          style={{ zIndex: 0 }}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function DesignTableCell({
  roomId,
  row,
  onPreview,
}: {
  roomId: string;
  row: ContentPlanTableRow;
  onPreview?: (row: ContentPlanTableRow) => void;
}) {
  const paths = row.designFilePaths ?? [];
  if (paths.length === 0) {
    if (!row.designLink?.trim()) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    return (
      <div className="flex min-w-0 max-w-full flex-col gap-1 text-xs">
        <ExternalOrText value={row.designLink} />
      </div>
    );
  }
  const hasLink = Boolean(row.designLink?.trim());
  const showDownload = contentPlanHasStoredFiles(row);
  const previewLabel = JENIS_LABEL[row.jenisKonten];
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1 text-xs">
      <div className="flex items-center gap-1">
        {onPreview ? (
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="size-6 shrink-0"
            aria-label={`Preview ${previewLabel}`}
            title="Preview"
            onClick={() => onPreview(row)}
          >
            <Eye className="size-3" />
          </Button>
        ) : null}
        {showDownload ? (
          <ContentPlanDownloadButton
            roomId={roomId}
            row={row}
            size="icon-xs"
            showLabel={false}
          />
        ) : null}
      </div>
      {hasLink ? <ExternalOrText value={row.designLink} /> : null}
    </div>
  );
}

type CarouselRailProps = {
  paths: string[];
  roomId: string;
  itemId: string;
  onPathsChange: (next: string[]) => void;
};

function CarouselDesignRail({
  paths,
  roomId,
  itemId,
  onPathsChange,
}: CarouselRailProps) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Urutan kiri → kanan = urutan slide carousel ({paths.length} file).
        </p>
        {paths.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={async () => {
              if (!confirm("Hapus semua file design untuk baris ini?")) return;
              try {
                await clearContentPlanDesignFiles(roomId, itemId);
                onPathsChange([]);
                toast.success("Semua slide dihapus.");
                router.refresh();
              } catch (e) {
                toast.error(actionErrorMessage(e, "Gagal."));
              }
            }}
          >
            Hapus semua slide
          </Button>
        ) : null}
      </div>
      <div className="border-border bg-muted/20 flex gap-3 overflow-x-auto rounded-xl border p-3">
        {paths.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Belum ada slide. Unggah gambar atau file di bawah — bisa pilih banyak
            sekaligus.
          </p>
        ) : (
          paths.map((p, i) => (
            <div
              key={p}
              className="border-border group relative shrink-0 overflow-hidden rounded-xl border bg-card shadow-sm"
              style={{ width: "5.75rem" }}
            >
              <div className="bg-accent text-accent-foreground absolute top-1.5 left-1.5 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
                {i + 1}
              </div>
              <button
                type="button"
                className="bg-destructive/90 text-destructive-foreground absolute top-1.5 right-1.5 z-10 flex size-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Hapus slide ${i + 1}`}
                onClick={async () => {
                  try {
                    await removeContentPlanDesignSlide(roomId, itemId, p);
                    onPathsChange(paths.filter((x) => x !== p));
                    toast.success("Slide dihapus.");
                    router.refresh();
                  } catch (e) {
                    toast.error(actionErrorMessage(e, "Gagal menghapus."));
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
              <a
                href={p}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-muted/50 flex aspect-[4/5] w-full items-center justify-center"
              >
                {isImagePath(p) ? (
                  <Image
                    src={p}
                    alt=""
                    width={184}
                    height={230}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center gap-1 p-2 text-center">
                    <FileText className="size-8 opacity-70" />
                    <span className="text-[10px] leading-tight">Buka file</span>
                  </div>
                )}
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Tombol aksi vertikal kanan (seperti Instagram Reels). */
function ReelsActionButton({
  icon: Icon,
  label,
  filled,
}: {
  icon: LucideIcon;
  label: string;
  filled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-px text-white">
      <div className="flex size-7 items-center justify-center drop-shadow-md">
        <Icon
          className={cn("size-[18px] stroke-[2]", filled && "fill-white")}
          aria-hidden
        />
      </div>
      {label ? (
        <span className="text-[9px] font-medium leading-none drop-shadow-md">{label}</span>
      ) : null}
    </div>
  );
}

/** Video tanpa kontrol browser — klik untuk play/pause (hemat ruang overlay IG). */
function ReelsPreviewVideo({ path }: { path: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <video
        ref={videoRef}
        src={path}
        playsInline
        loop
        className="h-full w-full cursor-pointer object-cover"
        aria-label="Pratinjau video reels"
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) {
            v.muted = false;
            void v.play();
          } else {
            v.pause();
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {!playing ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-[2px]">
            <Play className="ml-0.5 size-5 fill-white text-white" />
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Simulasi layout Reels IG: safe zone tengah, aksi kanan vertikal,
 * profil & caption di bawah (proporsi mengacu diagram safe zone 1080×1920).
 */
function ReelsInstagramPreview({
  path,
  creator,
  caption,
  kontenTitle,
}: {
  path: string;
  creator: string;
  caption: string;
  kontenTitle: string;
}) {
  const username =
    creator
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._]/g, "")
      .slice(0, 24) || "brandaccount";

  return (
    <div
      className="relative mx-auto h-[min(72vh,580px)] w-auto max-w-full aspect-[9/16] overflow-hidden rounded-2xl bg-black text-white shadow-lg"
      aria-label="Simulasi tampilan Instagram Reels"
    >
      {/* Media penuh (area aman ~ tengah frame) */}
      <div className="absolute inset-0">
        {isVideoPath(path) ? (
          <div className="relative h-full w-full">
            <ReelsPreviewVideo path={path} />
          </div>
        ) : isImagePath(path) ? (
          <div className="relative h-full w-full">
            <Image
              src={path}
              alt="Pratinjau reels"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 bg-zinc-900">
            <FileText className="size-10 text-white/70" />
            <a
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/90 underline"
            >
              Buka file
            </a>
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[12%] bg-gradient-to-b from-black/45 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[16%] bg-gradient-to-t from-black/65 via-black/25 to-transparent"
        aria-hidden
      />

      {/* Atas: Reels + kamera */}
      <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-0.5 text-xs font-semibold drop-shadow-md">
        <span>Reels</span>
        <ChevronDown className="size-3.5 opacity-90" aria-hidden />
      </div>
      <div className="absolute top-2.5 right-2.5 z-20 drop-shadow-md">
        <Camera className="size-4" strokeWidth={1.75} aria-hidden />
      </div>

      {/* Rail kanan — anchor bawah: thumbnail audio sejajar bar audio kiri */}
      <div className="absolute right-1.5 bottom-2 z-20 flex flex-col items-center gap-1.5 pb-0.5">
        <ReelsActionButton icon={Heart} label="257" filled />
        <ReelsActionButton icon={MessageCircle} label="22" />
        <ReelsActionButton icon={Send} label="1" />
        <ReelsActionButton icon={MoreHorizontal} label="" />
        <div
          className="size-6 overflow-hidden rounded border border-white/25 bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-sm"
          aria-hidden
        />
      </div>

      {/* Bawah kiri — ringkas, tanpa menutupi area video */}
      <div className="absolute right-11 bottom-2.5 left-2.5 z-20 space-y-1">
        <div className="inline-flex items-center gap-0.5 rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-black shadow-sm">
          <Layers className="size-2.5" aria-hidden />
          Use template
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="bg-muted flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/35 text-[9px] font-bold text-black">
            {creator.slice(0, 1).toUpperCase()}
          </div>
          <span className="truncate text-[11px] font-semibold drop-shadow-md">{username}</span>
          <span className="shrink-0 rounded border border-white/70 px-1.5 py-px text-[9px] font-semibold">
            Follow
          </span>
        </div>
        <p className="line-clamp-1 text-[10px] leading-snug drop-shadow-md">
          <span className="font-semibold">{username}</span>{" "}
          {caption || kontenTitle}
        </p>
        <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] backdrop-blur-sm">
          <Music2 className="size-2.5 shrink-0" aria-hidden />
          <span className="truncate">Trending Audio (original)</span>
          <Users className="size-2.5 shrink-0 opacity-80" aria-hidden />
          <span className="shrink-0 opacity-90">3</span>
        </div>
      </div>
    </div>
  );
}

function DesignPreviewMedia({
  path,
  slideLabel,
}: {
  path: string;
  slideLabel?: string;
}) {
  if (isVideoPath(path)) {
    return (
      <div className={cn("bg-muted/30 relative w-full", PREVIEW_MEDIA_ASPECT)}>
        <video
          src={path}
          controls
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={slideLabel ?? "Pratinjau video"}
        />
      </div>
    );
  }
  if (isImagePath(path)) {
    return (
      <div className={cn("bg-muted/30 relative w-full", PREVIEW_MEDIA_ASPECT)}>
        <Image
          src={path}
          alt={slideLabel ?? "Pratinjau gambar"}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "text-muted-foreground flex w-full flex-col items-center justify-center gap-2",
        PREVIEW_MEDIA_ASPECT,
      )}
    >
      <FileText className="size-10" />
      <p className="text-sm">Pratinjau file non-gambar</p>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-foreground text-xs underline-offset-2 hover:underline"
      >
        Buka file
      </a>
    </div>
  );
}

function ContentPlanPreviewDialog({
  row,
  index,
  onIndexChange,
}: {
  row: ContentPlanTableRow | null;
  index: number;
  onIndexChange: (next: number) => void;
}) {
  if (!row) return null;
  const slides = row.designFilePaths ?? [];
  if (slides.length === 0) return null;
  const isCarousel = row.jenisKonten === ContentPlanJenis.CAROUSEL;
  const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
  const current = slides[safeIndex]!;
  const caption = row.detailKonten?.trim() || "Preview caption untuk simulasi posting.";
  const creator = row.createdBy.name?.trim() || row.createdBy.email;
  const kontenFallback = row.konten || JENIS_LABEL[row.jenisKonten];
  const isReels = row.jenisKonten === ContentPlanJenis.REELS;

  if (isReels) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3">
        <ReelsInstagramPreview
          path={current}
          creator={creator}
          caption={caption}
          kontenTitle={kontenFallback}
        />
        <p className="text-muted-foreground text-center text-xs">
          {previewSimulationHint(row.jenisKonten)}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      <div className="border-border overflow-hidden rounded-[1.2rem] border bg-card shadow-sm">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
              {creator.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{creator}</p>
              <p className="text-muted-foreground truncate text-[10px]">{kontenFallback}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Lainnya">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
        <DesignPreviewMedia
          path={current}
          slideLabel={isCarousel ? `Slide ${safeIndex + 1}` : undefined}
        />
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Like">
              <Heart className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Comment">
              <MessageCircle className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Share">
              <Send className="size-4" />
            </Button>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Save">
            <Bookmark className="size-4" />
          </Button>
        </div>
        {isCarousel && slides.length > 1 ? (
          <div className="flex items-center justify-between px-4 py-2">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              disabled={safeIndex <= 0}
              onClick={() => onIndexChange(safeIndex - 1)}
              aria-label="Slide sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    i === safeIndex ? "bg-foreground w-4" : "bg-muted-foreground/40",
                  )}
                  aria-label={`Buka slide ${i + 1}`}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              disabled={safeIndex >= slides.length - 1}
              onClick={() => onIndexChange(safeIndex + 1)}
              aria-label="Slide berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
        <div className="space-y-1 px-3 pb-3">
          <p className="text-[11px] font-semibold">Disukai 128 akun</p>
          <p className="text-muted-foreground line-clamp-2 text-[11px]">
            <span className="text-foreground font-semibold">{creator}</span>{" "}
            {caption}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-center text-xs">
        {previewSimulationHint(row.jenisKonten)}
      </p>
    </div>
  );
}

export function ContentPlanningClient({
  roomId,
  items,
  picUserOptions,
  kanbanProjectId,
}: {
  roomId: string;
  items: ContentPlanTableRow[];
  picUserOptions: PicOption[];
  kanbanProjectId: string | null;
}) {
  const router = useRouter();
  const copyFileRef = useRef<HTMLInputElement>(null);
  const designFileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContentPlanTableRow | null>(null);
  const [konten, setKonten] = useState("");
  const [jenisKonten, setJenisKonten] = useState<ContentPlanJenis>(
    ContentPlanJenis.REELS,
  );
  const [usage, setUsage] = useState<ContentPlanUsage>(ContentPlanUsage.AWARENESS);
  const [detailKonten, setDetailKonten] = useState("");
  const [copywritingLink, setCopywritingLink] = useState("");
  const [designLink, setDesignLink] = useState("");
  const [picUserIds, setPicUserIds] = useState<string[]>([]);
  const [statusCopywriting, setStatusCopywriting] = useState<ContentPlanStatusKerja>(
    ContentPlanStatusKerja.BARU,
  );
  const [statusDesign, setStatusDesign] = useState<ContentPlanStatusKerja>(
    ContentPlanStatusKerja.BARU,
  );
  const [deadlineCopywriting, setDeadlineCopywriting] = useState("");
  const [deadlineDesign, setDeadlineDesign] = useState("");
  const [tanggalPosting, setTanggalPosting] = useState("");
  const [jamPosting, setJamPosting] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pending, setPending] = useState(false);
  const [kanbanPending, startKanban] = useTransition();
  const [aiSuggestPending, startAiSuggest] = useTransition();
  const [aiApplyPending, startAiApply] = useTransition();
  const [aiSuggestions, setAiSuggestions] = useState<PostingTimeSuggestion[] | null>(
    null,
  );
  const [aiSelectedIds, setAiSelectedIds] = useState<Set<string>>(new Set());

  const picUserById = useMemo(() => {
    return new Map(picUserOptions.map((u) => [u.id, u]));
  }, [picUserOptions]);

  const withResolvedPics = useCallback(
    (row: ContentPlanTableRow): ContentPlanTableRow => {
      const ids = row.picUserIds?.length
        ? row.picUserIds
        : row.picUserId
          ? [row.picUserId]
          : [];
      const pics = ids
        .map((id) => picUserById.get(id))
        .filter((u): u is PicOption => Boolean(u));
      return {
        ...row,
        usage: row.usage ?? ContentPlanUsage.AWARENESS,
        picUserIds: ids,
        pics: pics.length ? pics : row.pic ? [row.pic] : [],
      };
    },
    [picUserById],
  );

  const serverRows = useMemo(
    () => items.map(withResolvedPics),
    [items, withResolvedPics],
  );

  const [tableRows, setTableRows] = useState<ContentPlanTableRow[]>(serverRows);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [inlineSavingCell, setInlineSavingCell] = useState<string | null>(null);
  const [queuedDesignFiles, setQueuedDesignFiles] = useState<File[]>([]);
  const [previewRow, setPreviewRow] = useState<ContentPlanTableRow | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [kanbanSelectedIds, setKanbanSelectedIds] = useState<string[]>([]);
  const inlineSaveInFlightRef = useRef<Set<string>>(new Set());
  const inlineSavingCellRef = useRef<string | null>(null);
  inlineSavingCellRef.current = inlineSavingCell;

  const [searchQuery, setSearchQuery] = useState("");
  const [jenisFilter, setJenisFilter] = useState<ContentPlanJenis | "all">("all");
  const [statusCwFilter, setStatusCwFilter] = useState<ContentPlanStatusKerja | "all">("all");
  const [statusDesignFilter, setStatusDesignFilter] = useState<ContentPlanStatusKerja | "all">("all");
  const [picFilter, setPicFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const kanbanSet = useMemo(() => new Set(kanbanSelectedIds), [kanbanSelectedIds]);

  const kanbanEligibleIds = useMemo(
    () =>
      tableRows
        .filter((r) => r.statusDesign === ContentPlanStatusKerja.BARU)
        .map((r) => r.id),
    [tableRows],
  );

  const kanbanEligibleCount = kanbanEligibleIds.length;
  const allKanbanSelected =
    kanbanEligibleCount > 0 && kanbanEligibleIds.every((id) => kanbanSet.has(id));

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (jenisFilter !== "all") n += 1;
    if (statusCwFilter !== "all") n += 1;
    if (statusDesignFilter !== "all") n += 1;
    if (picFilter !== "all") n += 1;
    return n;
  }, [jenisFilter, statusCwFilter, statusDesignFilter, picFilter]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (q) {
        const haystack = `${row.konten ?? ""} ${row.detailKonten ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (jenisFilter !== "all" && row.jenisKonten !== jenisFilter) return false;
      if (statusCwFilter !== "all" && row.statusCopywriting !== statusCwFilter) return false;
      if (statusDesignFilter !== "all" && row.statusDesign !== statusDesignFilter)
        return false;
      if (picFilter !== "all") {
        const ids = row.picUserIds?.length
          ? row.picUserIds
          : row.picUserId
            ? [row.picUserId]
            : [];
        if (!ids.includes(picFilter)) return false;
      }
      return true;
    });
  }, [
    tableRows,
    searchQuery,
    jenisFilter,
    statusCwFilter,
    statusDesignFilter,
    picFilter,
  ]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setJenisFilter("all");
    setStatusCwFilter("all");
    setStatusDesignFilter("all");
    setPicFilter("all");
  }, []);

  const stats = useMemo(() => {
    const total = tableRows.length;
    const published = tableRows.filter(
      (r) => r.statusDesign === ContentPlanStatusKerja.DIPUBLIKASIKAN,
    ).length;
    const inProgress = tableRows.filter(
      (r) =>
        r.statusCopywriting === ContentPlanStatusKerja.DALAM_PROSES ||
        r.statusDesign === ContentPlanStatusKerja.DALAM_PROSES ||
        r.statusCopywriting === ContentPlanStatusKerja.DALAM_PENINJAUAN ||
        r.statusDesign === ContentPlanStatusKerja.DALAM_PENINJAUAN,
    ).length;
    const fresh = tableRows.filter(
      (r) => r.statusDesign === ContentPlanStatusKerja.BARU,
    ).length;
    return { total, published, inProgress, fresh };
  }, [tableRows]);

  /** Info per hari posting: jumlah konten + apakah pembagian jamnya masih bermasalah. */
  const postingDayInfo = useMemo(() => {
    const map = new Map<string, { count: number; missingJam: number; dupJam: boolean }>();
    for (const row of tableRows) {
      const key = cpPostingDayKey(row.tanggalPosting);
      if (!key) continue;
      const info = map.get(key) ?? { count: 0, missingJam: 0, dupJam: false };
      info.count += 1;
      if (!row.jamPosting) info.missingJam += 1;
      map.set(key, info);
    }
    const seenJam = new Map<string, Set<string>>();
    for (const row of tableRows) {
      const key = cpPostingDayKey(row.tanggalPosting);
      if (!key || !row.jamPosting) continue;
      const set = seenJam.get(key) ?? new Set<string>();
      if (set.has(row.jamPosting)) {
        const info = map.get(key);
        if (info) info.dupJam = true;
      }
      set.add(row.jamPosting);
      seenJam.set(key, set);
    }
    return map;
  }, [tableRows]);

  const hasScheduledPosting = useMemo(
    () => tableRows.some((r) => cpDateSortValue(r.tanggalPosting) !== null),
    [tableRows],
  );

  useEffect(() => {
    setTableRows(serverRows);
  }, [serverRows]);

  useEffect(() => {
    const eligible = new Set(
      tableRows
        .filter((r) => r.statusDesign === ContentPlanStatusKerja.BARU)
        .map((r) => r.id),
    );
    setKanbanSelectedIds((prev) => {
      const next = prev.filter((id) => eligible.has(id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
        return prev;
      }
      return next;
    });
  }, [tableRows]);

  const toggleKanbanSelect = useCallback((id: string) => {
    setKanbanSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const isCarousel = jenisKonten === ContentPlanJenis.CAROUSEL;

  const jenisKontenSelectItems = useMemo((): SelectItemDef[] => {
    return (Object.values(ContentPlanJenis) as ContentPlanJenis[]).map((j) => ({
      value: j,
      label: JENIS_LABEL[j],
    }));
  }, []);

  const usageSelectItems = useMemo((): SelectItemDef[] => {
    return (Object.values(ContentPlanUsage) as ContentPlanUsage[]).map((u) => ({
      value: u,
      label: USAGE_LABEL[u],
    }));
  }, []);

  const statusKerjaSelectItems = useMemo((): SelectItemDef[] => {
    return (
      Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
    ).map((s) => ({ value: s, label: STATUS_LABEL[s] }));
  }, []);

  const jenisFilterItems = useMemo((): SelectItemDef[] => {
    return [{ value: "all", label: "Semua jenis" }, ...jenisKontenSelectItems];
  }, [jenisKontenSelectItems]);

  const statusFilterItems = useMemo((): SelectItemDef[] => {
    return [{ value: "all", label: "Semua status" }, ...statusKerjaSelectItems];
  }, [statusKerjaSelectItems]);

  const picFilterItems = useMemo((): SelectItemDef[] => {
    return [
      { value: "all", label: "Semua PIC" },
      ...picUserOptions.map((u) => ({
        value: u.id,
        label: u.name?.trim() || u.email,
      })),
    ];
  }, [picUserOptions]);

  const reset = useCallback(() => {
    setEditing(null);
    setKonten("");
    setJenisKonten(ContentPlanJenis.REELS);
    setUsage(ContentPlanUsage.AWARENESS);
    setDetailKonten("");
    setCopywritingLink("");
    setDesignLink("");
    setPicUserIds([]);
    setStatusCopywriting(ContentPlanStatusKerja.BARU);
    setStatusDesign(ContentPlanStatusKerja.BARU);
    setDeadlineCopywriting("");
    setDeadlineDesign("");
    setTanggalPosting("");
    setJamPosting("");
    setCatatan("");
    setQueuedDesignFiles([]);
    if (copyFileRef.current) copyFileRef.current.value = "";
    if (designFileRef.current) designFileRef.current.value = "";
  }, []);

  const openCreate = useCallback(() => {
    reset();
    setOpen(true);
  }, [reset]);

  const openEdit = useCallback((row: ContentPlanTableRow) => {
    setEditing(row);
    setKonten(row.konten);
    setJenisKonten(row.jenisKonten);
    setUsage(row.usage ?? ContentPlanUsage.AWARENESS);
    setDetailKonten(row.detailKonten ?? "");
    setCopywritingLink(row.copywritingLink ?? "");
    setDesignLink(row.designLink ?? "");
    setPicUserIds(row.picUserIds?.length ? row.picUserIds : row.picUserId ? [row.picUserId] : []);
    setStatusCopywriting(row.statusCopywriting);
    setStatusDesign(row.statusDesign);
    setDeadlineCopywriting(toDateInput(row.deadlineCopywriting));
    setDeadlineDesign(toDateInput(row.deadlineDesign));
    setTanggalPosting(toDateInput(row.tanggalPosting));
    setJamPosting(row.jamPosting ?? "");
    setCatatan(row.catatan ?? "");
    if (copyFileRef.current) copyFileRef.current.value = "";
    if (designFileRef.current) designFileRef.current.value = "";
    setOpen(true);
  }, []);

  const onDelete = useCallback(
    async (id: string) => {
      if (!confirm("Hapus baris ini?")) return;
      try {
        await deleteRoomContentPlanItem(roomId, id);
        toast.success("Baris dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus."));
      }
    },
    [roomId, router],
  );

  async function onSave() {
    if (!konten.trim()) return;
    if (
      editing &&
      editing.jenisKonten === ContentPlanJenis.CAROUSEL &&
      jenisKonten !== ContentPlanJenis.CAROUSEL &&
      editing.designFilePaths.length > 1
    ) {
      const extra = editing.designFilePaths.length - 1;
      if (
        !confirm(
          `Mengubah jenis dari Carousel akan menghapus ${extra} slide design secara permanen (hanya slide pertama disimpan). Lanjutkan?`,
        )
      ) {
        return;
      }
    }
    setPending(true);
    try {
      const dc = deadlineCopywriting.trim()
        ? new Date(deadlineCopywriting)
        : null;
      const dd = deadlineDesign.trim() ? new Date(deadlineDesign) : null;
      const tp = tanggalPosting.trim() ? new Date(tanggalPosting) : null;

      const { id } = await upsertRoomContentPlanItem({
        id: editing?.id,
        roomId,
        konten: konten.trim(),
        jenisKonten,
        usage,
        detailKonten: detailKonten.trim() || null,
        copywritingLink: copywritingLink.trim() || null,
        designLink: designLink.trim() || null,
        picUserIds,
        statusCopywriting,
        statusDesign,
        deadlineCopywriting: dc,
        deadlineDesign: dd,
        tanggalPosting: tp,
        jamPosting: jamPosting.trim() || null,
        catatan: catatan.trim() || null,
      });

      const copyInput = copyFileRef.current;
      const cf = copyInput?.files?.[0];
      if (cf && copyInput) {
        const fd = new FormData();
        fd.append("file", cf);
        await uploadContentPlanCopywritingFile(roomId, id, fd);
        copyInput.value = "";
      }

      if (queuedDesignFiles.length > 0) {
        const list = isCarousel ? queuedDesignFiles : [queuedDesignFiles[0]!];
        for (const file of list) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("replaceSingle", isCarousel ? "0" : "1");
          await uploadContentPlanDesignFile(roomId, id, fd);
        }
        setQueuedDesignFiles([]);
        if (designFileRef.current) designFileRef.current.value = "";
      }

      toast.success(editing ? "Baris diperbarui." : "Baris ditambahkan.");
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan."));
    } finally {
      setPending(false);
    }
  }

  const buildUpsertPayload = useCallback((row: ContentPlanTableRow) => {
    return {
      id: row.id,
      roomId,
      konten: row.konten,
      jenisKonten: row.jenisKonten,
      usage: row.usage ?? ContentPlanUsage.AWARENESS,
      detailKonten: row.detailKonten ?? null,
      copywritingLink: row.copywritingLink ?? null,
      designLink: row.designLink ?? null,
      picUserIds: row.picUserIds ?? [],
      statusCopywriting: row.statusCopywriting,
      statusDesign: row.statusDesign,
      deadlineCopywriting: row.deadlineCopywriting
        ? new Date(row.deadlineCopywriting)
        : null,
      deadlineDesign: row.deadlineDesign ? new Date(row.deadlineDesign) : null,
      tanggalPosting: row.tanggalPosting ? new Date(row.tanggalPosting) : null,
      jamPosting: row.jamPosting ?? null,
      catatan: row.catatan ?? null,
    };
  }, [roomId]);

  const saveInlineRow = useCallback(
    async (rowId: string, patch: Partial<ContentPlanTableRow>, cellKey: string) => {
      if (inlineSaveInFlightRef.current.has(rowId)) return;

      let prev: ContentPlanTableRow | undefined;
      let nextRow: ContentPlanTableRow | undefined;
      setTableRows((rows) => {
        const found = rows.find((r) => r.id === rowId);
        if (!found) return rows;
        prev = found;
        nextRow = withResolvedPics({ ...found, ...patch });
        return rows.map((r) => (r.id === rowId ? nextRow! : r));
      });
      if (!prev || !nextRow) return;

      inlineSaveInFlightRef.current.add(rowId);
      setInlineSavingCell(cellKey);
      try {
        await upsertRoomContentPlanItem(buildUpsertPayload(nextRow), { revalidate: false });
      } catch (e) {
        const rollback = prev;
        setTableRows((rows) => rows.map((r) => (r.id === rowId ? rollback : r)));
        toast.error(actionErrorMessage(e, "Gagal menyimpan perubahan."));
      } finally {
        inlineSaveInFlightRef.current.delete(rowId);
        setInlineSavingCell(null);
        setActiveCell(null);
      }
    },
    [buildUpsertPayload, withResolvedPics],
  );

  const onAiSuggest = useCallback(() => {
    startAiSuggest(async () => {
      try {
        const res = await suggestContentPlanPostingTimes(roomId);
        if (res.suggestions.length === 0) {
          toast.info(
            res.scheduledCount === 0
              ? "Belum ada konten dengan tanggal posting hari ini atau ke depan."
              : "AI tidak menghasilkan saran jam yang valid — coba lagi.",
          );
          return;
        }
        setAiSuggestions(res.suggestions);
        setAiSelectedIds(new Set(res.suggestions.map((s) => s.itemId)));
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal meminta saran jam dari AI."));
      }
    });
  }, [roomId]);

  const onAiApply = useCallback(() => {
    if (!aiSuggestions) return;
    const entries = aiSuggestions
      .filter((s) => aiSelectedIds.has(s.itemId))
      .map((s) => ({ itemId: s.itemId, jam: s.jam }));
    if (entries.length === 0) return;
    startAiApply(async () => {
      try {
        const { updated } = await applyContentPlanPostingTimes({ roomId, entries });
        toast.success(`Jam posting diterapkan ke ${updated} konten.`);
        setAiSuggestions(null);
        setAiSelectedIds(new Set());
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menerapkan jam posting."));
      }
    });
  }, [aiSuggestions, aiSelectedIds, roomId, router]);

  /** Saran AI dikelompokkan per tanggal (WIB) untuk ditampilkan di dialog. */
  const aiGroups = useMemo(() => {
    if (!aiSuggestions) return [];
    const map = new Map<string, PostingTimeSuggestion[]>();
    for (const s of aiSuggestions) {
      const list = map.get(s.dateKey) ?? [];
      list.push(s);
      map.set(s.dateKey, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [aiSuggestions]);

  const aiSelectedCount = aiSelectedIds.size;

  const columns = useMemo<ColumnDef<ContentPlanTableRow>[]>(
    () => [
      {
        id: "kanbanPick",
        size: 40,
        minSize: 36,
        maxSize: 48,
        enableSorting: false,
        header: () => (
          <div className="flex justify-center px-0.5">
            <Checkbox
              checked={kanbanEligibleCount > 0 && allKanbanSelected}
              disabled={kanbanEligibleCount === 0}
              aria-label="Pilih semua baris (status design Baru) untuk Kanban"
              onCheckedChange={(v) => {
                if (v === true) setKanbanSelectedIds([...kanbanEligibleIds]);
                else setKanbanSelectedIds([]);
              }}
            />
          </div>
        ),
        cell: ({ row }) => {
          const eligible = row.original.statusDesign === ContentPlanStatusKerja.BARU;
          if (!eligible) {
            return (
              <span className="text-muted-foreground flex justify-center text-xs">—</span>
            );
          }
          return (
            <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={kanbanSet.has(row.original.id)}
                aria-label={`Tambahkan "${row.original.konten || "baris"}" ke Kanban`}
                onCheckedChange={() => toggleKanbanSelect(row.original.id)}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "konten",
        size: 280,
        minSize: 200,
        maxSize: 480,
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Konten (nama)">Konten</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const cellKey = `${row.original.id}:konten`;
          return (
            <InlineTextCell
              value={row.original.konten}
              active={activeCell === cellKey}
              onActivate={() => setActiveCell(cellKey)}
              onCommit={(next) => {
                if (next.trim() && next.trim() !== row.original.konten) {
                  void saveInlineRow(
                    row.original.id,
                    { konten: next.trim() },
                    cellKey,
                  );
                  return;
                }
                setActiveCell(null);
              }}
            />
          );
        },
      },
      {
        id: "jenis",
        accessorFn: (row) => row.jenisKonten,
        sortUndefined: "last",
        size: 104,
        minSize: 92,
        maxSize: 120,
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Jenis konten">Jenis</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const cellKey = `${row.original.id}:jenis`;
          return (
            <div className="min-w-0">
              <Select
                value={row.original.jenisKonten}
                items={jenisKontenSelectItems}
                disabled={inlineSavingCellRef.current === cellKey}
                onValueChange={(v, details) => {
                  if (!isInlineSelectUserPick(details)) return;
                  if (!v || v === row.original.jenisKonten) return;
                  if (
                    row.original.jenisKonten === ContentPlanJenis.CAROUSEL &&
                    v !== ContentPlanJenis.CAROUSEL &&
                    row.original.designFilePaths.length > 1
                  ) {
                    const extra = row.original.designFilePaths.length - 1;
                    if (
                      !confirm(
                        `Mengubah jenis dari Carousel akan menghapus ${extra} slide design secara permanen (hanya slide pertama disimpan). Lanjutkan?`,
                      )
                    ) {
                      return;
                    }
                  }
                  void saveInlineRow(
                    row.original.id,
                    { jenisKonten: v as ContentPlanJenis },
                    cellKey,
                  );
                }}
              >
                <SelectTrigger className={INLINE_SELECT_TRIGGER}>
                  <JenisBadge jenis={row.original.jenisKonten} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.values(ContentPlanJenis) as ContentPlanJenis[]).map((j) => (
                    <SelectItem key={j} value={j}>
                      <div className="py-0.5">
                        <JenisBadge jenis={j} />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
      {
        id: "usage",
        accessorFn: (row) => row.usage,
        sortUndefined: "last",
        size: 120,
        minSize: 100,
        maxSize: 140,
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Usage funnel">Usage</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const cellKey = `${row.original.id}:usage`;
          const storedUsage = row.original.usage ?? ContentPlanUsage.AWARENESS;
          return (
            <div className="min-w-0">
              <Select
                value={storedUsage}
                items={usageSelectItems}
                disabled={inlineSavingCellRef.current === cellKey}
                onValueChange={(v, details) => {
                  if (!isInlineSelectUserPick(details)) return;
                  if (!v || v === storedUsage) return;
                  void saveInlineRow(
                    row.original.id,
                    { usage: v as ContentPlanUsage },
                    cellKey,
                  );
                }}
              >
                <SelectTrigger className={INLINE_SELECT_TRIGGER}>
                  <UsageBadge usage={storedUsage} />
                </SelectTrigger>
                <SelectContent hideScrollButtons align="start" side="bottom" sideOffset={6}>
                  {(Object.values(ContentPlanUsage) as ContentPlanUsage[]).map((u) => (
                    <SelectItem key={u} value={u}>
                      <div className="py-0.5">
                        <UsageBadge usage={u} />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
      {
        id: "detail",
        accessorFn: (row) => (row.detailKonten ?? "").toLowerCase(),
        size: 200,
        minSize: 140,
        maxSize: 320,
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Detail konten">Detail</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const t = row.original.detailKonten;
          if (!t?.trim()) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className="text-muted-foreground line-clamp-3 min-w-0 max-w-full break-words text-xs"
              title={t}
            >
              {t}
            </span>
          );
        },
      },
      {
        id: "cw",
        accessorFn: (row) =>
          [row.copywritingFilePath, row.copywritingLink].filter(Boolean).join(" "),
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="File copywriting">Copy</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const hasFile = Boolean(row.original.copywritingFilePath);
          const hasLink = Boolean(row.original.copywritingLink?.trim());
          const showDownload =
            contentPlanHasStoredFiles(row.original) &&
            row.original.designFilePaths.length === 0;
          if (!hasFile && !hasLink && !showDownload) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          return (
            <div className="flex min-w-0 max-w-full flex-col gap-1 text-xs">
              <div className="flex items-center gap-1">
                {hasFile ? (
                  <FileLink path={row.original.copywritingFilePath} short="Buka file" />
                ) : null}
                {showDownload ? (
                  <ContentPlanDownloadButton
                    roomId={roomId}
                    row={row.original}
                    size="icon-xs"
                    showLabel={false}
                  />
                ) : null}
              </div>
              {hasLink ? (
                <ExternalOrText value={row.original.copywritingLink} />
              ) : null}
            </div>
          );
        },
      },
      {
        id: "design",
        accessorFn: (row) =>
          row.designFilePaths.length + (row.designLink?.trim() ? 1 : 0),
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Link / pratinjau file design">Design</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => (
          <DesignTableCell
            roomId={roomId}
            row={row.original}
            onPreview={(previewTarget) => {
              setPreviewRow(previewTarget);
              setPreviewIndex(0);
            }}
          />
        ),
      },
      {
        id: "pic",
        accessorFn: (row) =>
          (row.pics ?? [])
            .map((p) => (p.name?.trim() || p.email).toLowerCase())
            .join(", "),
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Penanggung jawab">PIC</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => <PicCell pics={row.original.pics ?? []} />,
      },
      {
        id: "stCw",
        accessorFn: (row) => row.statusCopywriting,
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span
              className={cn(STATUS_COL_BOX, "inline-block leading-tight")}
              title="Status copywriting"
            >
              Status
              <br />
              copy
            </span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const cellKey = `${row.original.id}:stCw`;
          return (
            <div className={STATUS_COL_BOX}>
              <Select
                value={row.original.statusCopywriting}
                items={statusKerjaSelectItems}
                disabled={inlineSavingCellRef.current === cellKey}
                onValueChange={(v, details) => {
                  if (!isInlineSelectUserPick(details)) return;
                  if (!v || v === row.original.statusCopywriting) return;
                  void saveInlineRow(
                    row.original.id,
                    { statusCopywriting: v as ContentPlanStatusKerja },
                    cellKey,
                  );
                }}
              >
                <SelectTrigger className={STATUS_SELECT_TRIGGER}>
                  <StatusBadge status={row.original.statusCopywriting} />
                </SelectTrigger>
                <SelectContent hideScrollButtons align="start" side="bottom" sideOffset={6}>
                  {(Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="py-0.5">
                        <StatusBadge status={s} />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
      {
        id: "stDes",
        accessorFn: (row) => row.statusDesign,
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span
              className={cn(STATUS_COL_BOX, "inline-block leading-tight")}
              title="Status design"
            >
              Status
              <br />
              design
            </span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const cellKey = `${row.original.id}:stDes`;
          return (
            <div className={STATUS_COL_BOX}>
              <Select
                value={row.original.statusDesign}
                items={statusKerjaSelectItems}
                disabled={inlineSavingCellRef.current === cellKey}
                onValueChange={(v, details) => {
                  if (!isInlineSelectUserPick(details)) return;
                  if (!v || v === row.original.statusDesign) return;
                  void saveInlineRow(
                    row.original.id,
                    { statusDesign: v as ContentPlanStatusKerja },
                    cellKey,
                  );
                }}
              >
                <SelectTrigger className={STATUS_SELECT_TRIGGER}>
                  <StatusBadge status={row.original.statusDesign} />
                </SelectTrigger>
                <SelectContent hideScrollButtons align="start" side="bottom" sideOffset={6}>
                  {(Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="py-0.5">
                        <StatusBadge status={s} />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
      {
        id: "dlCw",
        accessorFn: (row) => cpDateSortValue(row.deadlineCopywriting),
        sortUndefined: "last",
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span className="inline-block max-w-[3.75rem] leading-tight" title="Deadline copywriting">
              DL
              <br />
              copy
            </span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{formatDateShort(row.original.deadlineCopywriting)}</span>
        ),
      },
      {
        id: "dlDes",
        accessorFn: (row) => cpDateSortValue(row.deadlineDesign),
        sortUndefined: "last",
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span className="inline-block max-w-[3.75rem] leading-tight" title="Deadline design">
              DL
              <br />
              design
            </span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{formatDateShort(row.original.deadlineDesign)}</span>
        ),
      },
      {
        id: "post",
        accessorFn: (row) => {
          const base = cpDateSortValue(row.tanggalPosting);
          if (base === null) return null;
          return base + jamPostingMinutes(row.jamPosting) * 60_000;
        },
        sortUndefined: "last",
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Tanggal & jam postingan">Posting</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const dayKey = cpPostingDayKey(row.original.tanggalPosting);
          const info = dayKey ? postingDayInfo.get(dayKey) : undefined;
          const crowded = (info?.count ?? 0) > 1;
          const problem = crowded && ((info?.missingJam ?? 0) > 0 || info?.dupJam);
          return (
            <div className="flex min-w-0 flex-col gap-0.5 text-xs">
              <span className="text-muted-foreground whitespace-nowrap">
                {formatDateShort(row.original.tanggalPosting)}
                {row.original.jamPosting ? (
                  <span className="text-foreground/80"> • {row.original.jamPosting}</span>
                ) : null}
              </span>
              {crowded ? (
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-semibold tabular-nums",
                    problem
                      ? "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300"
                      : "border-border bg-muted/40 text-muted-foreground",
                  )}
                  title={
                    problem
                      ? `${info!.count} konten di hari yang sama — ada jam yang kosong/bentrok, atur jam agar pembagiannya efektif.`
                      : `${info!.count} konten di hari yang sama — jam sudah terbagi.`
                  }
                >
                  <Clock className="size-2.5" aria-hidden />
                  {info!.count}×
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "catatan",
        accessorFn: (row) => (row.catatan ?? "").toLowerCase(),
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Catatan internal">Cat.</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => {
          const t = row.original.catatan;
          if (!t?.trim()) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className="text-muted-foreground line-clamp-2 min-w-0 max-w-full break-words text-xs"
              title={t}
            >
              {t}
            </span>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: "",
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "size-8",
                )}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(row.original)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(row.original.id)}
                >
                  <Trash2 className="size-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [
      activeCell,
      allKanbanSelected,
      jenisKontenSelectItems,
      kanbanEligibleCount,
      kanbanEligibleIds,
      kanbanSet,
      onDelete,
      openEdit,
      postingDayInfo,
      roomId,
      saveInlineRow,
      statusKerjaSelectItems,
      toggleKanbanSelect,
      usageSelectItems,
    ],
  );

  const editingPaths = editing?.designFilePaths ?? [];
  const editingId = editing?.id;

  const hasActiveFilters = activeFilterCount > 0 || searchQuery.trim().length > 0;
  const filteredCount = filteredRows.length;
  const totalCount = tableRows.length;

  return (
    <div
      data-content-plan-shell
      className="flex min-w-0 flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden"
    >
      <div className="border-border bg-card flex shrink-0 flex-wrap items-center gap-2 rounded-xl border p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="border-border bg-background/70 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
            <Layers className="size-3.5 opacity-70" aria-hidden /> {stats.total} total
          </span>
          <span className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
            ✓ {stats.published} terbit
          </span>
          <span className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
            ↻ {stats.inProgress} proses
          </span>
          <span className="border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
            • {stats.fresh} baru
          </span>
        </div>
        <div className="border-input focus-within:border-ring focus-within:ring-ring/40 bg-background/40 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 transition-colors focus-within:ring-2 sm:max-w-md">
          <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari konten / detail…"
            className="placeholder:text-muted-foreground h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Bersihkan pencarian"
              onClick={() => setSearchQuery("")}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={showFilters || activeFilterCount > 0 ? "secondary" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <ListFilter className="size-3.5" />
          Filter
          {activeFilterCount > 0 ? (
            <span className="bg-primary text-primary-foreground ml-1 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
        {hasActiveFilters ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={resetFilters}
          >
            <X className="size-3.5" />
            Reset
          </Button>
        ) : null}
        {hasActiveFilters ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {filteredCount} dari {totalCount}
          </span>
        ) : null}
        <span className="ml-auto" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiSuggestPending || !hasScheduledPosting}
          title={
            hasScheduledPosting
              ? "Minta AI menyarankan jam posting efektif (WIB) untuk konten terjadwal — terutama hari dengan lebih dari satu postingan."
              : "Isi tanggal posting minimal satu baris dulu untuk meminta saran jam."
          }
          onClick={onAiSuggest}
        >
          <Sparkles className="size-4" />
          {aiSuggestPending ? "Menganalisis…" : "Saran Jam AI"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!kanbanProjectId || kanbanPending || kanbanSelectedIds.length === 0}
          title={
            !kanbanProjectId
              ? "Butuh minimal satu proyek di ruangan ini untuk membuat tugas Kanban."
              : kanbanSelectedIds.length === 0
                ? "Centang satu atau lebih baris (status design Baru), lalu tambahkan ke Kanban."
                : "Buat tugas design di Kanban untuk baris yang dicentang."
          }
          onClick={() => {
            if (!kanbanProjectId || kanbanSelectedIds.length === 0) return;
            startKanban(async () => {
              try {
                const { created, skipped } = await createKanbanTasksFromContentPlanDesign({
                  roomId,
                  projectId: kanbanProjectId,
                  itemIds: kanbanSelectedIds,
                });
                toast.success(
                  `Kanban: ${created} tugas design dibuat${skipped ? `, ${skipped} dilewati (bukan Baru / sudah ada tugas).` : "."}`,
                );
                setKanbanSelectedIds([]);
                router.refresh();
              } catch (e) {
                toast.error(actionErrorMessage(e, "Gagal menambahkan ke Kanban."));
              }
            });
          }}
        >
          <LayoutGrid className="size-4" />
          {kanbanPending ? "Memproses…" : "Tambahkan ke Kanban"}
        </Button>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          Baris baru
        </Button>
        <Sheet
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <SheetContent
            side="right"
            showCloseButton
            className="data-[side=right]:sm:max-w-2xl flex w-full max-w-full flex-col gap-0 border-l p-0 lg:max-w-[min(42rem,100vw-2rem)]"
          >
            <SheetHeader className="border-border shrink-0 space-y-1 border-b px-6 py-5 text-left">
              <SheetTitle className="text-lg">
                {editing ? "Edit baris content planning" : "Baris content planning baru"}
              </SheetTitle>
              <SheetDescription>
                Isi per blok. Tombol Simpan juga mengunggah file copywriting dan design
                yang dipilih pada langkah yang sama.
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <LayoutList className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Ringkasan konten</CardTitle>
                  </div>
                  <CardDescription>Nama, format, dan PIC.</CardDescription>
                </CardHeader>
                <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-konten">Konten (nama)</Label>
                    <Input
                      id="cp-konten"
                      value={konten}
                      onChange={(e) => setKonten(e.target.value)}
                      placeholder="Judul atau nama konten"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jenis konten</Label>
                    <Select
                      value={jenisKonten}
                      items={jenisKontenSelectItems}
                      onValueChange={(v) => {
                        if (v) setJenisKonten(v as ContentPlanJenis);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.values(ContentPlanJenis) as ContentPlanJenis[]).map(
                          (j) => (
                            <SelectItem key={j} value={j}>
                              <div className="py-0.5">
                                <JenisBadge jenis={j} />
                              </div>
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Usage</Label>
                    <Select
                      value={usage}
                      items={usageSelectItems}
                      onValueChange={(v) => {
                        if (v) setUsage(v as ContentPlanUsage);
                      }}
                    >
                      <SelectTrigger>
                        <UsageBadge usage={usage} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.values(ContentPlanUsage) as ContentPlanUsage[]).map(
                          (u) => (
                            <SelectItem key={u} value={u}>
                              <div className="py-0.5">
                                <UsageBadge usage={u} />
                              </div>
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="inline-flex items-center gap-1.5">
                      <UserCircle className="size-3.5 opacity-70" />
                      PIC
                    </Label>
                    <div className="border-border bg-muted/20 max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                      {picUserOptions.map((u) => {
                        const checked = picUserIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setPicUserIds((prev) => {
                                  if (v) return [...prev, u.id];
                                  return prev.filter((id) => id !== u.id);
                                });
                              }}
                            />
                            <span>{u.name ?? u.email}</span>
                          </label>
                        );
                      })}
                      {picUserOptions.length === 0 ? (
                        <p className="text-muted-foreground px-2 py-1 text-xs">Belum ada anggota.</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-detail">Detail konten</Label>
                    <Textarea
                      id="cp-detail"
                      rows={4}
                      value={detailKonten}
                      onChange={(e) => setDetailKonten(e.target.value)}
                      placeholder="Brief, angle, CTA, referensi…"
                    />
                  </div>
                </div>
              </Card>

              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Copywriting</CardTitle>
                  </div>
                  <CardDescription>Link eksternal atau unggah satu file pendukung.</CardDescription>
                </CardHeader>
                <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-cw-link">Link / teks (opsional)</Label>
                    <Input
                      id="cp-cw-link"
                      value={copywritingLink}
                      onChange={(e) => setCopywritingLink(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Unggah file</Label>
                    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-lg border border-dashed p-3">
                      <Input
                        ref={copyFileRef}
                        type="file"
                        className="text-muted-foreground cursor-pointer text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent/30 file:px-2 file:py-1 file:text-xs file:font-medium"
                      />
                      <p className="text-muted-foreground text-[11px]">
                        Maks. {MAX_UPLOAD_LABEL} — dokumen, PDF, gambar, zip.
                      </p>
                    </div>
                    {editing?.copywritingFilePath ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <a
                          href={editing.copywritingFilePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-foreground text-xs font-medium underline-offset-2 hover:underline"
                        >
                          File terunggah
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-destructive h-7"
                          onClick={async () => {
                            try {
                              await clearContentPlanCopywritingFile(roomId, editing.id);
                              toast.success("File copywriting dihapus.");
                              setEditing((prev) =>
                                prev ? { ...prev, copywritingFilePath: null } : prev,
                              );
                              router.refresh();
                            } catch (e) {
                              toast.error(
                                actionErrorMessage(e, "Gagal menghapus file."));
                            }
                          }}
                        >
                          Hapus file
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Design</CardTitle>
                  </div>
                  <CardDescription>
                    {isCarousel
                      ? "Carousel: tampilan slide rapi di bawah. Unggah beberapa gambar sekaligus (multi-select)."
                      : "Reels / Single feed: satu file design utama."}
                  </CardDescription>
                </CardHeader>
                <div className="space-y-4 px-4 pb-4">
                  <div className="space-y-2">
                    <Label htmlFor="cp-des-link">Link design (opsional)</Label>
                    <Input
                      id="cp-des-link"
                      value={designLink}
                      onChange={(e) => setDesignLink(e.target.value)}
                      placeholder="https://… Figma, Drive, dll."
                    />
                  </div>

                  {editingId && isCarousel ? (
                    <CarouselDesignRail
                      paths={editingPaths}
                      roomId={roomId}
                      itemId={editingId}
                      onPathsChange={(next) =>
                        setEditing((prev) =>
                          prev ? { ...prev, designFilePaths: next } : prev,
                        )
                      }
                    />
                  ) : editingId && !isCarousel && editingPaths[0] ? (
                    <div className="border-border bg-muted/20 flex max-w-xs items-center gap-3 rounded-xl border p-3">
                      {isImagePath(editingPaths[0]) ? (
                        <Image
                          src={editingPaths[0]}
                          alt=""
                          width={72}
                          height={72}
                          className="border-border size-[72px] rounded-lg border object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="border-border bg-background flex size-[72px] items-center justify-center rounded-lg border">
                          <FileText className="text-muted-foreground size-8" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <a
                          href={editingPaths[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-foreground text-sm font-medium underline-offset-2 hover:underline"
                        >
                          Buka file design
                        </a>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="text-destructive mt-1"
                          onClick={async () => {
                            try {
                              await clearContentPlanDesignFiles(roomId, editingId);
                              setEditing((prev) =>
                                prev ? { ...prev, designFilePaths: [] } : prev,
                              );
                              toast.success("File design dihapus.");
                              router.refresh();
                            } catch (e) {
                              toast.error(
                                actionErrorMessage(e, "Gagal menghapus."));
                            }
                          }}
                        >
                          Ganti file
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>
                      {isCarousel ? "Tambah slide (boleh banyak file)" : "Unggah / ganti file design"}
                    </Label>
                    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-lg border border-dashed p-3">
                      <Input
                        ref={designFileRef}
                        type="file"
                        multiple={isCarousel}
                        accept={
                          isCarousel
                            ? "image/*,.pdf,.doc,.docx,application/pdf"
                            : "image/*,video/*,.pdf,.doc,.docx,application/pdf"
                        }
                        className="text-muted-foreground cursor-pointer text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent/30 file:px-2 file:py-1 file:text-xs file:font-medium"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          if (picked.length === 0) return;
                          setQueuedDesignFiles((prev) =>
                            isCarousel ? [...prev, ...picked] : [picked[0]!],
                          );
                          e.currentTarget.value = "";
                        }}
                      />
                      <p className="text-muted-foreground text-[11px]">
                        {isCarousel
                          ? "Pilih file berkali-kali untuk menambah antrean slide. Semua file di bawah akan diunggah saat klik Simpan."
                          : "Satu file menggantikan file sebelumnya. Simpan form setelah memilih file."}
                      </p>
                    </div>
                    {queuedDesignFiles.length > 0 ? (
                      <div className="bg-background border-border space-y-2 rounded-lg border p-2.5">
                        <p className="text-muted-foreground text-[11px] font-medium">
                          Antrean upload ({queuedDesignFiles.length} file)
                        </p>
                        <div className="max-h-40 space-y-1 overflow-y-auto">
                          {queuedDesignFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${file.size}-${idx}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-2 py-1.5"
                            >
                              <span className="min-w-0 truncate text-xs">
                                {idx + 1}. {file.name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Hapus antrean ${file.name}`}
                                onClick={() =>
                                  setQueuedDesignFiles((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => setQueuedDesignFiles([])}
                          >
                            Kosongkan antrean
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Status & jadwal</CardTitle>
                  </div>
                  <CardDescription>Alur kerja dan deadline.</CardDescription>
                </CardHeader>
                <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status copywriting</Label>
                    <Select
                      value={statusCopywriting}
                      items={statusKerjaSelectItems}
                      onValueChange={(v) => {
                        if (v) setStatusCopywriting(v as ContentPlanStatusKerja);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status design</Label>
                    <Select
                      value={statusDesign}
                      items={statusKerjaSelectItems}
                      onValueChange={(v) => {
                        if (v) setStatusDesign(v as ContentPlanStatusKerja);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-dl-cw">Deadline copywriting</Label>
                    <Input
                      id="cp-dl-cw"
                      type="date"
                      value={deadlineCopywriting}
                      onChange={(e) => setDeadlineCopywriting(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-dl-des">Deadline design</Label>
                    <Input
                      id="cp-dl-des"
                      type="date"
                      value={deadlineDesign}
                      onChange={(e) => setDeadlineDesign(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-post">Tanggal postingan</Label>
                    <Input
                      id="cp-post"
                      type="date"
                      value={tanggalPosting}
                      onChange={(e) => setTanggalPosting(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-post-jam" className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5 opacity-70" />
                      Jam posting (WIB)
                    </Label>
                    <Input
                      id="cp-post-jam"
                      type="time"
                      value={jamPosting}
                      onChange={(e) => setJamPosting(e.target.value)}
                    />
                    <p className="text-muted-foreground text-[11px]">
                      Opsional — penting bila ada beberapa konten di hari yang sama.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="cp-cat" className="text-sm font-medium">
                  Catatan
                </Label>
                <Textarea
                  id="cp-cat"
                  rows={3}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan internal untuk tim…"
                  className="resize-none"
                />
              </div>
            </div>

            <Separator />

            <SheetFooter className="bg-background/95 supports-backdrop-filter:backdrop-blur-sm shrink-0 flex-row flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={onSave} disabled={pending || !konten.trim()}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filter pills (collapsible) */}
      {showFilters ? (
        <div className="border-border bg-muted/30 grid shrink-0 gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
              Jenis
            </Label>
            <Select
              value={jenisFilter}
              items={jenisFilterItems}
              onValueChange={(v) =>
                setJenisFilter((v ?? "all") as ContentPlanJenis | "all")
              }
            >
              <SelectTrigger className="h-9 w-full">
                <span>
                  {jenisFilter === "all" ? "Semua jenis" : JENIS_LABEL[jenisFilter]}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua jenis</SelectItem>
                {(Object.values(ContentPlanJenis) as ContentPlanJenis[]).map((j) => (
                  <SelectItem key={j} value={j}>
                    {JENIS_LABEL[j]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
              Status copy
            </Label>
            <Select
              value={statusCwFilter}
              items={statusFilterItems}
              onValueChange={(v) =>
                setStatusCwFilter((v ?? "all") as ContentPlanStatusKerja | "all")
              }
            >
              <SelectTrigger className="h-9 w-full">
                <span>
                  {statusCwFilter === "all"
                    ? "Semua status"
                    : STATUS_LABEL[statusCwFilter]}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {(
                  Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
              Status design
            </Label>
            <Select
              value={statusDesignFilter}
              items={statusFilterItems}
              onValueChange={(v) =>
                setStatusDesignFilter((v ?? "all") as ContentPlanStatusKerja | "all")
              }
            >
              <SelectTrigger className="h-9 w-full">
                <span>
                  {statusDesignFilter === "all"
                    ? "Semua status"
                    : STATUS_LABEL[statusDesignFilter]}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {(
                  Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
              PIC
            </Label>
            <Select
              value={picFilter}
              items={picFilterItems}
              onValueChange={(v) => setPicFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9 w-full">
                <span>
                  {picFilter === "all"
                    ? "Semua PIC"
                    : picUserOptions.find((u) => u.id === picFilter)?.name ??
                      picUserOptions.find((u) => u.id === picFilter)?.email ??
                      "PIC"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua PIC</SelectItem>
                {picUserOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name?.trim() || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 max-w-full md:hidden">
        {filteredRows.length === 0 ? (
          <div className="text-muted-foreground rounded-xl border border-border px-4 py-8 text-center text-sm">
            {hasActiveFilters
              ? "Tidak ada baris yang cocok dengan filter / pencarian."
              : "Belum ada baris. Tambahkan konten lewat tombol Baris baru."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => (
              <Card key={row.id} size="sm" className="shadow-none ring-border/60">
                <div className="space-y-3 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    {row.statusDesign === ContentPlanStatusKerja.BARU ? (
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={kanbanSet.has(row.id)}
                          aria-label={`Tambahkan "${row.konten || "baris"}" ke Kanban`}
                          onCheckedChange={() => toggleKanbanSelect(row.id)}
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground w-5 shrink-0 text-center text-xs" title="Hanya status design Baru yang bisa ditambahkan ke Kanban">
                        —
                      </span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className="text-sm leading-snug font-semibold whitespace-normal break-words"
                        title={row.konten?.trim() || undefined}
                      >
                        {row.konten || "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <JenisBadge jenis={row.jenisKonten} />
                        <UsageBadge usage={row.usage ?? ContentPlanUsage.AWARENESS} />
                        {(row.pics?.length ?? 0) > 0 ? (
                          <span className="text-muted-foreground text-xs">
                            PIC: {(row.pics ?? [])
                              .map((p) => p.name?.trim() || p.email)
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">PIC: —</span>
                        )}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon-sm" }),
                            "size-8",
                          )}
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(row.id)}
                          >
                            <Trash2 className="size-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[11px] uppercase">Status Copy</p>
                      <StatusBadge status={row.statusCopywriting} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[11px] uppercase">Status Design</p>
                      <StatusBadge status={row.statusDesign} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">DL Copy</p>
                      <p>{formatDateShort(row.deadlineCopywriting)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">DL Design</p>
                      <p>{formatDateShort(row.deadlineDesign)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Posting</p>
                      <p>
                        {formatDateShort(row.tanggalPosting)}
                        {row.jamPosting ? ` • ${row.jamPosting}` : ""}
                      </p>
                    </div>
                  </div>

                  {row.detailKonten?.trim() ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs">{row.detailKonten}</p>
                  ) : null}
                  {(row.designFilePaths?.length ?? 0) > 0 ? (
                    <div className="flex items-center gap-1 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className="size-6 shrink-0"
                        aria-label={`Preview ${JENIS_LABEL[row.jenisKonten]}`}
                        title="Preview"
                        onClick={() => {
                          setPreviewRow(row);
                          setPreviewIndex(0);
                        }}
                      >
                        <Eye className="size-3" />
                      </Button>
                      <ContentPlanDownloadButton
                        roomId={roomId}
                        row={row}
                        size="icon-xs"
                        showLabel={false}
                      />
                    </div>
                  ) : contentPlanHasStoredFiles(row) ? (
                    <div className="flex items-center gap-1 pt-1">
                      <ContentPlanDownloadButton
                        roomId={roomId}
                        row={row}
                        size="icon-xs"
                        showLabel={false}
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="hidden min-w-0 max-w-full md:flex md:min-h-0 md:flex-1 md:flex-col">
        <DataTable
          columns={columns}
          data={filteredRows}
          empty={
            hasActiveFilters
              ? "Tidak ada baris yang cocok dengan filter / pencarian."
              : "Belum ada baris. Tambahkan konten lewat tombol Baris baru."
          }
          fitViewport
          sortable
          stickyHeader
          viewportHeight="100%"
        />
      </div>

      <Dialog
        open={previewRow !== null}
        onOpenChange={(openState) => {
          if (!openState) {
            setPreviewRow(null);
            setPreviewIndex(0);
          }
        }}
      >
        <DialogContent
          className={cn(
            "max-w-md",
            previewRow?.jenisKonten === ContentPlanJenis.REELS &&
              "max-w-[min(100vw-2rem,380px)] gap-3 p-4",
          )}
        >
          <DialogHeader className="pb-0">
            <DialogTitle>
              {previewRow ? previewDialogTitle(previewRow.jenisKonten) : "Preview"}
            </DialogTitle>
          </DialogHeader>
          <ContentPlanPreviewDialog
            row={previewRow}
            index={previewIndex}
            onIndexChange={setPreviewIndex}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={aiSuggestions !== null}
        onOpenChange={(openState) => {
          if (!openState) {
            setAiSuggestions(null);
            setAiSelectedIds(new Set());
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-3">
          <DialogHeader className="pb-0">
            <DialogTitle className="inline-flex items-center gap-2">
              <Sparkles className="text-accent-foreground size-4" />
              Saran Jam Posting (AI)
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-xs">
            Jam dalam WIB. Konten di hari yang sama disebar agar tidak saling memakan
            reach. Hilangkan centang pada saran yang tidak ingin diterapkan.
          </p>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {aiGroups.map(([dateKey, group]) => (
              <div key={dateKey} className="space-y-1.5">
                <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] uppercase">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {formatDayKeyLabel(dateKey)}
                  <span className="tabular-nums">({group.length} konten)</span>
                </p>
                <div className="space-y-1.5">
                  {group.map((s) => {
                    const checked = aiSelectedIds.has(s.itemId);
                    return (
                      <label
                        key={s.itemId}
                        className="border-border hover:bg-muted/40 flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5"
                      >
                        <Checkbox
                          checked={checked}
                          className="mt-0.5"
                          onCheckedChange={(v) => {
                            setAiSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(s.itemId);
                              else next.delete(s.itemId);
                              return next;
                            });
                          }}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="min-w-0 break-words text-sm font-medium leading-snug">
                              {s.konten || "(Tanpa judul)"}
                            </span>
                            <JenisBadge jenis={s.jenisKonten} />
                          </div>
                          <p className="text-xs tabular-nums">
                            <span className="text-muted-foreground">
                              {s.currentJam ?? "belum ada jam"}
                            </span>{" "}
                            <span aria-hidden>→</span>{" "}
                            <span className="font-semibold">{s.jam} WIB</span>
                          </p>
                          <p className="text-muted-foreground text-xs leading-snug">
                            {s.alasan}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
            <span className="text-muted-foreground mr-auto text-xs tabular-nums">
              {aiSelectedCount} dari {aiSuggestions?.length ?? 0} dipilih
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAiSuggestions(null);
                setAiSelectedIds(new Set());
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={aiApplyPending || aiSelectedCount === 0}
              onClick={onAiApply}
            >
              {aiApplyPending
                ? "Menerapkan…"
                : `Terapkan${aiSelectedCount ? ` (${aiSelectedCount})` : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
