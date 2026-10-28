"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
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
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink,
  FileText,
  Film,
  GripVertical,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  clearContentPlanDesignFiles,
  removeContentPlanDesignSlide,
} from "@/actions/room-content-planning";
import { Button, buttonVariants } from "@/components/ui/button";
import { isContentPlanImagePath, isContentPlanVideoPath } from "@/lib/content-plan-ui";
import { MAX_DESIGN_SLIDES, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Model slide: tersimpan di server vs. antrean (diunggah saat Simpan) */
/* ------------------------------------------------------------------ */

export type SlideItem =
  | { kind: "saved"; id: string; path: string }
  | { kind: "queued"; id: string; file: File };

export type DesignSlidesPatch = { designFilePaths: string[]; feedCoverIndex: number };

export function savedSlide(path: string): SlideItem {
  return { kind: "saved", id: `s:${path}`, path };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export function queuedSlide(file: File): SlideItem {
  return { kind: "queued", id: `q:${newId()}`, file };
}

const CAROUSEL_ACCEPT = "image/*,.pdf,.doc,.docx,application/pdf";
const SINGLE_ACCEPT = "image/*,video/*,.pdf,.doc,.docx,application/pdf";
const DOC_EXT = /\.(pdf|doc|docx)$/i;

function designFileAllowed(file: File, allowVideo: boolean): boolean {
  const t = file.type.toLowerCase();
  if (t.startsWith("image/")) return true;
  if (allowVideo && t.startsWith("video/")) return true;
  if (t === "application/pdf" || t === "application/msword") return true;
  if (t.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml")) return true;
  return DOC_EXT.test(file.name);
}

/** Nama file yang ramah dibaca dari path publik `design-<uuid>-<nama>`. */
export function designFileLabel(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^design-[0-9a-f-]{36}-/i, "");
}

/* ------------------------------------------------------------------ */
/* Drop zone file (native drag & drop + tombol pilih)                    */
/* ------------------------------------------------------------------ */

function dragHasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes("Files");
}

export function FileDropZone({
  accept,
  multiple,
  disabled,
  onFiles,
  label,
  hint,
  compact,
  className,
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  hint?: string;
  compact?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef(0);
  const [over, setOver] = useState(false);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={label}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(e) => {
        if (disabled || !dragHasFiles(e)) return;
        e.preventDefault();
        depthRef.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (disabled || !dragHasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!dragHasFiles(e)) return;
        depthRef.current = Math.max(0, depthRef.current - 1);
        if (depthRef.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        depthRef.current = 0;
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "border-border bg-muted/20 text-muted-foreground flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 text-left text-xs transition-colors outline-none",
        "hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
        compact ? "py-2.5" : "py-4",
        over && "border-ring bg-accent/20 text-foreground",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.currentTarget.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <UploadCloud className="size-4 shrink-0 opacity-70" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block font-medium">{label}</span>
        {hint ? <span className="block text-[11px] leading-snug">{hint}</span> : null}
      </span>
      <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "shrink-0")}>
        Pilih file
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tile slide (sortable)                                                */
/* ------------------------------------------------------------------ */

type SlideMedia =
  | { kind: "image"; src: string; nextImage: boolean }
  | { kind: "video"; name: string }
  | { kind: "file"; name: string };

function SlideMediaView({ media }: { media: SlideMedia }) {
  if (media.kind === "image") {
    if (media.nextImage) {
      return (
        <Image
          src={media.src}
          alt=""
          width={184}
          height={230}
          unoptimized
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="h-full w-full object-cover"
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.src}
        alt=""
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="h-full w-full object-cover"
      />
    );
  }
  const Icon = media.kind === "video" ? Film : FileText;
  return (
    <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
      <Icon className="size-7 opacity-70" aria-hidden />
      <span className="line-clamp-2 w-full text-[10px] leading-tight break-all">{media.name}</span>
    </div>
  );
}

const TILE_CONTROL =
  "bg-background/90 text-foreground absolute z-10 flex size-6 items-center justify-center rounded-md shadow-sm transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

function SortableSlideTile({
  id,
  index,
  media,
  href,
  queued,
  isCover,
  sortable,
  disabled,
  onRemove,
}: {
  id: string;
  index: number;
  media: SlideMedia;
  href: string | null;
  queued: boolean;
  isCover: boolean;
  sortable: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: disabled || !sortable });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { zIndex: 30, position: "relative" as const } : null),
      }}
      className={cn(
        "group bg-card relative overflow-hidden rounded-xl border",
        queued ? "border-ring/60 border-dashed" : "border-border",
        isDragging && "ring-ring/60 opacity-90 shadow-xl ring-2",
      )}
      data-slide-index={index}
    >
      {/* Permukaan drag pointer = area gambar saja; tombol lain berada di luarnya. */}
      <div
        {...(sortable && !disabled ? listeners : null)}
        className={cn(
          "bg-muted/40 relative aspect-[4/5] w-full select-none",
          sortable && !disabled && "touch-none cursor-grab active:cursor-grabbing",
        )}
      >
        <SlideMediaView media={media} />
      </div>

      <span className="bg-background/90 text-foreground absolute top-1.5 left-1.5 z-10 rounded-md px-1.5 py-0.5 text-[11px] font-semibold shadow-sm tabular-nums">
        {index + 1}
      </span>

      {queued ? (
        <span className="bg-foreground text-background absolute bottom-1.5 left-1.5 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
          Baru
        </span>
      ) : isCover ? (
        <span className="bg-accent text-accent-foreground absolute bottom-1.5 left-1.5 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
          Cover
        </span>
      ) : null}

      <button
        type="button"
        aria-label={`Hapus slide ${index + 1}`}
        disabled={disabled}
        onClick={onRemove}
        className={cn(
          TILE_CONTROL,
          "top-1.5 right-1.5 hover:bg-destructive hover:text-destructive-foreground",
        )}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>

      <div className="absolute right-1.5 bottom-1.5 z-10 flex items-center gap-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Buka file slide ${index + 1}`}
            className={cn(TILE_CONTROL, "static hover:bg-background")}
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
        {sortable ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Pindahkan slide ${index + 1} (Spasi lalu panah)`}
            disabled={disabled}
            className={cn(TILE_CONTROL, "static cursor-grab touch-none active:cursor-grabbing")}
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Storyboard design                                                    */
/* ------------------------------------------------------------------ */

export type ContentPlanDesignSlidesProps = {
  roomId: string;
  /** null saat baris baru (belum ada id) → hanya antrean lokal. */
  itemId: string | null;
  isCarousel: boolean;
  slides: SlideItem[];
  onSlidesChange: Dispatch<SetStateAction<SlideItem[]>>;
  /** Path slide yang menjadi cover feed (ditandai di tile). */
  coverPath: string | null;
  /** Dipanggil setelah server mengubah daftar slide tersimpan (hapus / hapus semua). */
  onSavedPatched: (patch: DesignSlidesPatch) => void;
  disabled?: boolean;
  onDraggingChange?: (dragging: boolean) => void;
};

export function ContentPlanDesignSlides({
  roomId,
  itemId,
  isCarousel,
  slides,
  onSlidesChange,
  coverPath,
  onSavedPatched,
  disabled = false,
  onDraggingChange,
}: ContentPlanDesignSlidesProps) {
  const router = useRouter();
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* Thumbnail antrean: object URL per id, dibuat sekali dan dicabut saat item hilang. */
  const urlMapRef = useRef(new Map<string, string>());
  const [previews, setPreviews] = useState<ReadonlyMap<string, string>>(() => new Map());
  useEffect(() => {
    const map = urlMapRef.current;
    const live = new Set<string>();
    let changed = false;
    for (const s of slides) {
      if (s.kind !== "queued") continue;
      live.add(s.id);
      if (!map.has(s.id) && s.file.type.startsWith("image/")) {
        map.set(s.id, URL.createObjectURL(s.file));
        changed = true;
      }
    }
    for (const [id, url] of map) {
      if (!live.has(id)) {
        URL.revokeObjectURL(url);
        map.delete(id);
        changed = true;
      }
    }
    if (changed) setPreviews(new Map(map));
  }, [slides]);
  useEffect(() => {
    const map = urlMapRef.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
      map.clear();
    };
  }, []);

  const savedCount = useMemo(() => slides.filter((s) => s.kind === "saved").length, [slides]);
  const queuedCount = slides.length - savedCount;

  const addFiles = useCallback(
    (picked: File[]) => {
      const allowVideo = !isCarousel;
      const badType = picked.filter((f) => !designFileAllowed(f, allowVideo));
      const tooBig = picked.filter(
        (f) => designFileAllowed(f, allowVideo) && f.size > MAX_UPLOAD_BYTES,
      );
      const ok = picked.filter(
        (f) => designFileAllowed(f, allowVideo) && f.size <= MAX_UPLOAD_BYTES,
      );
      if (badType.length > 0) {
        toast.error(
          badType.length === 1
            ? `${badType[0]!.name} dilewati: tipe file tidak didukung.`
            : `${badType.length} file dilewati: tipe file tidak didukung.`,
        );
      }
      if (tooBig.length > 0) {
        toast.error(`${tooBig.length} file dilewati: ukuran lebih dari ${MAX_UPLOAD_LABEL}.`);
      }
      if (ok.length === 0) return;

      if (!isCarousel) {
        const first = ok[0]!;
        onSlidesChange((prev) => [...prev.filter((s) => s.kind === "saved"), queuedSlide(first)]);
        return;
      }
      const room = MAX_DESIGN_SLIDES - slides.length;
      if (room <= 0) {
        toast.error(`Maksimal ${MAX_DESIGN_SLIDES} slide per baris.`);
        return;
      }
      let accepted = ok;
      if (accepted.length > room) {
        toast.error(
          `Hanya ${room} slide lagi yang bisa ditambah (maksimal ${MAX_DESIGN_SLIDES}).`,
        );
        accepted = accepted.slice(0, room);
      }
      const additions = accepted.map(queuedSlide);
      onSlidesChange((prev) => [...prev, ...additions].slice(0, MAX_DESIGN_SLIDES));
    },
    [isCarousel, onSlidesChange, slides.length],
  );

  const removeSlide = useCallback(
    async (slide: SlideItem) => {
      if (slide.kind === "queued") {
        onSlidesChange((prev) => prev.filter((s) => s.id !== slide.id));
        return;
      }
      if (!itemId) return;
      try {
        const res = await removeContentPlanDesignSlide(roomId, itemId, slide.path);
        onSlidesChange((prev) => prev.filter((s) => s.id !== slide.id));
        onSavedPatched(res);
        toast.success("Slide dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus slide."));
      }
    },
    [itemId, onSavedPatched, onSlidesChange, roomId, router],
  );

  const clearAll = useCallback(async () => {
    if (!confirm("Hapus semua slide design untuk baris ini?")) return;
    try {
      if (itemId && savedCount > 0) {
        await clearContentPlanDesignFiles(roomId, itemId);
        onSavedPatched({ designFilePaths: [], feedCoverIndex: 0 });
        router.refresh();
      }
      onSlidesChange([]);
      toast.success("Semua slide dihapus.");
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menghapus slide."));
    }
  }, [itemId, onSavedPatched, onSlidesChange, roomId, router, savedCount]);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      onDraggingChange?.(false);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      onSlidesChange((prev) => {
        const from = prev.findIndex((s) => s.id === active.id);
        const to = prev.findIndex((s) => s.id === over.id);
        if (from < 0 || to < 0) return prev;
        return arrayMove(prev, from, to);
      });
    },
    [onDraggingChange, onSlidesChange],
  );

  const mediaFor = useCallback(
    (s: SlideItem): SlideMedia => {
      if (s.kind === "saved") {
        if (isContentPlanImagePath(s.path)) return { kind: "image", src: s.path, nextImage: true };
        if (isContentPlanVideoPath(s.path)) return { kind: "video", name: designFileLabel(s.path) };
        return { kind: "file", name: designFileLabel(s.path) };
      }
      const url = previews.get(s.id);
      if (url) return { kind: "image", src: url, nextImage: false };
      if (s.file.type.startsWith("video/")) return { kind: "video", name: s.file.name };
      return { kind: "file", name: s.file.name };
    },
    [previews],
  );

  /* ---------------- Reels / Single feed: satu file ---------------- */
  if (!isCarousel) {
    const shown =
      slides.find((s) => s.kind === "queued") ?? slides.find((s) => s.kind === "saved") ?? null;
    const replacing = shown?.kind === "queued" && savedCount > 0;
    return (
      <div className="space-y-3">
        {shown ? (
          <div className="flex items-start gap-3">
            <div className="w-24 shrink-0">
              <DndContext id={dndId} sensors={sensors}>
                <SortableContext items={[shown.id]}>
                  <SortableSlideTile
                    id={shown.id}
                    index={0}
                    media={mediaFor(shown)}
                    href={shown.kind === "saved" ? shown.path : null}
                    queued={shown.kind === "queued"}
                    isCover={false}
                    sortable={false}
                    disabled={disabled}
                    onRemove={() => void removeSlide(shown)}
                  />
                </SortableContext>
              </DndContext>
            </div>
            <div className="text-muted-foreground min-w-0 flex-1 space-y-1 pt-1 text-xs">
              <p className="text-foreground truncate font-medium">
                {shown.kind === "saved" ? designFileLabel(shown.path) : shown.file.name}
              </p>
              <p>
                {shown.kind === "queued"
                  ? replacing
                    ? "Menggantikan file lama saat Simpan."
                    : "Diunggah saat Simpan."
                  : "File design utama."}
              </p>
            </div>
          </div>
        ) : null}
        <FileDropZone
          accept={SINGLE_ACCEPT}
          multiple={false}
          disabled={disabled}
          onFiles={addFiles}
          compact
          label={shown ? "Ganti file design" : "Tarik file design ke sini"}
          hint={`Gambar, video, PDF, atau dokumen. Maks. ${MAX_UPLOAD_LABEL}.`}
        />
      </div>
    );
  }

  /* ---------------- Carousel: storyboard ---------------- */
  const ids = slides.map((s) => s.id);
  const canAdd = slides.length < MAX_DESIGN_SLIDES;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-muted-foreground text-xs">
          {slides.length === 0 ? (
            "Belum ada slide."
          ) : (
            <>
              <span className="text-foreground font-medium tabular-nums">
                {slides.length} slide
              </span>
              {queuedCount > 0 ? (
                <span className="tabular-nums">, {queuedCount} baru belum diunggah</span>
              ) : null}
              <span className="hidden sm:inline">. Seret untuk mengubah urutan.</span>
            </>
          )}
        </p>
        {slides.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void clearAll()}
          >
            Hapus semua
          </Button>
        ) : null}
      </div>

      {slides.length > 0 ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => onDraggingChange?.(true)}
          onDragCancel={() => onDraggingChange?.(false)}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {slides.map((s, i) => (
                <SortableSlideTile
                  key={s.id}
                  id={s.id}
                  index={i}
                  media={mediaFor(s)}
                  href={s.kind === "saved" ? s.path : null}
                  queued={s.kind === "queued"}
                  isCover={s.kind === "saved" && coverPath !== null && s.path === coverPath}
                  sortable={slides.length > 1}
                  disabled={disabled}
                  onRemove={() => void removeSlide(s)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      <FileDropZone
        accept={CAROUSEL_ACCEPT}
        multiple
        disabled={disabled || !canAdd}
        onFiles={addFiles}
        compact={slides.length > 0}
        label={
          canAdd
            ? slides.length === 0
              ? "Tarik gambar slide ke sini"
              : "Tambah slide"
            : `Maksimal ${MAX_DESIGN_SLIDES} slide tercapai`
        }
        hint={
          canAdd
            ? `Bisa banyak file sekaligus. Gambar, PDF, atau dokumen, maks. ${MAX_UPLOAD_LABEL} per file.`
            : "Hapus slide lain dulu untuk menambah."
        }
      />
    </div>
  );
}
