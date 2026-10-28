"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ContentPlanJenis,
  ContentPlanPlatform,
  ContentPlanStatusKerja,
  ContentPlanUsage,
} from "@prisma/client";
import {
  CalendarDays,
  Clock,
  FileText,
  Layers,
  LayoutList,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  clearContentPlanCopywritingFile,
  reorderContentPlanDesignSlides,
  uploadContentPlanCopywritingFile,
  uploadContentPlanDesignFile,
  upsertRoomContentPlanItem,
} from "@/actions/room-content-planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  contentPlanFeedCoverPath,
  JENIS_LABEL,
  PLATFORM_BADGE_CLASS,
  PLATFORM_LABEL,
  PLATFORM_ORDER,
  sortPlatforms,
  STATUS_LABEL,
  USAGE_LABEL,
} from "@/lib/content-plan-ui";
import type { SelectItemDef } from "@/lib/select-option-items";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import {
  ContentPlanDesignSlides,
  FileDropZone,
  savedSlide,
  type DesignSlidesPatch,
  type SlideItem,
} from "./content-plan-design-slides";
import {
  JenisBadge,
  PlatformBadge,
  toDateInput,
  UsageBadge,
  type PicOption,
} from "./content-plan-shared";
import type { ContentPlanTableRow } from "./content-planning-client";

/* ------------------------------------------------------------------ */
/* Nilai form                                                           */
/* ------------------------------------------------------------------ */

type FormValues = {
  konten: string;
  jenisKonten: ContentPlanJenis;
  usage: ContentPlanUsage;
  platforms: ContentPlanPlatform[];
  detailKonten: string;
  copywritingLink: string;
  designLink: string;
  picUserIds: string[];
  statusCopywriting: ContentPlanStatusKerja;
  statusDesign: ContentPlanStatusKerja;
  deadlineCopywriting: string;
  deadlineDesign: string;
  tanggalPosting: string;
  jamPosting: string;
  catatan: string;
};

function initForm(row: ContentPlanTableRow | null): FormValues {
  if (!row) {
    return {
      konten: "",
      jenisKonten: ContentPlanJenis.REELS,
      usage: ContentPlanUsage.AWARENESS,
      platforms: [],
      detailKonten: "",
      copywritingLink: "",
      designLink: "",
      picUserIds: [],
      statusCopywriting: ContentPlanStatusKerja.BARU,
      statusDesign: ContentPlanStatusKerja.BARU,
      deadlineCopywriting: "",
      deadlineDesign: "",
      tanggalPosting: "",
      jamPosting: "",
      catatan: "",
    };
  }
  return {
    konten: row.konten,
    jenisKonten: row.jenisKonten,
    usage: row.usage ?? ContentPlanUsage.AWARENESS,
    platforms: sortPlatforms(row.platforms),
    detailKonten: row.detailKonten ?? "",
    copywritingLink: row.copywritingLink ?? "",
    designLink: row.designLink ?? "",
    picUserIds: row.picUserIds?.length
      ? row.picUserIds
      : row.picUserId
        ? [row.picUserId]
        : [],
    statusCopywriting: row.statusCopywriting,
    statusDesign: row.statusDesign,
    deadlineCopywriting: toDateInput(row.deadlineCopywriting),
    deadlineDesign: toDateInput(row.deadlineDesign),
    tanggalPosting: toDateInput(row.tanggalPosting),
    jamPosting: row.jamPosting ?? "",
    catatan: row.catatan ?? "",
  };
}

const NO_PATHS: string[] = [];

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function fileLabelFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^[a-z]+-[0-9a-f-]{36}-/i, "");
}

type SectionKey = "ringkasan" | "copywriting" | "design" | "jadwal";
const SECTIONS: { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutList },
  { key: "copywriting", label: "Copywriting", icon: Sparkles },
  { key: "design", label: "Design", icon: Layers },
  { key: "jadwal", label: "Jadwal", icon: CalendarDays },
];

type GuardState = { dirty: boolean; saving: boolean; dragging: boolean };
type CloseDetails = { reason: string; cancel: () => void };

/* ------------------------------------------------------------------ */
/* Sheet                                                                */
/* ------------------------------------------------------------------ */

export type ContentPlanEditSheetProps = {
  roomId: string;
  open: boolean;
  /** Baris yang diedit; null = baris baru. */
  row: ContentPlanTableRow | null;
  /** Naik setiap kali sheet dibuka; memastikan form mulai dari awal. */
  openKey: number;
  picUserOptions: PicOption[];
  onOpenChange: (open: boolean) => void;
  /** Patch optimistik baris (state tabel + baris yang sedang diedit). */
  onRowPatched: (rowId: string, patch: Partial<ContentPlanTableRow>) => void;
  /** Dipanggil setelah simpan sukses; parent menutup sheet dan refresh. */
  onSaved: () => void;
};

export function ContentPlanEditSheet({
  roomId,
  open,
  row,
  openKey,
  picUserOptions,
  onOpenChange,
  onRowPatched,
  onSaved,
}: ContentPlanEditSheetProps) {
  const guardRef = useRef<GuardState>({ dirty: false, saving: false, dragging: false });

  const requestClose = useCallback(
    (details?: CloseDetails) => {
      const g = guardRef.current;
      const reason = details?.reason;
      if (g.dragging && reason === "escape-key") {
        details?.cancel();
        return;
      }
      if (g.saving) {
        details?.cancel();
        return;
      }
      if (g.dirty) {
        const userInitiated =
          reason === undefined ||
          reason === "escape-key" ||
          reason === "outside-press" ||
          reason === "close-press";
        if (userInitiated && !confirm("Perubahan belum disimpan. Tutup tanpa menyimpan?")) {
          details?.cancel();
          return;
        }
      }
      onOpenChange(false);
    },
    [onOpenChange],
  );

  const onGuardChange = useCallback((g: GuardState) => {
    guardRef.current = g;
  }, []);

  return (
    <Sheet
      open={open}
      onOpenChange={(next, details) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        requestClose(details);
      }}
    >
      <SheetContent
        side="right"
        showCloseButton
        className="data-[side=right]:sm:max-w-2xl flex w-full max-w-full flex-col gap-0 border-l p-0 lg:max-w-[min(46rem,100vw-2rem)]"
      >
        <ContentPlanRowForm
          key={`${openKey}:${row?.id ?? "new"}`}
          roomId={roomId}
          row={row}
          picUserOptions={picUserOptions}
          onRowPatched={onRowPatched}
          onSaved={onSaved}
          onRequestClose={() => requestClose()}
          onGuardChange={onGuardChange}
        />
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-0.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-muted-foreground size-4" aria-hidden />
        {title}
      </h3>
      {description ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
    </div>
  );
}

function PicAvatar({ user }: { user: PicOption }) {
  const label = user.name?.trim() || user.email;
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={20}
        height={20}
        unoptimized
        className="border-border size-5 shrink-0 rounded-full border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ContentPlanRowForm({
  roomId,
  row,
  picUserOptions,
  onRowPatched,
  onSaved,
  onRequestClose,
  onGuardChange,
}: {
  roomId: string;
  row: ContentPlanTableRow | null;
  picUserOptions: PicOption[];
  onRowPatched: (rowId: string, patch: Partial<ContentPlanTableRow>) => void;
  onSaved: () => void;
  onRequestClose: () => void;
  onGuardChange: (g: GuardState) => void;
}) {
  const router = useRouter();
  const uid = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormValues>(() => initForm(row));
  const [initialJson] = useState(() => JSON.stringify(initForm(row)));
  const [slides, setSlides] = useState<SlideItem[]>(() =>
    (row?.designFilePaths ?? []).map(savedSlide),
  );
  const [copyFile, setCopyFile] = useState<File | null>(null);
  const [copyPath, setCopyPath] = useState<string | null>(row?.copywritingFilePath ?? null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("ringkasan");

  /** Id & slide server baris baru (agar retry setelah gagal tidak membuat baris ganda). */
  const [created, setCreated] = useState<{ id: string; paths: string[] } | null>(null);
  const itemId = row?.id ?? created?.id ?? null;
  /** Daftar slide di server: baris yang diedit selalu di-patch parent; baris baru dilacak lokal. */
  const serverPaths = useMemo(
    () => (row ? row.designFilePaths : (created?.paths ?? NO_PATHS)),
    [row, created],
  );

  const set = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const isCarousel = form.jenisKonten === ContentPlanJenis.CAROUSEL;
  const queuedSlides = useMemo(() => slides.filter((s) => s.kind === "queued"), [slides]);
  const uploadCount =
    (isCarousel ? queuedSlides.length : Math.min(queuedSlides.length, 1)) + (copyFile ? 1 : 0);

  /** Urutan storyboard berbeda dari "slide lama + antrean di belakang"? */
  const orderChanged = useMemo(() => {
    if (!isCarousel) return false;
    const expected = [...serverPaths.map((p) => `s:${p}`), ...queuedSlides.map((s) => s.id)];
    return !arraysEqual(
      slides.map((s) => s.id),
      expected,
    );
  }, [isCarousel, queuedSlides, serverPaths, slides]);

  const dirty =
    JSON.stringify(form) !== initialJson || uploadCount > 0 || orderChanged;

  useEffect(() => {
    onGuardChange({ dirty, saving, dragging });
  }, [dirty, saving, dragging, onGuardChange]);

  const canSave = form.konten.trim().length > 0 && !saving;

  const coverPath = useMemo(() => {
    if (!row) return null;
    return contentPlanFeedCoverPath({
      designFilePaths: row.designFilePaths,
      feedCoverIndex: row.feedCoverIndex,
      feedCoverPath: null,
    });
  }, [row]);

  /* ---------------- Nav seksi ---------------- */
  const sectionDomId = useCallback((key: SectionKey) => `${uid}-sec-${key}`, [uid]);

  const updateActiveSection = useCallback(() => {
    const root = bodyRef.current;
    if (!root) return;
    const line = root.scrollTop + 88;
    let current: SectionKey = SECTIONS[0]!.key;
    for (const s of SECTIONS) {
      const el = document.getElementById(sectionDomId(s.key));
      if (el && el.offsetTop <= line) current = s.key;
    }
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) {
      current = SECTIONS[SECTIONS.length - 1]!.key;
    }
    setActiveSection(current);
  }, [sectionDomId]);

  const jumpTo = useCallback(
    (key: SectionKey) => {
      const el = document.getElementById(sectionDomId(key));
      if (!el) return;
      setActiveSection(key);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [sectionDomId],
  );

  /* ---------------- Select items ---------------- */
  const jenisItems = useMemo(
    (): SelectItemDef[] =>
      (Object.values(ContentPlanJenis) as ContentPlanJenis[]).map((j) => ({
        value: j,
        label: JENIS_LABEL[j],
      })),
    [],
  );
  const usageItems = useMemo(
    (): SelectItemDef[] =>
      (Object.values(ContentPlanUsage) as ContentPlanUsage[]).map((u) => ({
        value: u,
        label: USAGE_LABEL[u],
      })),
    [],
  );
  const statusItems = useMemo(
    (): SelectItemDef[] =>
      (Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]).map((s) => ({
        value: s,
        label: STATUS_LABEL[s],
      })),
    [],
  );

  /* ---------------- File copywriting ---------------- */
  const pickCopyFile = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
      return;
    }
    setCopyFile(f);
  }, []);

  const removeCopyPath = useCallback(async () => {
    if (!row || !copyPath) return;
    try {
      await clearContentPlanCopywritingFile(roomId, row.id);
      setCopyPath(null);
      onRowPatched(row.id, { copywritingFilePath: null });
      toast.success("File copywriting dihapus.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menghapus file."));
    }
  }, [copyPath, onRowPatched, roomId, router, row]);

  const onSavedPatched = useCallback(
    (patch: DesignSlidesPatch) => {
      if (row) onRowPatched(row.id, patch);
      else setCreated((c) => (c ? { ...c, paths: patch.designFilePaths } : c));
    },
    [onRowPatched, row],
  );

  /* ---------------- Simpan ---------------- */
  const onSave = useCallback(async () => {
    if (!canSave) return;
    if (
      row &&
      row.jenisKonten === ContentPlanJenis.CAROUSEL &&
      form.jenisKonten !== ContentPlanJenis.CAROUSEL &&
      serverPaths.length > 1
    ) {
      const extra = serverPaths.length - 1;
      if (
        !confirm(
          `Mengubah jenis dari Carousel akan menghapus ${extra} slide design secara permanen (hanya slide pertama disimpan). Lanjutkan?`,
        )
      ) {
        return;
      }
    }

    setSaving(true);
    try {
      const toDate = (v: string) => (v.trim() ? new Date(v) : null);
      const { id } = await upsertRoomContentPlanItem({
        id: itemId ?? undefined,
        roomId,
        konten: form.konten.trim(),
        jenisKonten: form.jenisKonten,
        usage: form.usage,
        platforms: form.platforms,
        detailKonten: form.detailKonten.trim() || null,
        copywritingLink: form.copywritingLink.trim() || null,
        designLink: form.designLink.trim() || null,
        picUserIds: form.picUserIds,
        statusCopywriting: form.statusCopywriting,
        statusDesign: form.statusDesign,
        deadlineCopywriting: toDate(form.deadlineCopywriting),
        deadlineDesign: toDate(form.deadlineDesign),
        tanggalPosting: toDate(form.tanggalPosting),
        jamPosting: form.jamPosting.trim() || null,
        catatan: form.catatan.trim() || null,
      });
      /** Sinkronkan daftar slide server ke parent (edit) atau state lokal (baris baru). */
      const publish = (paths: string[], extra?: Partial<ContentPlanTableRow>) => {
        if (row) onRowPatched(id, { designFilePaths: paths, ...extra });
        else setCreated({ id, paths });
      };
      if (!row) setCreated((c) => c ?? { id, paths: [] });

      if (copyFile) {
        const fd = new FormData();
        fd.append("file", copyFile);
        await uploadContentPlanCopywritingFile(roomId, id, fd);
        setCopyFile(null);
      }

      const carousel = form.jenisKonten === ContentPlanJenis.CAROUSEL;
      const list = carousel ? queuedSlides : queuedSlides.slice(0, 1);
      let working = slides;
      let onServer = carousel ? [...serverPaths] : [];
      if (list.length > 0) setProgress({ done: 0, total: list.length });
      for (const q of list) {
        const fd = new FormData();
        fd.append("file", q.file);
        fd.append("replaceSingle", carousel ? "0" : "1");
        const { publicPath } = await uploadContentPlanDesignFile(roomId, id, fd);
        working = carousel
          ? working.map((s) => (s.id === q.id ? savedSlide(publicPath) : s))
          : [savedSlide(publicPath)];
        onServer = carousel ? [...onServer, publicPath] : [publicPath];
        setSlides(working);
        publish(onServer);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }

      if (carousel) {
        const finalPaths = working.flatMap((s) => (s.kind === "saved" ? [s.path] : []));
        if (!arraysEqual(finalPaths, onServer)) {
          const res = await reorderContentPlanDesignSlides(roomId, id, finalPaths);
          publish(finalPaths, { feedCoverIndex: res.feedCoverIndex });
        }
      }

      toast.success(row ? "Baris diperbarui." : "Baris ditambahkan.");
      onSaved();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyimpan."));
      router.refresh();
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }, [
    canSave,
    copyFile,
    form,
    itemId,
    onRowPatched,
    onSaved,
    queuedSlides,
    roomId,
    router,
    row,
    serverPaths,
    slides,
  ]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void onSave();
      }
    },
    [onSave],
  );

  /* ---------------- Footer summary ---------------- */
  const footerNote = (() => {
    if (!form.konten.trim()) return "Isi nama konten dulu.";
    const parts: string[] = [];
    if (uploadCount > 0) parts.push(`${uploadCount} file akan diunggah`);
    if (orderChanged) parts.push("urutan slide berubah");
    if (parts.length > 0) {
      const s = parts.join(", ");
      return `${s.charAt(0).toUpperCase()}${s.slice(1)} saat Simpan.`;
    }
    if (dirty) return "Perubahan belum disimpan.";
    return null;
  })();

  const saveLabel = saving
    ? progress && progress.total > 0
      ? `Mengunggah ${Math.min(progress.done + 1, progress.total)}/${progress.total}…`
      : "Menyimpan…"
    : "Simpan";

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      {/* Header */}
      <SheetHeader className="border-border shrink-0 gap-1 border-b px-6 pt-5 pb-4 text-left">
        <SheetTitle className="pr-8 text-lg">
          {row ? "Edit baris content planning" : "Baris content planning baru"}
        </SheetTitle>
        {row ? (
          <SheetDescription className="flex min-w-0 items-center gap-1.5">
            <JenisBadge jenis={row.jenisKonten} />
            {sortPlatforms(row.platforms).map((p) => (
              <PlatformBadge key={p} platform={p} short />
            ))}
            <span className="truncate text-xs">{row.konten}</span>
          </SheetDescription>
        ) : (
          <SheetDescription>
            Isi brief, lampirkan file, lalu simpan sekali.
          </SheetDescription>
        )}
      </SheetHeader>

      {/* Body */}
      <div
        ref={bodyRef}
        onScroll={updateActiveSection}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        <nav
          aria-label="Bagian form"
          className="bg-popover/95 supports-backdrop-filter:backdrop-blur-sm border-border sticky top-0 z-10 flex gap-1 overflow-x-auto border-b px-6 py-2"
        >
          {SECTIONS.map((s) => {
            const active = activeSection === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => jumpTo(s.key)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-6 px-6 py-5">
          {/* Ringkasan */}
          <section
            id={sectionDomId("ringkasan")}
            data-section="ringkasan"
            className="scroll-mt-14 space-y-4"
          >
            <SectionHeading icon={LayoutList} title="Ringkasan" description="Nama, format, dan siapa yang mengerjakan." />
            <div className="space-y-2">
              <Label htmlFor={`${uid}-konten`}>Konten (nama)</Label>
              <Input
                id={`${uid}-konten`}
                autoFocus={!row}
                value={form.konten}
                onChange={(e) => set("konten", e.target.value)}
                placeholder="Judul atau nama konten"
                className="h-11 text-base font-medium md:text-base"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Jenis konten</Label>
                <Select
                  value={form.jenisKonten}
                  items={jenisItems}
                  onValueChange={(v) => {
                    if (v) set("jenisKonten", v as ContentPlanJenis);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="space-y-2">
                <Label>Usage</Label>
                <Select
                  value={form.usage}
                  items={usageItems}
                  onValueChange={(v) => {
                    if (v) set("usage", v as ContentPlanUsage);
                  }}
                >
                  <SelectTrigger>
                    <UsageBadge usage={form.usage} />
                  </SelectTrigger>
                  <SelectContent>
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
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORM_ORDER.map((p) => {
                  const checked = form.platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() =>
                        set(
                          "platforms",
                          sortPlatforms(
                            checked
                              ? form.platforms.filter((x) => x !== p)
                              : [...form.platforms, p],
                          ),
                        )
                      }
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                        checked
                          ? PLATFORM_BADGE_CLASS[p]
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {PLATFORM_LABEL[p]}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                Boleh lebih dari satu. Kosongkan bila belum ditentukan.
              </p>
            </div>
            <div className="space-y-2">
              <Label>PIC</Label>
              {picUserOptions.length === 0 ? (
                <p className="text-muted-foreground text-xs">Belum ada anggota ruangan.</p>
              ) : (
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {picUserOptions.map((u) => {
                    const checked = form.picUserIds.includes(u.id);
                    const label = u.name?.trim() || u.email;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        title={label}
                        onClick={() =>
                          set(
                            "picUserIds",
                            checked
                              ? form.picUserIds.filter((id) => id !== u.id)
                              : [...form.picUserIds, u.id],
                          )
                        }
                        className={cn(
                          "inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                          checked
                            ? "border-ring bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <PicAvatar user={u} />
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${uid}-detail`}>Detail konten</Label>
              <Textarea
                id={`${uid}-detail`}
                rows={4}
                value={form.detailKonten}
                onChange={(e) => set("detailKonten", e.target.value)}
                placeholder="Brief, angle, CTA, referensi…"
              />
            </div>
          </section>

          <Separator />

          {/* Copywriting */}
          <section
            id={sectionDomId("copywriting")}
            data-section="copywriting"
            className="scroll-mt-14 space-y-4"
          >
            <SectionHeading icon={Sparkles} title="Copywriting" description="Link eksternal atau satu file pendukung." />
            <div className="space-y-2">
              <Label htmlFor={`${uid}-cw-link`}>Link / teks</Label>
              <Input
                id={`${uid}-cw-link`}
                value={form.copywritingLink}
                onChange={(e) => set("copywritingLink", e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              {copyFile ? (
                <div className="border-border bg-muted/20 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{copyFile.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {copyPath ? "menggantikan file lama" : "diunggah saat Simpan"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Batalkan file copywriting"
                    onClick={() => setCopyFile(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : copyPath ? (
                <div className="border-border bg-muted/20 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <a
                    href={copyPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-foreground min-w-0 flex-1 truncate font-medium underline-offset-2 hover:underline"
                  >
                    {fileLabelFromPath(copyPath)}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void removeCopyPath()}
                  >
                    Hapus
                  </Button>
                </div>
              ) : null}
              <FileDropZone
                multiple={false}
                compact
                disabled={saving}
                onFiles={pickCopyFile}
                label={copyPath || copyFile ? "Ganti file copywriting" : "Tarik file ke sini"}
                hint={`Dokumen, PDF, gambar, atau zip. Maks. ${MAX_UPLOAD_LABEL}.`}
              />
            </div>
          </section>

          <Separator />

          {/* Design */}
          <section
            id={sectionDomId("design")}
            data-section="design"
            className="scroll-mt-14 space-y-4"
          >
            <SectionHeading
              icon={Layers}
              title="Design"
              description={
                isCarousel
                  ? "Urutan storyboard di sini = urutan slide carousel dan cover feed."
                  : "Reels / Single feed: satu file design utama."
              }
            />
            <div className="space-y-2">
              <Label htmlFor={`${uid}-des-link`}>Link design</Label>
              <Input
                id={`${uid}-des-link`}
                value={form.designLink}
                onChange={(e) => set("designLink", e.target.value)}
                placeholder="https://… Figma, Drive, dll."
              />
            </div>
            <ContentPlanDesignSlides
              roomId={roomId}
              itemId={itemId}
              isCarousel={isCarousel}
              slides={slides}
              onSlidesChange={setSlides}
              coverPath={coverPath}
              onSavedPatched={onSavedPatched}
              disabled={saving}
              onDraggingChange={setDragging}
            />
          </section>

          <Separator />

          {/* Status & jadwal */}
          <section
            id={sectionDomId("jadwal")}
            data-section="jadwal"
            className="scroll-mt-14 space-y-4"
          >
            <SectionHeading icon={CalendarDays} title="Status & jadwal" description="Alur kerja, tenggat, dan waktu tayang." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status copywriting</Label>
                <Select
                  value={form.statusCopywriting}
                  items={statusItems}
                  onValueChange={(v) => {
                    if (v) set("statusCopywriting", v as ContentPlanStatusKerja);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status design</Label>
                <Select
                  value={form.statusDesign}
                  items={statusItems}
                  onValueChange={(v) => {
                    if (v) set("statusDesign", v as ContentPlanStatusKerja);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${uid}-dl-cw`}>Deadline copywriting</Label>
                <Input
                  id={`${uid}-dl-cw`}
                  type="date"
                  value={form.deadlineCopywriting}
                  onChange={(e) => set("deadlineCopywriting", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${uid}-dl-des`}>Deadline design</Label>
                <Input
                  id={`${uid}-dl-des`}
                  type="date"
                  value={form.deadlineDesign}
                  onChange={(e) => set("deadlineDesign", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${uid}-post`}>Tanggal posting</Label>
                <Input
                  id={`${uid}-post`}
                  type="date"
                  value={form.tanggalPosting}
                  onChange={(e) => set("tanggalPosting", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${uid}-post-jam`} className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5 opacity-70" aria-hidden />
                  Jam posting (WIB)
                </Label>
                <Input
                  id={`${uid}-post-jam`}
                  type="time"
                  value={form.jamPosting}
                  onChange={(e) => set("jamPosting", e.target.value)}
                />
                <p className="text-muted-foreground text-[11px]">
                  Opsional. Penting bila ada beberapa konten di hari yang sama.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${uid}-cat`}>Catatan</Label>
                <Textarea
                  id={`${uid}-cat`}
                  rows={3}
                  value={form.catatan}
                  onChange={(e) => set("catatan", e.target.value)}
                  placeholder="Catatan internal untuk tim…"
                  className="resize-none"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <SheetFooter className="bg-background/95 supports-backdrop-filter:backdrop-blur-sm border-border mt-0 shrink-0 flex-row flex-wrap items-center justify-between gap-2 border-t px-6 py-3">
        <p
          className="text-muted-foreground min-w-0 flex-1 truncate text-xs"
          aria-live="polite"
        >
          {footerNote}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" type="button" onClick={onRequestClose} disabled={saving}>
            Batal
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={!canSave}>
            {saveLabel}
          </Button>
        </div>
      </SheetFooter>
    </div>
  );
}
