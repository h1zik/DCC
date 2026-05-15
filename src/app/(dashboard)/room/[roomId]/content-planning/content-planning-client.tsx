"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ContentPlanJenis,
  ContentPlanStatusKerja,
  type User,
} from "@prisma/client";
import { toast } from "sonner";
import { createKanbanTasksFromContentPlanDesign } from "@/actions/content-plan-to-kanban";
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
import { MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Heart,
  LayoutGrid,
  Layers,
  LayoutList,
  ListFilter,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserCircle,
  X,
} from "lucide-react";
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
  catatan: string | null;
  pic: Pick<User, "id" | "name" | "email" | "image"> | null;
  pics?: Pick<User, "id" | "name" | "email" | "image">[];
  createdBy: Pick<User, "id" | "name" | "email">;
};

type PicOption = Pick<User, "id" | "name" | "email" | "image">;

function toDateInput(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
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

function ExternalOrText({ value }: { value: string | null }) {
  if (!value?.trim()) return <span className="text-muted-foreground">—</span>;
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
  if (!path) return <span className="text-muted-foreground">—</span>;
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
  row,
  onPreview,
}: {
  row: ContentPlanTableRow;
  onPreview?: (row: ContentPlanTableRow) => void;
}) {
  const paths = row.designFilePaths ?? [];
  const isCarousel = row.jenisKonten === ContentPlanJenis.CAROUSEL;
  if (paths.length === 0) {
    return (
      <div className="flex min-w-0 max-w-full flex-col gap-1 text-xs">
        <span className="text-muted-foreground">—</span>
        <ExternalOrText value={row.designLink} />
      </div>
    );
  }
  /** Di tabel: carousel tidak tampilkan strip thumbnail (hemat tinggi baris). */
  if (isCarousel) {
    return (
      <div className="flex min-w-0 max-w-full flex-col gap-1.5 text-xs">
        <p className="text-muted-foreground">
          {paths.length} slide
        </p>
        {onPreview ? (
          <div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onPreview(row)}
            >
              <Eye className="size-3.5" />
              Preview
            </Button>
          </div>
        ) : null}
        <ExternalOrText value={row.designLink} />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1 text-xs">
      <FileLink path={paths[0] ?? null} short="Unduh file" />
      <ExternalOrText value={row.designLink} />
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

function CarouselPreviewDialog({
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
  const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
  const current = slides[safeIndex]!;
  const isImage = isImagePath(current);
  const caption = row.detailKonten?.trim() || "Preview caption untuk simulasi posting.";
  const creator = row.createdBy.name?.trim() || row.createdBy.email;
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
              <p className="text-muted-foreground truncate text-[10px]">
                {row.konten || "Konten carousel"}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Lainnya">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
        <div className="bg-muted/30 relative aspect-[4/5] w-full">
          {isImage ? (
            <Image
              src={current}
              alt={`Slide ${safeIndex + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2">
              <FileText className="size-10" />
              <p className="text-sm">Pratinjau file non-gambar</p>
            </div>
          )}
        </div>
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
        <div className="space-y-1 px-3 pb-3">
          <p className="text-[11px] font-semibold">Disukai 128 akun</p>
          <p className="text-muted-foreground line-clamp-2 text-[11px]">
            <span className="text-foreground font-semibold">{creator}</span>{" "}
            {caption}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-center text-xs">
        Simulasi tampilan carousel saat sudah diposting.
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
  const [catatan, setCatatan] = useState("");
  const [pending, setPending] = useState(false);
  const [kanbanPending, startKanban] = useTransition();
  const [tableRows, setTableRows] = useState<ContentPlanTableRow[]>(items);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [inlineSavingCell, setInlineSavingCell] = useState<string | null>(null);
  const [queuedDesignFiles, setQueuedDesignFiles] = useState<File[]>([]);
  const [previewRow, setPreviewRow] = useState<ContentPlanTableRow | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [kanbanSelectedIds, setKanbanSelectedIds] = useState<string[]>([]);

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
        picUserIds: ids,
        pics: pics.length ? pics : row.pic ? [row.pic] : [],
      };
    },
    [picUserById],
  );

  useEffect(() => {
    setTableRows(items.map(withResolvedPics));
  }, [items, withResolvedPics]);

  useEffect(() => {
    const eligible = new Set(
      tableRows
        .filter((r) => r.statusDesign === ContentPlanStatusKerja.BARU)
        .map((r) => r.id),
    );
    setKanbanSelectedIds((prev) => prev.filter((id) => eligible.has(id)));
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

  const statusKerjaSelectItems = useMemo((): SelectItemDef[] => {
    return (
      Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
    ).map((s) => ({ value: s, label: STATUS_LABEL[s] }));
  }, []);

  const reset = useCallback(() => {
    setEditing(null);
    setKonten("");
    setJenisKonten(ContentPlanJenis.REELS);
    setDetailKonten("");
    setCopywritingLink("");
    setDesignLink("");
    setPicUserIds([]);
    setStatusCopywriting(ContentPlanStatusKerja.BARU);
    setStatusDesign(ContentPlanStatusKerja.BARU);
    setDeadlineCopywriting("");
    setDeadlineDesign("");
    setTanggalPosting("");
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
    setDetailKonten(row.detailKonten ?? "");
    setCopywritingLink(row.copywritingLink ?? "");
    setDesignLink(row.designLink ?? "");
    setPicUserIds(row.picUserIds?.length ? row.picUserIds : row.picUserId ? [row.picUserId] : []);
    setStatusCopywriting(row.statusCopywriting);
    setStatusDesign(row.statusDesign);
    setDeadlineCopywriting(toDateInput(row.deadlineCopywriting));
    setDeadlineDesign(toDateInput(row.deadlineDesign));
    setTanggalPosting(toDateInput(row.tanggalPosting));
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
        detailKonten: detailKonten.trim() || null,
        copywritingLink: copywritingLink.trim() || null,
        designLink: designLink.trim() || null,
        picUserIds,
        statusCopywriting,
        statusDesign,
        deadlineCopywriting: dc,
        deadlineDesign: dd,
        tanggalPosting: tp,
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

  async function saveInlineRow(
    rowId: string,
    patch: Partial<ContentPlanTableRow>,
    cellKey: string,
  ) {
    const prev = tableRows.find((r) => r.id === rowId);
    if (!prev) return;
    const nextRow = { ...prev, ...patch };
    setInlineSavingCell(cellKey);
    setTableRows((rows) => rows.map((r) => (r.id === rowId ? nextRow : r)));
    try {
      await upsertRoomContentPlanItem({
        id: nextRow.id,
        roomId,
        konten: nextRow.konten,
        jenisKonten: nextRow.jenisKonten,
        detailKonten: nextRow.detailKonten ?? null,
        copywritingLink: nextRow.copywritingLink ?? null,
        designLink: nextRow.designLink ?? null,
        picUserIds: nextRow.picUserIds ?? [],
        statusCopywriting: nextRow.statusCopywriting,
        statusDesign: nextRow.statusDesign,
        deadlineCopywriting: nextRow.deadlineCopywriting
          ? new Date(nextRow.deadlineCopywriting)
          : null,
        deadlineDesign: nextRow.deadlineDesign
          ? new Date(nextRow.deadlineDesign)
          : null,
        tanggalPosting: nextRow.tanggalPosting
          ? new Date(nextRow.tanggalPosting)
          : null,
        catatan: nextRow.catatan ?? null,
      });
    } catch (e) {
      setTableRows((rows) => rows.map((r) => (r.id === rowId ? prev : r)));
      toast.error(actionErrorMessage(e, "Gagal menyimpan perubahan."));
    } finally {
      setInlineSavingCell(null);
      setActiveCell(null);
    }
  }

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
                disabled={inlineSavingCell === cellKey}
                onValueChange={(v) => {
                  if (!v || v === row.original.jenisKonten) return;
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
        cell: ({ row }) => (
          <div className="flex min-w-0 max-w-full flex-col gap-1 text-xs">
            <FileLink path={row.original.copywritingFilePath} short="Unduh file" />
            <ExternalOrText value={row.original.copywritingLink} />
          </div>
        ),
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
                disabled={inlineSavingCell === cellKey}
                onValueChange={(v) => {
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
                disabled={inlineSavingCell === cellKey}
                onValueChange={(v) => {
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
        accessorFn: (row) => cpDateSortValue(row.tanggalPosting),
        sortUndefined: "last",
        header: ({ column }) => (
          <CpColumnHeader column={column}>
            <span title="Tanggal postingan">Posting</span>
          </CpColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{formatDateShort(row.original.tanggalPosting)}</span>
        ),
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
      inlineSavingCell,
      jenisKontenSelectItems,
      kanbanEligibleCount,
      kanbanEligibleIds,
      kanbanSet,
      onDelete,
      openEdit,
      roomId,
      saveInlineRow,
      statusKerjaSelectItems,
      toggleKanbanSelect,
    ],
  );

  const editingPaths = editing?.designFilePaths ?? [];
  const editingId = editing?.id;

  const hasActiveFilters = activeFilterCount > 0 || searchQuery.trim().length > 0;
  const filteredCount = filteredRows.length;
  const totalCount = tableRows.length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Hero header */}
      <header className="border-border bg-card relative isolate overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="from-primary/8 absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
          aria-hidden
        />
        <div
          className="bg-primary/10 absolute -top-12 -right-12 size-40 rounded-full blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
              <ClipboardList className="size-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">
                Content planning
              </h2>
              <p className="text-muted-foreground text-sm">
                Tabel perencanaan konten per ruangan — PIC, status copywriting &amp;
                design, deadline, dan posting.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-border bg-background/70 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <Layers className="size-3.5 opacity-70" aria-hidden /> {stats.total} total
            </span>
            <span className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              ✓ {stats.published} terbit
            </span>
            <span className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              ↻ {stats.inProgress} proses
            </span>
            <span className="border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              • {stats.fresh} baru
            </span>
          </div>
        </div>
      </header>

      {/* Toolbar: search + filter toggle + actions */}
      <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-xl border p-2">
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
                              {JENIS_LABEL[j]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
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
                        accept="image/*,.pdf,.doc,.docx,application/pdf"
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-post">Tanggal postingan</Label>
                    <Input
                      id="cp-post"
                      type="date"
                      value={tanggalPosting}
                      onChange={(e) => setTanggalPosting(e.target.value)}
                    />
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
        <div className="border-border bg-muted/30 grid gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
              Jenis
            </Label>
            <Select
              value={jenisFilter}
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
                      <p>{formatDateShort(row.tanggalPosting)}</p>
                    </div>
                  </div>

                  {row.detailKonten?.trim() ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs">{row.detailKonten}</p>
                  ) : null}
                  {row.jenisKonten === ContentPlanJenis.CAROUSEL &&
                  (row.designFilePaths?.length ?? 0) > 0 ? (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setPreviewRow(row);
                          setPreviewIndex(0);
                        }}
                      >
                        <Eye className="size-3.5" />
                        Preview
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="hidden min-w-0 max-w-full md:block">
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
          viewportMaxHeight="min(70vh, calc(100dvh - 320px))"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview Carousel</DialogTitle>
          </DialogHeader>
          <CarouselPreviewDialog
            row={previewRow}
            index={previewIndex}
            onIndexChange={setPreviewIndex}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
