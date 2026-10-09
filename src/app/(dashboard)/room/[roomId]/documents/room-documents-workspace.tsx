"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import Image from "next/image";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  createRoomDocumentFolder,
  deleteRoomDocument,
  deleteRoomDocumentFolder,
  deleteRoomDocuments,
  moveRoomDocumentFolder,
  moveRoomDocumentItems,
  moveRoomDocumentToFolder,
  moveRoomDocumentsToFolder,
  renameRoomDocument,
  renameRoomDocumentFolder,
} from "@/actions/room-documents";
import { listRoomDocumentLibrary } from "@/actions/room-document-library";
import {
  purgeRoomDocumentFolder,
  purgeRoomDocuments,
  restoreRoomDocumentFolder,
  restoreRoomDocuments,
  toggleRoomDocumentFavorite,
} from "@/actions/room-document-lifecycle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  asyncPool,
  uploadRoomDocumentViaApi,
} from "@/lib/room-document-upload-xhr";
import { normalizeRoomDocumentTags } from "@/lib/room-document-tags";
import {
  downloadRoomItemsZip,
  downloadRoomFolderZip,
  downloadSingleRoomDocument,
} from "@/lib/room-document-download-client";
import {
  flattenFoldersForPicker,
  formatFolderPath,
  getChildFolders,
  getDescendantFolderIds,
} from "@/lib/room-document-folders";
import {
  DOCUMENT_ITEMS_DRAG_TYPE,
  DriveBreadcrumb,
  DriveFolderChip,
  DriveFolderGridCard,
  DriveFolderTree,
  documentListGridClass,
  type DriveFolderRow,
} from "./room-documents-drive-nav";
import {
  ActiveFilterChips,
  DocActionsMenu,
  FileTypeBadge,
  FileTypeSpine,
  FolderChoiceItem,
  fileTypeMeta,
  formatDate,
  formatFileSize,
  type ActiveFilterChip,
} from "./room-documents-items";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoomDocumentPreviewDialog } from "@/components/documents/room-document-preview-dialog";
import {
  RoomDocumentShareDialog,
  type DocumentShareTarget,
} from "@/components/documents/room-document-share-dialog";
import { RoomDocumentActivityDialog } from "@/components/documents/room-document-activity-dialog";
import {
  RoomDocumentVersionsDialog,
  type DocumentVersionTarget,
} from "@/components/documents/room-document-versions-dialog";
import {
  ArrowDownAZ,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Download,
  Film,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Info,
  LayoutGrid,
  LayoutList,
  Loader2,
  Play,
  Clock3,
  RotateCcw,
  Search,
  Star,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

export type { RoomDocumentRow } from "./room-document-types";
import type { RoomDocumentRow } from "./room-document-types";

export type RoomDocumentFolderRow = DriveFolderRow;

type ViewMode = "grid" | "list";
type LibraryScope = "browse" | "favorites" | "recent" | "trash";
type TypeFilter = "all" | "image" | "video" | "audio" | "pdf" | "document" | "archive";
type DateFilter = "all" | "today" | "week" | "month";
type SortKey =
  | "newest"
  | "oldest"
  | "name"
  | "name_desc"
  | "size"
  | "size_asc"
  | "type"
  | "uploader";

const SORT_LABEL: Record<SortKey, string> = {
  newest: "Terbaru",
  oldest: "Terlama",
  name: "Nama A → Z",
  name_desc: "Nama Z → A",
  size: "Ukuran (besar)",
  size_asc: "Ukuran (kecil)",
  type: "Tipe file",
  uploader: "Pengunggah",
};

const TYPE_FILTER_LABEL: Record<TypeFilter, string> = {
  all: "Semua tipe",
  image: "Gambar",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  document: "Dokumen",
  archive: "Arsip",
};

const DATE_FILTER_LABEL: Record<DateFilter, string> = {
  all: "Semua waktu",
  today: "Hari ini",
  week: "7 hari terakhir",
  month: "30 hari terakhir",
};

const SCOPE_LABEL: Record<LibraryScope, string> = {
  browse: "Semua file",
  favorites: "Favorit",
  recent: "Terbaru",
  trash: "Sampah",
};

/** Kepadatan grid — mengatur jumlah kolom & ukuran kartu file/folder. */
type GridDensity = "besar" | "sedang" | "kecil";

const DENSITY_STORAGE_KEY = "dcc:doc-grid-density";

const DENSITY_LABEL: Record<GridDensity, string> = {
  besar: "Besar",
  sedang: "Sedang",
  kecil: "Kecil",
};

/** Kelas kolom per kepadatan (angka mengacu ke lebar layar 2xl). */
const DENSITY_GRID: Record<GridDensity, string> = {
  besar: "gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
  sedang: "gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  kecil: "gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8",
};

function mimeSortCategory(mimeType: string): number {
  if (mimeType.startsWith("video/")) return 0;
  if (mimeType.startsWith("image/")) return 1;
  if (mimeType.startsWith("audio/")) return 2;
  if (mimeType === "application/pdf") return 3;
  return 4;
}

type UploadJobStatus = "queued" | "uploading" | "done" | "error";

type UploadJob = {
  id: string;
  fileName: string;
  progress: number;
  status: UploadJobStatus;
  error?: string;
};

type DestructiveTarget =
  | { mode: "trash"; kind: "folder"; folder: RoomDocumentFolderRow }
  | { mode: "trash"; kind: "document"; document: RoomDocumentRow }
  | { mode: "trash"; kind: "documents"; documentIds: string[] }
  | { mode: "purge"; kind: "folder"; folder: RoomDocumentFolderRow }
  | { mode: "purge"; kind: "document"; document: RoomDocumentRow };

/** Batasi DOM sekaligus — daftar besar jadi ringan; preview tetap penuh. */

/**
 * Folder yang tampil sebelum di-ciutkan (± 2 baris di grid lebar). Kalau lebih
 * dari ini, sisanya disembunyikan di balik tombol "Lihat semua" agar seksi file
 * tetap mudah dijangkau di lokasi yang folder-heavy.
 */
const FOLDER_COLLAPSE_LIMIT = 8;
const ROOT_FOLDER_VALUE = "__root__";

/** Ghost yang sedang terpasang — dilepas di dragend atau saat drag berikutnya. */
let activeDragGhost: HTMLElement | null = null;

function removeDragGhost() {
  activeDragGhost?.remove();
  activeDragGhost = null;
}

/**
 * Pasang chip kecil (ikon + nama item) sebagai gambar seret.
 *
 * Tanpa ini browser memakai snapshot elemen yang diseret. Baris daftar memakai
 * `content-visibility:auto` dan kartu grid punya lapisan komposit sendiri —
 * snapshot bawaan Chrome untuk elemen semacam itu keluar salah: yang terlihat
 * potongan besar halaman, bukan kartunya.
 */
function mountDragGhost(
  label: string,
  kind: "document" | "folder",
  extra: number,
): HTMLElement {
  removeDragGhost();

  const ghost = document.createElement("div");
  ghost.className =
    "border-border bg-card text-foreground pointer-events-none fixed top-0 left-0 z-[9999] flex max-w-[280px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-lg";
  // Di luar viewport supaya tidak sempat terlihat, tapi tetap dirender.
  ghost.style.transform = "translate(-9999px, -9999px)";

  const icon = document.createElement("span");
  icon.className =
    kind === "folder"
      ? "bg-amber-500/15 text-amber-600 flex size-6 shrink-0 items-center justify-center rounded-md text-xs"
      : "bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-md text-xs";
  icon.textContent = kind === "folder" ? "📁" : "📄";
  ghost.append(icon);

  const text = document.createElement("span");
  text.className = "truncate";
  text.textContent = label;
  ghost.append(text);

  if (extra > 0) {
    const badge = document.createElement("span");
    badge.className =
      "bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums";
    badge.textContent = `+${extra}`;
    ghost.append(badge);
  }

  document.body.append(ghost);
  activeDragGhost = ghost;
  return ghost;
}

function folderLabelForDoc(
  folderId: string | null,
  folders: RoomDocumentFolderRow[],
): string {
  if (!folderId) return "Semua file";
  return formatFolderPath(folderId, folders);
}

export function RoomDocumentsWorkspace({
  roomId,
  folders,
  trashFolders,
  documents,
  initialDocumentTotal,
  storageSummary,
  documentMembers,
  currentUserId,
  isRoomManager,
}: {
  roomId: string;
  folders: RoomDocumentFolderRow[];
  trashFolders: RoomDocumentFolderRow[];
  documents: RoomDocumentRow[];
  initialDocumentTotal: number;
  storageSummary: { fileCount: number; rootFileCount: number; totalSize: number };
  documentMembers: Array<{ id: string; name: string | null; email: string }>;
  currentUserId: string;
  isRoomManager: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const folderFromUrl = searchParams.get("folder");
  const initialFolderId =
    folderFromUrl && folders.some((f) => f.id === folderFromUrl)
      ? folderFromUrl
      : null;

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    initialFolderId,
  );
  /** Riwayat folder untuk tombol kembali (folder sebelumnya yang dikunjungi). */
  const [folderBackStack, setFolderBackStack] = useState<(string | null)[]>([]);
  const currentFolderIdRef = useRef(currentFolderId);
  const folderBackStackRef = useRef<(string | null)[]>([]);
  const [title, setTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOptionsOpen, setUploadOptionsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [renameTarget, setRenameTarget] = useState<
    | { kind: "folder"; id: string; name: string }
    | { kind: "document"; id: string; name: string }
    | null
  >(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [moveFolderTarget, setMoveFolderTarget] =
    useState<RoomDocumentFolderRow | null>(null);
  const [moveFolderDestination, setMoveFolderDestination] =
    useState(ROOT_FOLDER_VALUE);
  const [moveFolderBusy, setMoveFolderBusy] = useState(false);
  const [documentRows, setDocumentRows] = useState(documents);
  const [documentTotal, setDocumentTotal] = useState(initialDocumentTotal);
  const [nextDocumentOffset, setNextDocumentOffset] = useState<number | null>(
    documents.length < initialDocumentTotal ? documents.length : null,
  );
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("browse");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [uploaderFilter, setUploaderFilter] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [matchedFolderIds, setMatchedFolderIds] = useState<string[]>([]);
  const libraryRequestRef = useRef(0);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [density, setDensity] = useState<GridDensity>(() => {
    if (typeof window === "undefined") return "besar";
    try {
      const saved = window.localStorage.getItem(DENSITY_STORAGE_KEY);
      if (saved === "besar" || saved === "sedang" || saved === "kecil") {
        return saved;
      }
    } catch {
      // localStorage bisa tidak tersedia pada mode privasi tertentu.
    }
    return "besar";
  });
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<RoomDocumentRow | null>(null);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [uploadPanelExpanded, setUploadPanelExpanded] = useState(true);
  const [uploadTagsInput, setUploadTagsInput] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("__all__");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const [destructiveTarget, setDestructiveTarget] =
    useState<DestructiveTarget | null>(null);
  const [shareTarget, setShareTarget] = useState<DocumentShareTarget | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<
    (DocumentVersionTarget & { canManage: boolean }) | null
  >(null);

  const deferredSearch = useDeferredValue(search);
  const selectionActive = selectedDocIds.size + selectedFolderIds.size > 0;

  const refreshDocuments = useCallback(() => {
    setLibraryRevision((revision) => revision + 1);
    router.refresh();
  }, [router]);

  const uploadBusy = uploadJobs.some(
    (j) => j.status === "queued" || j.status === "uploading",
  );

  const applyFolderToUrl = useCallback(
    (folderId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (folderId) params.set("folder", folderId);
      else params.delete("folder");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const navigateToFolder = useCallback(
    (folderId: string | null, options?: { skipHistory?: boolean }) => {
      const prev = currentFolderIdRef.current;
      if (!options?.skipHistory && folderId !== prev) {
        const nextStack = [...folderBackStackRef.current, prev];
        folderBackStackRef.current = nextStack;
        setFolderBackStack(nextStack);
      }
      setCurrentFolderId(folderId);
      currentFolderIdRef.current = folderId;
      applyFolderToUrl(folderId);
    },
    [applyFolderToUrl],
  );

  const goBackToPreviousFolder = useCallback(() => {
    const stack = folderBackStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1] ?? null;
    const nextStack = stack.slice(0, -1);
    folderBackStackRef.current = nextStack;
    setFolderBackStack(nextStack);
    setCurrentFolderId(prev);
    currentFolderIdRef.current = prev;
    applyFolderToUrl(prev);
  }, [applyFolderToUrl]);

  const canGoBackFolder = folderBackStack.length > 0;

  const previousFolderLabel = useMemo(() => {
    if (!canGoBackFolder) return null;
    const id = folderBackStack[folderBackStack.length - 1] ?? null;
    if (id == null) return "Semua file";
    return folders.find((f) => f.id === id)?.name ?? "Folder";
  }, [canGoBackFolder, folderBackStack, folders]);

  const isSearchActive = deferredSearch.trim().length > 0;

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId;
  }, [currentFolderId]);

  useEffect(() => {
    folderBackStackRef.current = folderBackStack;
  }, [folderBackStack]);

  const loadLibrary = useCallback(
    async (options?: { append?: boolean; offset?: number }) => {
      const requestId = ++libraryRequestRef.current;
      const offset = options?.append ? options.offset : 0;
      if (options?.append && offset == null) return;
      setLibraryLoading(true);
      try {
        const result = await listRoomDocumentLibrary({
          roomId,
          folderId: libraryScope === "browse" ? currentFolderId : undefined,
          search: deferredSearch,
          tag: tagFilter,
          type: typeFilter,
          uploaderId: uploaderFilter || undefined,
          date: dateFilter,
          scope: libraryScope,
          sort: sortKey,
          offset,
        });
        if (requestId !== libraryRequestRef.current) return;
        setDocumentRows((previous) =>
          options?.append ? [...previous, ...result.documents] : result.documents,
        );
        setDocumentTotal(result.total);
        setNextDocumentOffset(result.nextOffset);
        setMatchedFolderIds(result.matchedFolderIds);
      } catch (error) {
        if (requestId === libraryRequestRef.current) {
          toast.error(actionErrorMessage(error, "Gagal memuat dokumen."));
        }
      } finally {
        if (requestId === libraryRequestRef.current) setLibraryLoading(false);
      }
    },
    [
      currentFolderId,
      dateFilter,
      deferredSearch,
      libraryScope,
      roomId,
      sortKey,
      tagFilter,
      typeFilter,
      uploaderFilter,
    ],
  );

  const changeLibraryScope = useCallback(
    (scope: LibraryScope) => {
      setLibraryScope(scope);
      setSelectedDocIds(new Set());
      setSelectedFolderIds(new Set());
      if (scope !== "browse") {
        setCurrentFolderId(null);
        currentFolderIdRef.current = null;
        applyFolderToUrl(null);
      }
    },
    [applyFolderToUrl],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLibrary(), 0);
    return () => window.clearTimeout(timer);
  }, [libraryRevision, loadLibrary]);

  const childFolders = useMemo(
    () => {
      if (libraryScope === "trash") return trashFolders;
      if (libraryScope === "recent") return [];
      if (libraryScope === "favorites" || isSearchActive) {
        const matched = new Set(matchedFolderIds);
        return folders.filter((folder) => matched.has(folder.id));
      }
      return getChildFolders(folders, currentFolderId) as RoomDocumentFolderRow[];
    },
    [
      folders,
      currentFolderId,
      isSearchActive,
      libraryScope,
      matchedFolderIds,
      trashFolders,
    ],
  );

  const rootFileCount = storageSummary.rootFileCount;

  const allTagsInRoom = useMemo(() => {
    const s = new Set<string>();
    for (const d of documentRows) {
      for (const t of d.tags ?? []) s.add(t);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "id"));
  }, [documentRows]);

  const folderMoveChoices = useMemo(() => {
    if (!moveFolderTarget) return [];
    const excluded = getDescendantFolderIds(folders, moveFolderTarget.id);
    excluded.add(moveFolderTarget.id);
    return flattenFoldersForPicker(
      folders.filter((folder) => !excluded.has(folder.id)),
    );
  }, [folders, moveFolderTarget]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedDocIds(new Set());
      setSelectedFolderIds(new Set());
      setShowAllFolders(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentFolderId, tagFilter, sortKey, deferredSearch]);

  // Muat & simpan preferensi kepadatan grid (per-perangkat).
  useEffect(() => {
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      /* abaikan */
    }
  }, [density]);

  const totalSize = storageSummary.totalSize;

  const visibleDocuments = useMemo(() => {
    const rows = documentRows;
    const sorted = [...rows];
    switch (sortKey) {
      case "newest":
        sorted.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "oldest":
        sorted.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "name":
        sorted.sort((a, b) =>
          (a.title || a.fileName).localeCompare(
            b.title || b.fileName,
            "id",
            { sensitivity: "base" },
          ),
        );
        break;
      case "name_desc":
        sorted.sort((a, b) =>
          (b.title || b.fileName).localeCompare(
            a.title || a.fileName,
            "id",
            { sensitivity: "base" },
          ),
        );
        break;
      case "size":
        sorted.sort((a, b) => b.size - a.size);
        break;
      case "size_asc":
        sorted.sort((a, b) => a.size - b.size);
        break;
      case "type": {
        sorted.sort((a, b) => {
          const ca = mimeSortCategory(a.mimeType);
          const cb = mimeSortCategory(b.mimeType);
          if (ca !== cb) return ca - cb;
          return (a.title || a.fileName).localeCompare(
            b.title || b.fileName,
            "id",
            { sensitivity: "base" },
          );
        });
        break;
      }
      case "uploader":
        sorted.sort((a, b) =>
          (a.uploadedBy.email ?? "").localeCompare(
            b.uploadedBy.email ?? "",
            "id",
          ),
        );
        break;
    }
    return sorted;
  }, [documentRows, sortKey]);

  const pagedVisibleDocuments = useMemo(
    () => visibleDocuments,
    [visibleDocuments],
  );

  const selectableDocIds = useMemo(
    () => visibleDocuments.map((d) => d.id),
    [visibleDocuments],
  );

  const allDocsSelected =
    selectableDocIds.length > 0 &&
    selectableDocIds.every((id) => selectedDocIds.has(id));

  const someDocsSelected = selectableDocIds.some((id) =>
    selectedDocIds.has(id),
  );

  const selectedDocs = useMemo(
    () => documentRows.filter((d) => selectedDocIds.has(d.id)),
    [documentRows, selectedDocIds],
  );

  const selectedFolderRows = useMemo(
    () => folders.filter((f) => selectedFolderIds.has(f.id)),
    [folders, selectedFolderIds],
  );

  const canManageAllSelected =
    selectedDocs.length > 0 &&
    selectedDocs.every(
      (d) => d.canEdit || isRoomManager,
    );

  /**
   * Pindah boleh berisi folder saja, file saja, atau campuran — jadi izinnya
   * dihitung terpisah dari `canManageAllSelected` (yang khusus file).
   */
  const canMoveAllSelected =
    selectedDocs.length + selectedFolderRows.length > 0 &&
    selectedDocs.every((d) => d.canEdit || isRoomManager) &&
    selectedFolderRows.every((f) => f.canEdit !== false || isRoomManager);

  const toggleDocSelection = useCallback((docId: string, next?: boolean) => {
    setSelectedDocIds((prev) => {
      const copy = new Set(prev);
      const on = next ?? !copy.has(docId);
      if (on) copy.add(docId);
      else copy.delete(docId);
      return copy;
    });
  }, []);

  const selectAllVisibleDocs = useCallback(() => {
    setSelectedDocIds(new Set(selectableDocIds));
  }, [selectableDocIds]);

  const clearDocSelection = useCallback(() => {
    setSelectedDocIds(new Set());
    setSelectedFolderIds(new Set());
  }, []);

  const toggleFolderSelection = useCallback((folderId: string) => {
    setSelectedFolderIds((previous) => {
      const next = new Set(previous);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  function updateJob(id: string, patch: Partial<UploadJob>) {
    setUploadJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    );
  }

  async function handleUploadFiles(files: File[]) {
    if (!files.length) return;

    const tagTokens = uploadTagsInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const batchTags = normalizeRoomDocumentTags(tagTokens);

    const batchId = Date.now();
    const jobs: UploadJob[] = files.map((f) => ({
      id: `${batchId}-${Math.random().toString(36).slice(2, 9)}`,
      fileName: f.name,
      progress: 0,
      status: "queued" as const,
    }));
    setUploadJobs((prev) => [...prev, ...jobs]);
    setUploadPanelExpanded(true);

    let ok = 0;
    let fail = 0;

    await asyncPool(files, 3, async (file, index) => {
      const job = jobs[index];
      if (!job) return;
      updateJob(job.id, { status: "uploading", progress: 0 });
      try {
        await uploadRoomDocumentViaApi(
          roomId,
          file,
          {
            title: title.trim() || undefined,
            folderId: currentFolderId,
            tags: batchTags,
          },
          (pct) => updateJob(job.id, { progress: pct }),
        );
        updateJob(job.id, { status: "done", progress: 100 });
        ok += 1;
      } catch (err) {
        const msg =
          actionErrorMessage(err, "Unggah gagal.");
        updateJob(job.id, { status: "error", error: msg, progress: 0 });
        fail += 1;
      }
    });

    if (ok > 0) {
      setTitle("");
      setUploadTagsInput("");
      toast.success(
        fail > 0
          ? `${ok} file berhasil, ${fail} gagal. Lihat panel unggah.`
          : ok === 1
            ? "File diunggah."
            : `${ok} file diunggah.`,
      );
      refreshDocuments();
    } else if (fail > 0) {
      toast.error("Semua unggah gagal. Lihat panel di bawah.");
    }
  }

  async function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    await handleUploadFiles(files);
  }

  async function onCreateFolder() {
    const name = newFolderName.trim();
    if (!name) {
      toast.error("Isi nama folder.");
      return;
    }
    setPending(true);
    try {
      const { id } = await createRoomDocumentFolder({
        roomId,
        name,
        parentId: currentFolderId,
      });
      setNewFolderName("");
      setCreateFolderOpen(false);
      toast.success("Folder dibuat.");
      navigateToFolder(id);
      refreshDocuments();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal membuat folder."));
    } finally {
      setPending(false);
    }
  }

  function openRename(folder: RoomDocumentFolderRow) {
    setRenameTarget({ kind: "folder", id: folder.id, name: folder.name });
    setRenameValue(folder.name);
  }

  const openRenameDoc = useCallback((d: RoomDocumentRow) => {
    const name = d.title?.trim() || d.fileName;
    setRenameTarget({ kind: "document", id: d.id, name });
    setRenameValue(name);
  }, []);

  async function onSaveRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error(
        renameTarget.kind === "folder"
          ? "Nama folder tidak boleh kosong."
          : "Nama file tidak boleh kosong.",
      );
      return;
    }
    setRenameBusy(true);
    try {
      if (renameTarget.kind === "folder") {
        await renameRoomDocumentFolder({ folderId: renameTarget.id, name });
        toast.success("Nama folder diperbarui.");
      } else {
        await renameRoomDocument({ documentId: renameTarget.id, title: name });
        toast.success("Nama file diperbarui.");
      }
      setRenameTarget(null);
      refreshDocuments();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menyimpan."));
    } finally {
      setRenameBusy(false);
    }
  }

  function onDeleteFolder(folder: RoomDocumentFolderRow) {
    setDestructiveTarget({ mode: "trash", kind: "folder", folder });
  }

  function openMoveFolder(folder: RoomDocumentFolderRow) {
    setMoveFolderTarget(folder);
    setMoveFolderDestination(folder.parentId ?? ROOT_FOLDER_VALUE);
  }

  async function onConfirmMoveFolder() {
    if (!moveFolderTarget) return;
    const parentId =
      moveFolderDestination === ROOT_FOLDER_VALUE
        ? null
        : moveFolderDestination;
    if (parentId === moveFolderTarget.parentId) return;

    setMoveFolderBusy(true);
    try {
      await moveRoomDocumentFolder({
        folderId: moveFolderTarget.id,
        parentId,
      });
      const targetName = parentId
        ? formatFolderPath(parentId, folders)
        : "Semua file (root)";
      toast.success(
        `Folder "${moveFolderTarget.name}" beserta isinya dipindahkan ke ${targetName}.`,
      );
      setMoveFolderTarget(null);
      refreshDocuments();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal memindahkan folder."));
    } finally {
      setMoveFolderBusy(false);
    }
  }

  const onDeleteDoc = useCallback((document: RoomDocumentRow) => {
    setDestructiveTarget({ mode: "trash", kind: "document", document });
  }, []);

  const onMoveDoc = useCallback(
    async (d: RoomDocumentRow, folderId: string | null) => {
      if (folderId === d.folderId) return;
      try {
        await moveRoomDocumentToFolder({ documentId: d.id, folderId });
        const targetName = folderId
          ? formatFolderPath(folderId, folders)
          : "Semua file (root)";
        toast.success(`Dipindahkan ke ${targetName}.`);
        refreshDocuments();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memindahkan."));
      }
    },
    [folders, refreshDocuments],
  );

  const onPreviewDoc = useCallback((d: RoomDocumentRow) => {
    setPreviewDoc(d);
  }, []);

  const onToggleFavorite = useCallback(
    async (kind: "document" | "folder", id: string) => {
      try {
        await toggleRoomDocumentFavorite({ kind, id });
        refreshDocuments();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal memperbarui favorit."));
      }
    },
    [refreshDocuments],
  );

  const onDownloadFolder = useCallback(
    async (folder: RoomDocumentFolderRow) => {
      setBulkBusy(true);
      try {
        await downloadRoomFolderZip(roomId, folder.id);
        toast.success(`Unduhan "${folder.name}" dimulai.`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengunduh folder."));
      } finally {
        setBulkBusy(false);
      }
    },
    [roomId],
  );

  const onDownloadDocument = useCallback(
    async (doc: RoomDocumentRow) => {
      try {
        await downloadSingleRoomDocument(roomId, doc.id, doc.fileName);
        toast.success(`"${doc.fileName}" diunduh.`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengunduh file."));
      }
    },
    [roomId],
  );

  const onBulkDownload = useCallback(async () => {
    const docIds = Array.from(selectedDocIds);
    const folderIds = Array.from(selectedFolderIds);
    const total = docIds.length + folderIds.length;
    if (!total) return;
    setBulkBusy(true);
    try {
      // Kasus paling umum: satu file saja → unduh langsung dengan nama aslinya.
      if (docIds.length === 1 && folderIds.length === 0) {
        const doc = documentRows.find((d) => d.id === docIds[0]);
        if (doc) await downloadSingleRoomDocument(roomId, doc.id, doc.fileName);
        else throw new Error("File tidak ditemukan.");
        toast.success("File diunduh.");
      } else {
        // File dan/atau folder digabung jadi satu ZIP oleh server.
        await downloadRoomItemsZip(roomId, {
          documentIds: docIds,
          folderIds,
        });
        toast.success(`${total} item diunduh (ZIP).`);
      }
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mengunduh."));
    } finally {
      setBulkBusy(false);
    }
  }, [documentRows, roomId, selectedDocIds, selectedFolderIds]);

  const onBulkDelete = useCallback(() => {
    const ids = Array.from(selectedDocIds);
    if (!ids.length) return;
    if (!canManageAllSelected) {
      toast.error("Anda tidak dapat menghapus satu atau lebih file terpilih.");
      return;
    }
    setDestructiveTarget({ mode: "trash", kind: "documents", documentIds: ids });
  }, [
    selectedDocIds,
    canManageAllSelected,
  ]);

  async function onConfirmDestructive() {
    const target = destructiveTarget;
    if (!target) return;
    setBulkBusy(true);
    try {
      if (target.mode === "trash" && target.kind === "folder") {
        await deleteRoomDocumentFolder(target.folder.id);
        toast.success(`Folder "${target.folder.name}" dipindahkan ke Sampah.`, {
          action: {
            label: "Urungkan",
            onClick: async () => {
              await restoreRoomDocumentFolder(target.folder.id);
              refreshDocuments();
            },
          },
        });
        if (currentFolderId === target.folder.id) {
          navigateToFolder(target.folder.parentId, { skipHistory: true });
        }
      } else if (target.mode === "trash" && target.kind === "document") {
        await deleteRoomDocument(target.document.id);
        toast.success("File dipindahkan ke Sampah.", {
          action: {
            label: "Urungkan",
            onClick: async () => {
              await restoreRoomDocuments([target.document.id]);
              refreshDocuments();
            },
          },
        });
      } else if (target.mode === "trash" && target.kind === "documents") {
        await deleteRoomDocuments(target.documentIds);
        clearDocSelection();
        toast.success(`${target.documentIds.length} file dipindahkan ke Sampah.`, {
          action: {
            label: "Urungkan",
            onClick: async () => {
              await restoreRoomDocuments(target.documentIds);
              refreshDocuments();
            },
          },
        });
      } else if (target.mode === "purge" && target.kind === "folder") {
        await purgeRoomDocumentFolder(target.folder.id);
        toast.success("Folder dan seluruh isinya dihapus permanen.");
      } else if (target.mode === "purge" && target.kind === "document") {
        await purgeRoomDocuments([target.document.id]);
        toast.success("File dihapus permanen.");
      }
      setDestructiveTarget(null);
      refreshDocuments();
    } catch (error) {
      toast.error(actionErrorMessage(error, "Operasi gagal."));
    } finally {
      setBulkBusy(false);
    }
  }

  async function onRestoreTrashFolder(folder: RoomDocumentFolderRow) {
    setBulkBusy(true);
    try {
      await restoreRoomDocumentFolder(folder.id);
      toast.success(`Folder "${folder.name}" dipulihkan.`);
      refreshDocuments();
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal memulihkan folder."));
    } finally {
      setBulkBusy(false);
    }
  }

  async function onRestoreTrashDocument(document: RoomDocumentRow) {
    setBulkBusy(true);
    try {
      await restoreRoomDocuments([document.id]);
      toast.success("File dipulihkan.");
      refreshDocuments();
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal memulihkan file."));
    } finally {
      setBulkBusy(false);
    }
  }

  const onBulkMove = useCallback(
    async (folderId: string | null) => {
      const ids = Array.from(selectedDocIds);
      const folderIds = Array.from(selectedFolderIds);
      if (!ids.length && !folderIds.length) return;
      if (!canMoveAllSelected) {
        toast.error("Anda tidak dapat memindahkan satu atau lebih item terpilih.");
        return;
      }
      setBulkBusy(true);
      try {
        if (folderIds.length > 0) {
          await moveRoomDocumentItems({
            documentIds: ids,
            folderIds,
            targetFolderId: folderId,
          });
        } else {
          await moveRoomDocumentsToFolder({ documentIds: ids, folderId });
        }
        const targetName = folderId
          ? formatFolderPath(folderId, folders)
          : "Semua file (root)";
        toast.success(
          `${ids.length + folderIds.length} item dipindahkan ke ${targetName}.`,
        );
        clearDocSelection();
        refreshDocuments();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memindahkan."));
      } finally {
        setBulkBusy(false);
      }
    },
    [
      selectedDocIds,
      selectedFolderIds,
      canMoveAllSelected,
      folders,
      clearDocSelection,
      refreshDocuments,
    ],
  );

  function startItemDrag(
    event: React.DragEvent,
    item: { kind: "document" | "folder"; id: string; label: string },
  ) {
    const isSelected =
      item.kind === "document"
        ? selectedDocIds.has(item.id)
        : selectedFolderIds.has(item.id);
    const payload = {
      documentIds: isSelected
        ? Array.from(selectedDocIds)
        : item.kind === "document"
          ? [item.id]
          : [],
      folderIds: isSelected
        ? Array.from(selectedFolderIds)
        : item.kind === "folder"
          ? [item.id]
          : [],
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DOCUMENT_ITEMS_DRAG_TYPE, JSON.stringify(payload));

    const total = payload.documentIds.length + payload.folderIds.length;
    const ghost = mountDragGhost(item.label, item.kind, Math.max(0, total - 1));
    event.dataTransfer.setDragImage(ghost, 16, 16);
  }

  async function dropItemsIntoFolder(
    event: React.DragEvent,
    targetFolderId: string | null,
  ) {
    const raw = event.dataTransfer.getData(DOCUMENT_ITEMS_DRAG_TYPE);
    if (!raw) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const payload = JSON.parse(raw) as {
        documentIds: string[];
        folderIds: string[];
      };
      setBulkBusy(true);
      const result = await moveRoomDocumentItems({
        ...payload,
        targetFolderId,
      });
      toast.success(
        `${result.movedDocuments + result.movedFolders} item dipindahkan.`,
      );
      clearDocSelection();
      refreshDocuments();
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal memindahkan item."));
    } finally {
      setBulkBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    // Seret item internal (pindah folder) tak boleh diperlakukan sebagai unggah,
    // meski browser ikut menyelipkan "Files" ke dataTransfer.
    if (e.dataTransfer.types.includes(DOCUMENT_ITEMS_DRAG_TYPE)) return;
    e.preventDefault();
    setIsDragging(false);
    if (pending || uploadBusy || libraryScope !== "browse") return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void handleUploadFiles(files);
  }

  const uploadTargetLabel = formatFolderPath(currentFolderId, folders);

  const inputId = `room-doc-file-${roomId}`;
  const folderEmpty =
    childFolders.length === 0 &&
    visibleDocuments.length === 0;
  const totalDocs = storageSummary.fileCount;

  const clearFilters = () => {
    setTypeFilter("all");
    setDateFilter("all");
    setUploaderFilter("");
    setTagFilter("__all__");
  };
  const uploaderFilterLabel = uploaderFilter
    ? (() => {
        const member = documentMembers.find((m) => m.id === uploaderFilter);
        return member?.name || member?.email || "Pengunggah";
      })()
    : "";
  const filterChips: ActiveFilterChip[] = [
    typeFilter !== "all"
      ? { key: "type", label: TYPE_FILTER_LABEL[typeFilter], onRemove: () => setTypeFilter("all") }
      : null,
    dateFilter !== "all"
      ? { key: "date", label: DATE_FILTER_LABEL[dateFilter], onRemove: () => setDateFilter("all") }
      : null,
    uploaderFilter
      ? { key: "uploader", label: `Oleh ${uploaderFilterLabel}`, onRemove: () => setUploaderFilter("") }
      : null,
    tagFilter !== "__all__"
      ? { key: "tag", label: `#${tagFilter}`, onRemove: () => setTagFilter("__all__") }
      : null,
  ].filter((chip): chip is ActiveFilterChip => chip != null);
  const hasNarrowing = isSearchActive || filterChips.length > 0;
  const resultCount = documentTotal + childFolders.length;

  const navigateFromSheet = (folderId: string | null) => {
    navigateToFolder(folderId);
    setFolderSheetOpen(false);
  };

  /** Urutan file untuk prev/next di dialog pratinjau (folder / filter saat ini). */
  const previewPlaylist = useMemo(() => visibleDocuments, [visibleDocuments]);

  const scopeItems = [
    ["browse", Folder],
    ["favorites", Star],
    ["recent", Clock3],
    ["trash", Trash2],
  ] as const;

  const folderTreeProps = {
    folders,
    currentFolderId,
    rootFileCount,
    isRoomManager,
    onRename: openRename,
    onMove: openMoveFolder,
    onFavorite: (folder: RoomDocumentFolderRow) => void onToggleFavorite("folder", folder.id),
    onShare: (folder: RoomDocumentFolderRow) =>
      setShareTarget({ kind: "folder", id: folder.id, name: folder.name }),
    onDelete: (f: RoomDocumentFolderRow) => void onDeleteFolder(f),
    onDownload: (f: RoomDocumentFolderRow) => void onDownloadFolder(f),
  };

  const storageLine = (
    <p className="text-muted-foreground text-xs tabular-nums">
      {formatFileSize(totalSize)} terpakai oleh {totalDocs} file
    </p>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden picker — dipicu dari tombol Unggah di header & empty state */}
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        disabled={pending || uploadBusy}
        onChange={(e) => void onFileInput(e)}
      />

      {/* Navigasi ringkas untuk layar < lg — sidebar penuh hanya di desktop */}
      <div className="flex items-center gap-2 lg:hidden">
        <nav
          aria-label="Tampilan pustaka"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
        >
          {scopeItems.map(([scope, Icon]) => (
            <button
              key={scope}
              type="button"
              onClick={() => changeLibraryScope(scope)}
              aria-current={libraryScope === scope ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm outline-none focus-visible:ring-2",
                libraryScope === scope
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {SCOPE_LABEL[scope]}
              {scope === "trash" && trashFolders.length > 0 ? (
                <span className="tabular-nums opacity-70">{trashFolders.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        {libraryScope === "browse" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFolderSheetOpen(true)}
          >
            <FolderOpen className="size-4" />
            Folder
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Riwayat aktivitas"
          title="Riwayat aktivitas"
          onClick={() => setActivityOpen(true)}
        >
          <Clock3 className="size-4" />
        </Button>
      </div>

      <Sheet open={folderSheetOpen} onOpenChange={setFolderSheetOpen}>
        <SheetContent side="left" className="gap-0">
          <SheetHeader>
            <SheetTitle>Folder</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <DriveFolderTree {...folderTreeProps} onNavigate={navigateFromSheet} />
          </div>
          <div className="border-border border-t px-4 py-3">{storageLine}</div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Sidebar — Drive ruangan (desktop) */}
        <aside className="border-border bg-card sticky top-14 z-10 hidden max-h-[calc(100vh-4.5rem)] w-64 shrink-0 flex-col gap-3 rounded-xl border p-2 lg:flex">
          <nav aria-label="Tampilan pustaka" className="flex flex-col gap-0.5">
            {scopeItems.map(([scope, Icon]) => (
              <button
                key={scope}
                type="button"
                onClick={() => changeLibraryScope(scope)}
                aria-current={libraryScope === scope ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-2",
                  libraryScope === scope
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{SCOPE_LABEL[scope]}</span>
                {scope === "trash" && trashFolders.length > 0 ? (
                  <span className="text-xs tabular-nums opacity-70">
                    {trashFolders.length}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          {libraryScope === "browse" ? (
            <div className="border-border flex min-h-0 flex-1 flex-col gap-1 border-t pt-3">
              <div className="flex items-center justify-between gap-2 px-2.5">
                <h2 className="text-sm font-medium">Folder</h2>
                <span
                  className="text-muted-foreground"
                  title="File diunggah ke folder yang sedang dibuka. Seret file atau folder ke folder lain untuk memindahkannya. Pencarian mencakup seluruh ruangan."
                >
                  <Info className="size-3.5" aria-hidden />
                  <span className="sr-only">
                    File diunggah ke folder yang sedang dibuka. Seret item ke
                    folder lain untuk memindahkannya.
                  </span>
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <DriveFolderTree {...folderTreeProps} onNavigate={navigateToFolder} />
              </div>
            </div>
          ) : null}

          <div className="border-border space-y-1 border-t px-2.5 pt-3 pb-1">
            {storageLine}
            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-xs outline-none focus-visible:ring-2"
            >
              <Clock3 className="size-3.5" />
              Riwayat aktivitas
            </button>
          </div>
        </aside>

        {/* Main — area konten sekaligus zona tarik-lepas seluruh panel */}
        <div
          onDragOver={(e) => {
            const types = Array.from(e.dataTransfer.types);
            // Abaikan seret item internal — itu pindah folder, bukan unggah.
            if (types.includes(DOCUMENT_ITEMS_DRAG_TYPE)) return;
            if (!types.includes("Files")) return;
            e.preventDefault();
            if (!isDragging) setIsDragging(true);
          }}
          onDragEnter={(e) => {
            const types = Array.from(e.dataTransfer.types);
            if (types.includes(DOCUMENT_ITEMS_DRAG_TYPE)) return;
            if (!types.includes("Files")) return;
            e.preventDefault();
            if (!isDragging) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setIsDragging(false);
          }}
          onDrop={handleDrop}
          className="relative min-w-0 flex-1 space-y-4"
        >
          {/* Overlay tarik-lepas — hanya tampil saat menyeret file */}
          {isDragging ? (
            <div className="border-primary bg-primary/10 motion-safe:animate-in motion-safe:fade-in-0 pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center backdrop-blur-sm">
              <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl shadow-lg">
                <CloudUpload className="size-7" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Lepas untuk mengunggah</p>
                <p className="text-muted-foreground text-xs">
                  ke {uploadTargetLabel}
                </p>
              </div>
            </div>
          ) : null}

          <header className="space-y-3">
            {/* Baris 1 — lokasi saat ini sebagai judul + aksi utama */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div
                className="flex min-w-0 flex-1 items-center gap-1"
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes(DOCUMENT_ITEMS_DRAG_TYPE)) event.preventDefault();
                }}
                onDrop={(event) => void dropItemsIntoFolder(event, currentFolderId)}
                title="Lepaskan item di sini untuk memindahkannya ke lokasi ini"
              >
                {libraryScope === "browse" && canGoBackFolder ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={goBackToPreviousFolder}
                    aria-label={
                      previousFolderLabel
                        ? `Kembali ke ${previousFolderLabel}`
                        : "Kembali ke folder sebelumnya"
                    }
                    title={
                      previousFolderLabel
                        ? `Kembali ke ${previousFolderLabel}`
                        : "Kembali ke folder sebelumnya"
                    }
                    className="-ml-1 shrink-0"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                ) : null}
                {libraryScope === "browse" ? (
                  <DriveBreadcrumb
                    currentFolderId={currentFolderId}
                    folders={folders}
                    onNavigate={navigateToFolder}
                  />
                ) : (
                  <h1 className="text-lg font-semibold">{SCOPE_LABEL[libraryScope]}</h1>
                )}
              </div>
              {libraryScope === "browse" ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateFolderOpen(true)}
                    disabled={pending}
                  >
                    <FolderPlus className="size-4" />
                    <span className="hidden sm:inline">Folder baru</span>
                  </Button>
                  {/* Unggah + opsi (judul & tag) sebagai caret */}
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-r-none"
                      disabled={pending || uploadBusy || libraryScope !== "browse"}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {pending || uploadBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      Unggah
                    </Button>
                    <Popover
                      open={uploadOptionsOpen}
                      onOpenChange={setUploadOptionsOpen}
                    >
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            size="sm"
                            aria-label="Opsi unggah (judul & tag)"
                            title="Opsi unggah berikutnya"
                            className="border-primary-foreground/25 rounded-l-none border-l px-1.5"
                          >
                            <ChevronDown className="size-4" />
                            {title.trim() || uploadTagsInput.trim() ? (
                              <span
                                className="bg-primary-foreground size-1.5 rounded-full"
                                aria-hidden
                              />
                            ) : null}
                          </Button>
                        }
                      />
                      <PopoverContent align="end" className="w-80">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">Opsi unggah berikutnya</p>
                          <p className="text-muted-foreground text-xs">
                            Berlaku untuk file yang diunggah setelah ini.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="doc-title" className="text-xs">
                            Judul (opsional)
                          </Label>
                          <Input
                            id="doc-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Contoh: Briefing Q3"
                            disabled={pending || uploadBusy}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="doc-upload-tags" className="text-xs">
                            Tag batch (opsional)
                          </Label>
                          <Input
                            id="doc-upload-tags"
                            value={uploadTagsInput}
                            onChange={(e) => setUploadTagsInput(e.target.value)}
                            placeholder="footage, raw, approved"
                            disabled={pending || uploadBusy}
                            className="h-9"
                          />
                          <p className="text-muted-foreground text-[11px]">
                            Maks. 20 tag; huruf kecil otomatis. Pisahkan dengan
                            koma/spasi.
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Baris 2 — cari, urutkan, saring, tampilan */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="border-input bg-background focus-within:border-ring focus-within:ring-ring/40 flex h-9 min-w-[12rem] flex-1 items-center gap-2 rounded-lg border px-3 transition-colors focus-within:ring-2">
                {libraryLoading && isSearchActive ? (
                  <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
                )}
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, tag, atau isi file"
                  aria-label="Cari dokumen"
                  className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {search ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded outline-none focus-visible:ring-2"
                    aria-label="Bersihkan pencarian"
                    onClick={() => setSearch("")}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {/* Urutan (+ ukuran kartu saat grid) */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button type="button" size="sm" variant="outline" className="h-9" title="Urutkan">
                        <ArrowDownAZ className="size-4" />
                        <span className="hidden sm:inline">{SORT_LABEL[sortKey]}</span>
                        <ChevronDown className="size-3.5 opacity-60" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" sideOffset={4} className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Urutkan</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={sortKey}
                        onValueChange={(v) => setSortKey(v as SortKey)}
                      >
                        {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                          <DropdownMenuRadioItem key={key} value={key}>
                            {SORT_LABEL[key]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                    {view === "grid" ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Ukuran kartu</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={density}
                            onValueChange={(v) => setDensity(v as GridDensity)}
                          >
                            {(Object.keys(DENSITY_LABEL) as GridDensity[]).map((key) => (
                              <DropdownMenuRadioItem key={key} value={key}>
                                {DENSITY_LABEL[key]}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Filter — yang aktif juga tampil sebagai chip di bawah */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button type="button" size="sm" variant="outline" className="h-9" title="Saring">
                        <SlidersHorizontal className="size-4" />
                        <span className="hidden sm:inline">Filter</span>
                        {filterChips.length > 0 ? (
                          <span className="bg-primary text-primary-foreground inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold tabular-nums">
                            {filterChips.length}
                          </span>
                        ) : null}
                      </Button>
                    }
                  />
                  <DropdownMenuContent
                    align="end"
                    sideOffset={4}
                    className="max-h-[70vh] w-60 overflow-y-auto"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Tipe</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={typeFilter}
                        onValueChange={(value) => setTypeFilter(value as TypeFilter)}
                      >
                        {(Object.keys(TYPE_FILTER_LABEL) as TypeFilter[]).map((key) => (
                          <DropdownMenuRadioItem key={key} value={key}>
                            {TYPE_FILTER_LABEL[key]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Waktu unggah</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={dateFilter}
                        onValueChange={(value) => setDateFilter(value as DateFilter)}
                      >
                        {(Object.keys(DATE_FILTER_LABEL) as DateFilter[]).map((key) => (
                          <DropdownMenuRadioItem key={key} value={key}>
                            {DATE_FILTER_LABEL[key]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Pengunggah</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={uploaderFilter || "__all__"}
                        onValueChange={(value) => setUploaderFilter(value === "__all__" ? "" : value)}
                      >
                        <DropdownMenuRadioItem value="__all__">Semua orang</DropdownMenuRadioItem>
                        {documentMembers.map((member) => (
                          <DropdownMenuRadioItem key={member.id} value={member.id}>
                            {member.name || member.email}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>

                    {allTagsInRoom.length > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Tag</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={tagFilter}
                            onValueChange={(v) => setTagFilter(v ?? "__all__")}
                          >
                            <DropdownMenuRadioItem value="__all__">Semua tag</DropdownMenuRadioItem>
                            {allTagsInRoom.map((t) => (
                              <DropdownMenuRadioItem key={t} value={t}>
                                <Tag className="size-3.5 opacity-60" /> {t}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>
                      </>
                    ) : null}

                    {!selectionActive && selectableDocIds.length > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={selectAllVisibleDocs}>
                          <Check className="size-3.5" /> Pilih semua file
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Toggle tampilan grid / list */}
                <div
                  role="group"
                  aria-label="Tampilan"
                  className="border-input bg-background flex h-9 shrink-0 items-center rounded-lg border p-0.5"
                >
                  {([
                    ["grid", LayoutGrid, "Tampilan grid"],
                    ["list", LayoutList, "Tampilan daftar"],
                  ] as const).map(([mode, Icon, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        "focus-visible:ring-ring inline-flex h-full items-center rounded-md px-2 outline-none focus-visible:ring-2",
                        view === mode
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setView(mode)}
                      aria-pressed={view === mode}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ActiveFilterChips chips={filterChips} onClearAll={clearFilters} />

            {isSearchActive ? (
              <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
                {libraryLoading
                  ? "Mencari di seluruh ruangan…"
                  : `${resultCount} hasil di seluruh ruangan, termasuk isi file`}
              </p>
            ) : null}
          </header>

          {selectionActive ? (
            <div className="border-primary/30 bg-primary/5 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
              <Checkbox
                checked={allDocsSelected}
                onCheckedChange={(v) => {
                  if (v === true) selectAllVisibleDocs();
                  else clearDocSelection();
                }}
                aria-label="Pilih semua file di tampilan"
              />
              <span className="text-sm font-medium tabular-nums">
                {selectedDocIds.size + selectedFolderIds.size} dipilih
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                disabled={bulkBusy || !someDocsSelected}
                onClick={() => {
                  if (allDocsSelected) clearDocSelection();
                  else selectAllVisibleDocs();
                }}
              >
                {allDocsSelected ? "Batalkan semua" : "Pilih semua"}
              </Button>
              <div className="bg-border mx-1 hidden h-5 w-px sm:block" aria-hidden />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                disabled={bulkBusy || (selectedDocIds.size === 0 && selectedFolderIds.size === 0)}
                onClick={() => void onBulkDownload()}
              >
                <Download className="size-3.5" />
                Unduh
              </Button>
              {canMoveAllSelected ? (
                <>
                  <BulkMoveFolderMenu
                    folders={folders}
                    disabled={bulkBusy}
                    onMove={(folderId) => void onBulkMove(folderId)}
                    trigger={
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8"
                        disabled={bulkBusy}
                      >
                        <FolderInput className="size-3.5" />
                        Pindahkan
                      </Button>
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8"
                    disabled={bulkBusy || selectedFolderIds.size > 0 || selectedDocIds.size === 0}
                    onClick={() => void onBulkDelete()}
                  >
                    <Trash2 className="size-3.5" />
                    Hapus
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground ml-auto h-8"
                disabled={bulkBusy}
                onClick={clearDocSelection}
                aria-label="Bersihkan pilihan"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : null}

          {/* Folder + file */}
          {libraryScope === "trash" ? (
            childFolders.length === 0 && documentRows.length === 0 ? (
              <EmptyState
                icon={Trash2}
                title="Sampah kosong"
                description="File dan folder yang dihapus akan muncul di sini sebelum dihapus permanen."
                className="p-12"
              />
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  Pulihkan item ke lokasi asalnya, atau hapus permanen.
                </p>
                <div className="border-border bg-card overflow-hidden rounded-xl border">
                <ul className="divide-border divide-y">
                  {childFolders.map((folder) => (
                    <li key={folder.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="bg-amber-500/10 text-amber-600 flex size-9 items-center justify-center rounded-lg">
                        <Folder className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{folder.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {folder._count.recursiveDocuments ?? folder._count.documents} file
                          {folder.trashedAt ? <> · dihapus {formatDate(folder.trashedAt)}</> : null}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void onRestoreTrashFolder(folder)}>
                        <RotateCcw className="size-3.5" /> Pulihkan
                      </Button>
                      <Button size="icon-sm" variant="ghost" disabled={bulkBusy} aria-label="Hapus folder permanen" onClick={() => setDestructiveTarget({ mode: "purge", kind: "folder", folder })}>
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </li>
                  ))}
                  {documentRows.map((document) => (
                    <li key={document.id} className="flex items-center gap-3 px-4 py-3">
                      <FileTypeBadge mimeType={document.mimeType} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{document.title || document.fileName}</p>
                        <p className="text-muted-foreground truncate text-xs tabular-nums">
                          {formatFileSize(document.size)}
                          {document.trashedAt ? <> · dihapus {formatDate(document.trashedAt)}</> : null}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void onRestoreTrashDocument(document)}>
                        <RotateCcw className="size-3.5" /> Pulihkan
                      </Button>
                      <Button size="icon-sm" variant="ghost" disabled={bulkBusy} aria-label="Hapus file permanen" onClick={() => setDestructiveTarget({ mode: "purge", kind: "document", document })}>
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            )
          ) : folderEmpty ? (
            libraryLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
                <Loader2 className="size-4 animate-spin" /> Memuat…
              </div>
            ) : hasNarrowing ? (
              <EmptyState
                icon={Search}
                title="Tidak ada yang cocok"
                description={
                  isSearchActive
                    ? "Coba kata kunci lain, atau lepas filter yang aktif."
                    : "Tidak ada file yang lolos filter ini di lokasi sekarang."
                }
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      clearFilters();
                    }}
                  >
                    <X className="size-4" />
                    {isSearchActive ? "Hapus pencarian & filter" : "Hapus filter"}
                  </Button>
                }
                className="p-12"
              />
            ) : libraryScope === "favorites" ? (
              <EmptyState
                icon={Star}
                title="Belum ada favorit"
                description="Tandai file atau folder sebagai favorit lewat menu aksinya agar mudah ditemukan di sini."
                className="p-12"
              />
            ) : libraryScope === "recent" ? (
              <EmptyState
                icon={Clock3}
                title="Belum ada file terbaru"
                description="File yang baru diunggah ke ruangan ini akan muncul di sini."
                className="p-12"
              />
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="Folder ini kosong"
                description="Seret file ke area ini, atau pilih file dari perangkat."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pending || uploadBusy}
                  >
                    <Upload className="size-4" />
                    Unggah file
                  </Button>
                }
                className="p-12"
              />
            )
          ) : view === "grid" ? (
            <div className="space-y-5">
              {/* Seksi folder — kartu ringkas terpisah dari file */}
              {childFolders.length > 0 ? (
                <section className="space-y-2.5">
                  <SectionHeading label="Folder" count={childFolders.length} />
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {(showAllFolders
                      ? childFolders
                      : childFolders.slice(0, FOLDER_COLLAPSE_LIMIT)
                    ).map((f) => (
                      <DriveFolderChip
                        key={f.id}
                        folder={f}
                        isRoomManager={isRoomManager}
                        onOpen={() => navigateToFolder(f.id)}
                        onRename={() => openRename(f)}
                        onMove={() => openMoveFolder(f)}
                        onFavorite={() => void onToggleFavorite("folder", f.id)}
                        onShare={() => setShareTarget({ kind: "folder", id: f.id, name: f.name })}
                        selected={selectedFolderIds.has(f.id)}
                        selectionActive={selectionActive}
                        onToggleSelect={isRoomManager || f.canEdit ? () => toggleFolderSelection(f.id) : undefined}
                        onItemDragStart={isRoomManager || f.canEdit ? (event) => startItemDrag(event, { kind: "folder", id: f.id, label: f.name }) : undefined}
                        onItemDragEnd={removeDragGhost}
                        onItemsDrop={(event) => void dropItemsIntoFolder(event, f.id)}
                        onDelete={() => void onDeleteFolder(f)}
                        onDownload={() => void onDownloadFolder(f)}
                      />
                    ))}
                  </ul>
                  {childFolders.length > FOLDER_COLLAPSE_LIMIT ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllFolders((v) => !v)}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          showAllFolders && "rotate-180",
                        )}
                      />
                      {showAllFolders
                        ? "Ciutkan folder"
                        : `Lihat semua ${childFolders.length} folder`}
                    </Button>
                  ) : null}
                </section>
              ) : null}

              {/* Seksi file */}
              {pagedVisibleDocuments.length > 0 ? (
                <section className="space-y-2.5">
                  {childFolders.length > 0 ? (
                    <SectionHeading label="File" count={documentTotal} />
                  ) : null}
                  <ul className={cn("grid", DENSITY_GRID[density])}>
                    {pagedVisibleDocuments.map((d, idx) => (
                      <DocCard
                        key={d.id}
                        doc={d}
                        folders={folders}
                        showFolderHint={isSearchActive}
                        compact={density !== "besar"}
                        canManage={d.canEdit || isRoomManager}
                        selected={selectedDocIds.has(d.id)}
                        selectionActive={selectionActive}
                        onToggleSelect={() => toggleDocSelection(d.id)}
                        onPreview={onPreviewDoc}
                        onDelete={onDeleteDoc}
                        onMove={onMoveDoc}
                        onRename={openRenameDoc}
                        onDownload={(d) => void onDownloadDocument(d)}
                        onFavorite={(d) => void onToggleFavorite("document", d.id)}
                        onShare={(d) => setShareTarget({ kind: "document", id: d.id, name: d.title || d.fileName })}
                        onVersions={(d) => setVersionTarget({ id: d.id, name: d.title || d.fileName, currentVersion: d.currentVersion, canManage: d.canEdit || isRoomManager })}
                        onItemDragStart={(event) => startItemDrag(event, { kind: "document", id: d.id, label: d.title?.trim() || d.fileName })}
                        onItemDragEnd={removeDragGhost}
                        // 4 ubin pertama (1 baris di breakpoint 2xl) berada di
                        // atas fold — beri `priority` agar Next.js set
                        // `loading="eager"` + `fetchPriority="high"`.
                        priority={idx < 4}
                      />
                    ))}
                  </ul>
                </section>
              ) : !hasNarrowing && childFolders.length > 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada file langsung di folder ini. Seret file ke sini untuk mengunggah.
                </p>
              ) : null}
            </div>
          ) : (
            <DocList
              childFolders={childFolders}
              docs={pagedVisibleDocuments}
              folders={folders}
              showFolderHint={isSearchActive}
              isRoomManager={isRoomManager}
              onOpenFolder={(id) => navigateToFolder(id)}
              onRenameFolder={openRename}
              onMoveFolder={openMoveFolder}
              onFavoriteFolder={(folder) => void onToggleFavorite("folder", folder.id)}
              onShareFolder={(folder) => setShareTarget({ kind: "folder", id: folder.id, name: folder.name })}
              onDeleteFolder={(f) => void onDeleteFolder(f)}
              onDownloadFolder={(f) => void onDownloadFolder(f)}
              selectedDocIds={selectedDocIds}
              selectedFolderIds={selectedFolderIds}
              selectionActive={selectionActive}
              allDocsSelected={allDocsSelected}
              onToggleSelect={toggleDocSelection}
              onToggleFolderSelect={toggleFolderSelection}
              onDocumentDragStart={(event, document) => startItemDrag(event, { kind: "document", id: document.id, label: document.title?.trim() || document.fileName })}
              onFolderDragStart={(event, folder) => startItemDrag(event, { kind: "folder", id: folder.id, label: folder.name })}
              onItemDragEnd={removeDragGhost}
              onFolderDrop={(event, folder) => void dropItemsIntoFolder(event, folder.id)}
              onSelectAll={selectAllVisibleDocs}
              onClearSelection={clearDocSelection}
              onPreview={onPreviewDoc}
              onDelete={onDeleteDoc}
              onMove={onMoveDoc}
              onRenameDocument={openRenameDoc}
              onDownloadDocument={(d) => void onDownloadDocument(d)}
              onFavoriteDocument={(d) => void onToggleFavorite("document", d.id)}
              onShareDocument={(d) => setShareTarget({ kind: "document", id: d.id, name: d.title || d.fileName })}
              onVersionsDocument={(d) => setVersionTarget({ id: d.id, name: d.title || d.fileName, currentVersion: d.currentVersion, canManage: d.canEdit || isRoomManager })}
            />
          )}
          {nextDocumentOffset != null ? (
            <div className="flex flex-col items-center gap-2 pt-3">
              <p className="text-muted-foreground text-center text-xs tabular-nums">
                {pagedVisibleDocuments.length} dari {documentTotal} file ditampilkan
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={libraryLoading}
                  onClick={() =>
                    void loadLibrary({
                      append: true,
                      offset: nextDocumentOffset ?? undefined,
                    })
                  }
              >
                {libraryLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Muat lebih banyak
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {uploadJobs.length > 0 ? (
        <div className="border-border bg-card shadow-lg fixed right-4 bottom-4 z-50 flex max-h-[min(440px,55vh)] w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-xl border">
          <button
            type="button"
            className="border-border hover:bg-muted/50 flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left text-sm font-medium"
            onClick={() => setUploadPanelExpanded((v) => !v)}
          >
            <span className="min-w-0 truncate">
              Unggah file
              <span className="text-muted-foreground ml-1.5 font-normal tabular-nums">
                (
                {uploadJobs.filter((j) => j.status === "done").length}/
                {uploadJobs.length} selesai)
              </span>
            </span>
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
                uploadPanelExpanded ? "rotate-180" : "",
              )}
              aria-hidden
            />
          </button>
          {uploadPanelExpanded ? (
            <ul className="divide-border max-h-[min(340px,45vh)] divide-y overflow-y-auto overscroll-contain p-0">
              {[...uploadJobs].reverse().map((job) => (
                <li key={job.id} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="min-w-0 flex-1 truncate text-xs font-medium"
                      title={job.fileName}
                    >
                      {job.fileName}
                    </span>
                    {job.status === "queued" ? (
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        Antre
                      </span>
                    ) : null}
                    {job.status === "uploading" ? (
                      <Loader2 className="text-primary size-3.5 shrink-0 animate-spin" />
                    ) : null}
                    {job.status === "done" ? (
                      <CircleCheck className="text-emerald-600 size-3.5 shrink-0 dark:text-emerald-400" />
                    ) : null}
                    {job.status === "error" ? (
                      <CircleAlert className="text-destructive size-3.5 shrink-0" />
                    ) : null}
                  </div>
                  {job.status === "uploading" || job.status === "queued" ? (
                    <Progress
                      value={job.status === "queued" ? 0 : job.progress}
                      className="h-1"
                    />
                  ) : null}
                  {job.status === "error" && job.error ? (
                    <p className="text-destructive text-[11px] leading-snug">
                      {job.error}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 border-t px-2 py-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() =>
                setUploadJobs((prev) =>
                  prev.filter(
                    (j) => j.status !== "done" && j.status !== "error",
                  ),
                )
              }
              disabled={!uploadJobs.some(
                (j) => j.status === "done" || j.status === "error",
              )}
            >
              Hapus yang selesai / gagal
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive h-8 text-xs"
              onClick={() => setUploadJobs([])}
              disabled={uploadBusy}
            >
              Tutup panel
            </Button>
          </div>
        </div>
      ) : null}

      {/* Preview dialog */}
      <RoomDocumentPreviewDialog
        doc={previewDoc}
        previewPlaylist={previewPlaylist}
        onNavigate={onPreviewDoc}
        onDownload={(d) => void onDownloadDocument(d)}
        canManageTags={
          previewDoc
            ? previewDoc.canEdit || isRoomManager
            : false
        }
        onClose={() => setPreviewDoc(null)}
        currentUserId={currentUserId}
        isRoomManager={isRoomManager}
      />

      <RoomDocumentShareDialog
        target={shareTarget}
        onClose={() => setShareTarget(null)}
      />
      <RoomDocumentActivityDialog roomId={roomId} open={activityOpen} onClose={() => setActivityOpen(false)} />
      <RoomDocumentVersionsDialog
        roomId={roomId}
        target={versionTarget}
        canManage={versionTarget?.canManage ?? false}
        onClose={() => setVersionTarget(null)}
        onUpdated={refreshDocuments}
      />

      <Dialog
        open={destructiveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) setDestructiveTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {destructiveTarget?.mode === "purge"
                ? "Hapus permanen?"
                : "Pindahkan ke Sampah?"}
            </DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            {destructiveTarget?.mode === "purge" ? (
              <p>Tindakan ini tidak dapat diurungkan dan file fisik akan dihapus dari penyimpanan.</p>
            ) : (
              <p>Item dapat dipulihkan dari Sampah. Setelah tindakan selesai, opsi Urungkan juga akan tersedia.</p>
            )}
            {destructiveTarget?.kind === "folder" ? (
              <p className="text-foreground font-medium">
                Folder “{destructiveTarget.folder.name}” beserta seluruh subfolder dan file di dalamnya.
              </p>
            ) : destructiveTarget?.kind === "document" ? (
              <p className="text-foreground font-medium">
                {destructiveTarget.document.title || destructiveTarget.document.fileName}
              </p>
            ) : destructiveTarget?.kind === "documents" ? (
              <p className="text-foreground font-medium">
                {destructiveTarget.documentIds.length} file terpilih
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={bulkBusy} onClick={() => setDestructiveTarget(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkBusy}
              onClick={() => void onConfirmDestructive()}
            >
              {bulkBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {destructiveTarget?.mode === "purge" ? "Hapus permanen" : "Pindahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create folder dialog */}
      <Dialog
        open={createFolderOpen}
        onOpenChange={(open) => {
          setCreateFolderOpen(open);
          if (!open) setNewFolderName("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Folder baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Logo, Legal, Footage…"
              maxLength={80}
              disabled={pending}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void onCreateFolder();
              }}
            />
            <p className="text-muted-foreground text-xs">
              Dibuat di dalam{" "}
              <span className="text-foreground font-medium">
                {uploadTargetLabel}
              </span>
              .
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateFolderOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={pending || !newFolderName.trim()}
              onClick={() => void onCreateFolder()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Buat folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move folder dialog */}
      <Dialog
        open={moveFolderTarget !== null}
        onOpenChange={(open) => {
          if (!open && !moveFolderBusy) setMoveFolderTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pindahkan folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
              <FolderInput className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {moveFolderTarget?.name}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  Semua subfolder dan file di dalamnya akan ikut dipindahkan.
                </p>
                <p className="text-muted-foreground mt-1 truncate text-[11px]">
                  Lokasi saat ini: {formatFolderPath(
                    moveFolderTarget?.parentId ?? null,
                    folders,
                  )}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="move-folder-destination">Folder tujuan</Label>
              <select
                id="move-folder-destination"
                value={moveFolderDestination}
                onChange={(event) =>
                  setMoveFolderDestination(event.target.value)
                }
                disabled={moveFolderBusy}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full min-w-0 truncate rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value={ROOT_FOLDER_VALUE}>Semua file (root)</option>
                {folderMoveChoices.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {formatFolderPath(folder.id, folders)}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Folder ini dan seluruh turunannya tidak ditampilkan sebagai
                tujuan.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMoveFolderTarget(null)}
              disabled={moveFolderBusy}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={
                moveFolderBusy ||
                (moveFolderDestination === ROOT_FOLDER_VALUE
                  ? moveFolderTarget?.parentId == null
                  : moveFolderDestination === moveFolderTarget?.parentId)
              }
              onClick={() => void onConfirmMoveFolder()}
            >
              {moveFolderBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FolderInput className="size-4" />
              )}
              Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog — folder atau file */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {renameTarget?.kind === "document"
                ? "Ganti nama file"
                : "Ganti nama folder"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={renameTarget?.kind === "document" ? 200 : 80}
            disabled={renameBusy}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) void onSaveRename();
            }}
          />
          {renameTarget?.kind === "document" ? (
            <p className="text-muted-foreground text-xs">
              Mengubah nama tampilan file. Nama file asli saat diunduh tidak
              berubah.
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameTarget(null)}
              disabled={renameBusy}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={renameBusy || !renameValue.trim()}
              onClick={() => void onSaveRename()}
            >
              {renameBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Sub components ----------------------------- */

function BulkMoveFolderMenu({
  folders,
  onMove,
  trigger,
  disabled,
}: {
  folders: RoomDocumentFolderRow[];
  onMove: (folderId: string | null) => void | Promise<void>;
  trigger: React.ReactElement;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} disabled={disabled} />
      <DropdownMenuContent align="start" sideOffset={4} className="min-w-56">
        <div className="text-muted-foreground flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium">
          <FolderInput className="size-3.5 opacity-70" aria-hidden />
          Pindahkan {`file terpilih`}
        </div>
        <DropdownMenuSeparator />
        <FolderChoiceItem
          icon={<Folder className="size-3.5 opacity-70" />}
          label="Semua file (root)"
          active={false}
          onSelect={() => void onMove(null)}
        />
        {folders.length > 0 ? <DropdownMenuSeparator /> : null}
        {flattenFoldersForPicker(folders).map((f) => (
          <FolderChoiceItem
            key={f.id}
            icon={<Folder className="size-3.5 opacity-70" />}
            label={f.depth > 0 ? `${"  ".repeat(f.depth)}${f.label}` : f.label}
            active={false}
            onSelect={() => void onMove(f.id)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoveFolderMenu({
  doc,
  folders,
  onMove,
  trigger,
}: {
  doc: RoomDocumentRow;
  folders: RoomDocumentFolderRow[];
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  trigger: React.ReactElement;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-56">
        <div className="text-muted-foreground flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium">
          <FolderInput className="size-3.5 opacity-70" aria-hidden />
          Pindahkan ke folder
        </div>
        <DropdownMenuSeparator />
        <FolderChoiceItem
          icon={<Folder className="size-3.5 opacity-70" />}
          label="Semua file (root)"
          active={doc.folderId == null}
          onSelect={() => void onMove(doc, null)}
        />
        {folders.length > 0 ? <DropdownMenuSeparator /> : null}
        {flattenFoldersForPicker(folders).map((f) => (
          <FolderChoiceItem
            key={f.id}
            icon={<Folder className="size-3.5 opacity-70" />}
            label={f.depth > 0 ? `${"  ".repeat(f.depth)}${f.label}` : f.label}
            active={doc.folderId === f.id}
            onSelect={() => void onMove(doc, f.id)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Tile pratinjau video di daftar/grid.
 *
 * Kita TIDAK PERNAH memasang `<video>` di sini — dulu pendekatan itu
 * menjatuhkan UI: ratusan elemen video memicu request metadata, mem-spawn
 * decoder per tile, dan mengisi 6-koneksi-per-origin sampai antri.
 *
 * Sekarang server membuat satu frame `.thumb.webp` saat upload (lihat
 * `room-document-upload.ts`). Bila `thumbPath` ada, kita render `<Image>`
 * statis + overlay tombol play kecil sebagai indikator video. Bila tidak
 * ada (file lama belum di-backfill, atau ekstraksi gagal), fallback ke
 * gradient + ikon Film seperti perilaku lama.
 */
function VideoTilePlaceholder({
  className,
  thumbPath,
  alt,
  iconSize = "lg",
  sizes,
  priority = false,
}: {
  className?: string;
  thumbPath?: string | null;
  alt?: string;
  iconSize?: "sm" | "lg";
  sizes?: string;
  priority?: boolean;
}) {
  if (thumbPath) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-black", className)}>
        <Image
          src={thumbPath}
          alt={alt ?? ""}
          fill
          unoptimized
          priority={priority}
          // Cegah drag gambar bawaan browser: tanpa ini, menyeret thumbnail
          // memicu drag "file" native (types berisi "Files") sehingga panel
          // dikira unggah — seret harus selalu berasal dari <li> (pindah item).
          draggable={false}
          className="object-cover"
          sizes={sizes ?? "(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"}
        />
        {iconSize === "lg" ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <span className="bg-black/55 text-white flex size-10 items-center justify-center rounded-full backdrop-blur-sm ring-1 ring-white/20">
              <Play className="size-5 fill-white" />
            </span>
          </div>
        ) : (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <Play className="text-white/90 size-3 fill-white drop-shadow" />
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 via-zinc-950 to-black",
        className,
      )}
    >
      <Film
        className={cn(
          "text-violet-500/50 dark:text-violet-400/60",
          iconSize === "lg" ? "size-10" : "size-4",
        )}
        aria-hidden
      />
    </div>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="flex items-baseline gap-1.5 text-sm font-medium">
      {label}
      <span className="text-muted-foreground font-normal tabular-nums">{count}</span>
    </h2>
  );
}

function DocTagChips({ tags, max = 5 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  const more = tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span
          key={t}
          className="bg-muted text-muted-foreground max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
          title={t}
        >
          {t}
        </span>
      ))}
      {more > 0 ? (
        <span className="text-muted-foreground text-[10px] font-medium">
          +{more}
        </span>
      ) : null}
    </div>
  );
}

const DocCard = memo(function DocCard({
  doc,
  folders,
  showFolderHint,
  canManage,
  selected,
  selectionActive,
  onToggleSelect,
  onPreview,
  onDelete,
  onMove,
  onRename,
  onDownload,
  onFavorite,
  onShare,
  onVersions,
  onItemDragStart,
  onItemDragEnd,
  compact = false,
  priority = false,
}: {
  doc: RoomDocumentRow;
  folders: RoomDocumentFolderRow[];
  showFolderHint: boolean;
  canManage: boolean;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: () => void;
  onPreview: (d: RoomDocumentRow) => void;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onRename: (d: RoomDocumentRow) => void;
  onDownload: (d: RoomDocumentRow) => void | Promise<void>;
  onFavorite: (d: RoomDocumentRow) => void | Promise<void>;
  onShare: (d: RoomDocumentRow) => void;
  onVersions: (d: RoomDocumentRow) => void;
  onItemDragStart: React.DragEventHandler<HTMLLIElement>;
  onItemDragEnd: React.DragEventHandler<HTMLLIElement>;
  /** Kartu padat (kolom banyak): sembunyikan metadata & footer, aksi via hover. */
  compact?: boolean;
  /** Hint LCP — tile pertama yang berada di atas fold harus eager. */
  priority?: boolean;
}) {
  const isImage = doc.mimeType.startsWith("image/");
  const isVideo = doc.mimeType.startsWith("video/");
  const currentFolderName = folderLabelForDoc(doc.folderId, folders);
  const name = doc.title?.trim() || doc.fileName;
  const uploaderName = doc.uploadedBy.name ?? doc.uploadedBy.email;

  return (
    <li
      draggable
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
      className={cn(
        "doc-grid-card border-border bg-card relative flex min-w-0 flex-col overflow-hidden rounded-xl border transition-colors",
        "hover:border-foreground/20 focus-within:ring-ring/50 focus-within:ring-2",
        "sm:[&:hover_.doc-grid-card-select]:opacity-100 sm:[&:focus-within_.doc-grid-card-select]:opacity-100",
        "sm:[&:hover_.doc-grid-card-actions]:opacity-100 sm:[&:focus-within_.doc-grid-card-actions]:opacity-100",
        selected && "border-primary ring-primary/30 ring-2",
      )}
    >
      <div
        className={cn(
          "doc-grid-card-select absolute top-2 left-2 z-20 transition-opacity",
          selectionActive || selected
            ? "opacity-100"
            : "opacity-100 sm:opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect()}
          aria-label={`Pilih ${doc.fileName}`}
          className="bg-background/90 size-5 border-2 shadow-sm"
        />
      </div>
      {/* Duplikat klik judul untuk mouse — judul tetap satu-satunya tab stop. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => onPreview(doc)}
        className="border-border bg-muted/30 relative block aspect-[4/3] w-full overflow-hidden border-b text-left"
      >
        {isImage && doc.thumbPath ? (
          // Hanya thumbnail webp (~480px) yang boleh tampil di kartu — 1 file
          // mentah bisa puluhan MB (mis. PNG transparan), thumbnail biasanya
          // <50 KB. Tanpa thumbnail, fallback ke placeholder tipe file di bawah;
          // memuat file asli di grid pernah membuat folder tertentu macet
          // total. File asli tetap dimuat penuh di dialog pratinjau.
          <Image
            src={doc.thumbPath}
            alt=""
            fill
            unoptimized
            priority={priority}
            // Lihat catatan di VideoTilePlaceholder: thumbnail tak boleh jadi
            // sumber drag native, agar seret selalu = pindah item, bukan unggah.
            draggable={false}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"
          />
        ) : isVideo ? (
          <VideoTilePlaceholder
            thumbPath={doc.thumbPath}
            iconSize="lg"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"
            priority={priority}
          />
        ) : (
          <FileTypeSpine
            fileName={doc.fileName}
            mimeType={doc.mimeType}
            compact={compact}
          />
        )}
        {doc.isFavorite || doc.currentVersion > 1 ? (
          <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1">
            {doc.currentVersion > 1 ? (
              <span className="bg-background/90 text-foreground rounded-full px-1.5 text-[10px] leading-5 font-medium tabular-nums shadow-sm">
                v{doc.currentVersion}
              </span>
            ) : null}
            {doc.isFavorite ? (
              <span className="bg-background/90 flex size-5 items-center justify-center rounded-full shadow-sm">
                <Star className="size-3 fill-amber-500 text-amber-500" />
              </span>
            ) : null}
          </span>
        ) : null}
      </button>

      {/* Aksi — muncul saat hover/fokus; selalu tampil di layar sentuh. */}
      <div
        className="doc-grid-card-actions absolute top-2 right-2 z-20 opacity-100 transition-opacity sm:opacity-0"
        onClick={(event) => event.stopPropagation()}
      >
        <DocActionsMenu
          doc={doc}
          folders={folders}
          canManage={canManage}
          triggerVariant="secondary"
          triggerClassName="size-8 shadow-sm"
          onPreview={onPreview}
          onVersions={onVersions}
          onShare={onShare}
          onFavorite={onFavorite}
          onDownload={onDownload}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col",
          compact ? "gap-0.5 p-2" : "gap-1.5 p-3",
        )}
      >
        {!compact && showFolderHint ? (
          canManage ? (
            <MoveFolderMenu
              doc={doc}
              folders={folders}
              onMove={onMove}
              trigger={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/40 -mx-1 -my-0.5 inline-flex w-fit max-w-full items-center gap-1 truncate rounded px-1 py-0.5 text-xs transition-colors"
                  title="Pindahkan ke folder lain"
                >
                  <Folder className="size-3 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{currentFolderName}</span>
                </button>
              }
            />
          ) : (
            <p className="text-muted-foreground inline-flex items-center gap-1 truncate text-xs">
              <Folder className="size-3 shrink-0 opacity-70" aria-hidden />
              {currentFolderName}
            </p>
          )
        ) : null}
        <button
          type="button"
          onClick={() => onPreview(doc)}
          className={cn(
            "text-foreground text-left font-medium outline-none hover:underline focus-visible:underline",
            compact ? "line-clamp-2 text-xs leading-snug" : "line-clamp-2 text-sm",
          )}
          title={name}
        >
          {name}
        </button>
        {compact ? (
          <p className="text-muted-foreground text-[11px] tabular-nums">
            {formatFileSize(doc.size)}
          </p>
        ) : (
          <>
            <div className="text-muted-foreground mt-auto flex items-center gap-2 text-xs tabular-nums">
              <span>{formatFileSize(doc.size)}</span>
              <span className="truncate">{formatDate(doc.createdAt)}</span>
              <span
                className="bg-muted text-foreground/70 ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                title={`Diunggah oleh ${uploaderName}`}
                aria-label={`Diunggah oleh ${uploaderName}`}
              >
                {uploaderName.charAt(0).toUpperCase()}
              </span>
            </div>
            <DocTagChips tags={doc.tags ?? []} max={3} />
          </>
        )}
      </div>
    </li>
  );
});

const DocListRow = memo(function DocListRow({
  doc,
  folders,
  showFolderHint,
  canManage,
  selected,
  onToggleSelect,
  onPreview,
  onDelete,
  onMove,
  onRename,
  onDownload,
  onFavorite,
  onShare,
  onVersions,
  onItemDragStart,
  onItemDragEnd,
}: {
  doc: RoomDocumentRow;
  folders: RoomDocumentFolderRow[];
  showFolderHint: boolean;
  canManage: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: (d: RoomDocumentRow) => void;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onRename: (d: RoomDocumentRow) => void;
  onDownload: (d: RoomDocumentRow) => void | Promise<void>;
  onFavorite: (d: RoomDocumentRow) => void | Promise<void>;
  onShare: (d: RoomDocumentRow) => void;
  onVersions: (d: RoomDocumentRow) => void;
  onItemDragStart: React.DragEventHandler<HTMLLIElement>;
  onItemDragEnd: React.DragEventHandler<HTMLLIElement>;
}) {
  const meta = fileTypeMeta(doc.mimeType);
  const Icon = meta.icon;
  const isImage = doc.mimeType.startsWith("image/");
  const isVideo = doc.mimeType.startsWith("video/");
  const name = doc.title?.trim() || doc.fileName;
  const uploaderName = doc.uploadedBy.name ?? doc.uploadedBy.email;

  return (
    <li
      draggable
      onDragStart={onItemDragStart}
      onDragEnd={onItemDragEnd}
      className={cn(
        "group/row hover:bg-muted/40 flex flex-row flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 transition-colors md:flex-nowrap",
        documentListGridClass(showFolderHint),
        // `content-visibility` bikin snapshot seret bawaan browser rusak; aman
        // karena startItemDrag selalu memasang gambar seret sendiri.
        "[content-visibility:auto] [contain-intrinsic-block-size:60px]",
        selected && "bg-primary/5",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggleSelect()}
        aria-label={`Pilih ${doc.fileName}`}
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg",
            meta.bg,
          )}
        >
          {isImage && doc.thumbPath ? (
            // Sama seperti kartu grid: tanpa thumbnail jangan muat file asli
            // (bisa puluhan MB per baris) — jatuh ke ikon tipe file.
            <Image
              src={doc.thumbPath}
              alt=""
              fill
              unoptimized
              // Lihat catatan di VideoTilePlaceholder: cegah drag gambar native.
              draggable={false}
              className="object-cover"
              sizes="36px"
            />
          ) : isVideo ? (
            <VideoTilePlaceholder
              thumbPath={doc.thumbPath}
              iconSize="sm"
              sizes="36px"
            />
          ) : (
            <Icon className={cn("size-4", meta.tone)} />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPreview(doc)}
              className="text-foreground focus-visible:ring-ring line-clamp-1 rounded text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2"
              title={name}
            >
              {name}
            </button>
            {doc.isFavorite ? (
              <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" aria-label="Favorit" />
            ) : null}
            {doc.currentVersion > 1 ? (
              <span className="text-muted-foreground shrink-0 text-[10px] font-medium tabular-nums">
                v{doc.currentVersion}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {doc.title?.trim() ? `${doc.fileName}, oleh ${uploaderName}` : `Oleh ${uploaderName}`}
          </p>
          <DocTagChips tags={doc.tags ?? []} />
        </div>
      </div>
      {showFolderHint ? (
        <span className="text-muted-foreground hidden truncate text-xs md:block">
          {folderLabelForDoc(doc.folderId, folders)}
        </span>
      ) : null}
      <span className="text-muted-foreground text-xs tabular-nums md:text-right">
        {formatFileSize(doc.size)}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {formatDate(doc.createdAt)}
      </span>
      <div className="ml-auto flex items-center justify-end gap-0.5 md:ml-0">
        <div className="flex items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={doc.isFavorite ? `Hapus ${name} dari favorit` : `Tambahkan ${name} ke favorit`}
            title={doc.isFavorite ? "Hapus dari favorit" : "Tambahkan ke favorit"}
            onClick={() => void onFavorite(doc)}
          >
            <Star className={cn("size-4", doc.isFavorite && "fill-current text-amber-500")} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Unduh ${name}`}
            title="Unduh"
            onClick={() => void onDownload(doc)}
          >
            <Download className="size-4" />
          </Button>
        </div>
        <DocActionsMenu
          doc={doc}
          folders={folders}
          canManage={canManage}
          onPreview={onPreview}
          onVersions={onVersions}
          onShare={onShare}
          onFavorite={onFavorite}
          onDownload={onDownload}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
});

function DocList({
  childFolders,
  docs,
  folders,
  showFolderHint,
  isRoomManager,
  onOpenFolder,
  onRenameFolder,
  onMoveFolder,
  onFavoriteFolder,
  onShareFolder,
  onDeleteFolder,
  onDownloadFolder,
  selectedDocIds,
  selectedFolderIds,
  selectionActive,
  allDocsSelected,
  onToggleSelect,
  onToggleFolderSelect,
  onDocumentDragStart,
  onFolderDragStart,
  onFolderDrop,
  onItemDragEnd,
  onSelectAll,
  onClearSelection,
  onPreview,
  onDelete,
  onMove,
  onRenameDocument,
  onDownloadDocument,
  onFavoriteDocument,
  onShareDocument,
  onVersionsDocument,
}: {
  childFolders: RoomDocumentFolderRow[];
  docs: RoomDocumentRow[];
  folders: RoomDocumentFolderRow[];
  showFolderHint: boolean;
  isRoomManager: boolean;
  onOpenFolder: (folderId: string) => void;
  onRenameFolder: (folder: RoomDocumentFolderRow) => void;
  onMoveFolder: (folder: RoomDocumentFolderRow) => void;
  onFavoriteFolder: (folder: RoomDocumentFolderRow) => void;
  onShareFolder: (folder: RoomDocumentFolderRow) => void;
  onDeleteFolder: (folder: RoomDocumentFolderRow) => void;
  onDownloadFolder: (folder: RoomDocumentFolderRow) => void;
  selectedDocIds: Set<string>;
  selectedFolderIds: Set<string>;
  selectionActive: boolean;
  allDocsSelected: boolean;
  onToggleSelect: (docId: string) => void;
  onToggleFolderSelect: (folderId: string) => void;
  onDocumentDragStart: (event: React.DragEvent<HTMLLIElement>, document: RoomDocumentRow) => void;
  onFolderDragStart: (event: React.DragEvent<HTMLDivElement>, folder: RoomDocumentFolderRow) => void;
  onFolderDrop: (event: React.DragEvent<HTMLDivElement>, folder: RoomDocumentFolderRow) => void;
  onItemDragEnd: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPreview: (d: RoomDocumentRow) => void;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onRenameDocument: (d: RoomDocumentRow) => void;
  onDownloadDocument: (d: RoomDocumentRow) => void | Promise<void>;
  onFavoriteDocument: (d: RoomDocumentRow) => void | Promise<void>;
  onShareDocument: (d: RoomDocumentRow) => void;
  onVersionsDocument: (d: RoomDocumentRow) => void;
}) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={cn(
          "border-border text-muted-foreground bg-muted/40 hidden items-center border-b px-3 py-2 text-xs font-medium",
          documentListGridClass(showFolderHint),
        )}
      >
        <Checkbox
          checked={allDocsSelected}
          onCheckedChange={(v) => {
            if (v === true) onSelectAll();
            else onClearSelection();
          }}
          aria-label="Pilih semua file"
          className="shrink-0"
        />
        <span>Nama</span>
        {showFolderHint ? <span>Lokasi</span> : null}
        <span className="text-right">Ukuran</span>
        <span>Diunggah</span>
        <span className="sr-only">Aksi</span>
      </div>
      <ul className="divide-border divide-y">
        {childFolders.map((f) => (
          <DriveFolderGridCard
            key={f.id}
            folder={f}
            view="list"
            listShowLocation={showFolderHint}
            isRoomManager={isRoomManager}
            onOpen={() => onOpenFolder(f.id)}
            onRename={() => onRenameFolder(f)}
            onMove={() => onMoveFolder(f)}
            onFavorite={() => onFavoriteFolder(f)}
            onShare={() => onShareFolder(f)}
            selected={selectedFolderIds.has(f.id)}
            selectionActive={selectionActive}
            onToggleSelect={isRoomManager || f.canEdit ? () => onToggleFolderSelect(f.id) : undefined}
            onItemDragStart={isRoomManager || f.canEdit ? (event) => onFolderDragStart(event, f) : undefined}
            onItemDragEnd={onItemDragEnd}
            onItemsDrop={(event) => onFolderDrop(event, f)}
            onDelete={() => onDeleteFolder(f)}
            onDownload={() => onDownloadFolder(f)}
          />
        ))}
        {docs.map((d) => (
          <DocListRow
            key={d.id}
            doc={d}
            folders={folders}
            showFolderHint={showFolderHint}
            canManage={d.canEdit || isRoomManager}
            selected={selectedDocIds.has(d.id)}
            onToggleSelect={() => onToggleSelect(d.id)}
            onPreview={onPreview}
            onDelete={onDelete}
            onMove={onMove}
            onRename={onRenameDocument}
            onDownload={onDownloadDocument}
            onFavorite={onFavoriteDocument}
            onShare={onShareDocument}
            onVersions={onVersionsDocument}
            onItemDragStart={(event) => onDocumentDragStart(event, d)}
            onItemDragEnd={onItemDragEnd}
          />
        ))}
      </ul>
    </div>
  );
}
