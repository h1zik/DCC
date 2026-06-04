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
  moveRoomDocumentToFolder,
  moveRoomDocumentsToFolder,
  renameRoomDocumentFolder,
  updateRoomDocumentTags,
} from "@/actions/room-documents";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  asyncPool,
  uploadRoomDocumentViaApi,
} from "@/lib/room-document-upload-xhr";
import { normalizeRoomDocumentTags } from "@/lib/room-document-tags";
import {
  downloadRoomDocumentsZip,
  downloadRoomFolderZip,
  downloadSingleRoomDocument,
} from "@/lib/room-document-download-client";
import {
  flattenFoldersForPicker,
  formatFolderPath,
  getChildFolders,
} from "@/lib/room-document-folders";
import {
  DriveBreadcrumb,
  DriveFolderGridCard,
  DriveFolderTree,
  type DriveFolderRow,
} from "./room-documents-drive-nav";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Download,
  Eye,
  ExternalLink,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Grid3x3,
  HardDrive,
  Info,
  LayoutList,
  Loader2,
  MoreVertical,
  Music,
  Pencil,
  Play,
  Search,
  Tag,
  Trash2,
  User,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type RoomDocumentFolderRow = DriveFolderRow;

export type RoomDocumentRow = {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  publicPath: string;
  /**
   * Path thumbnail (webp ~480px) bila tersedia. Null untuk non-image atau
   * gambar yang gagal didekode saat upload — UI fallback ke `publicPath`
   * (atau ikon tipe file untuk non-image).
   */
  thumbPath: string | null;
  createdAt: Date;
  folderId: string | null;
  tags: string[];
  uploadedBy: { id: string; name: string | null; email: string };
};

type ViewMode = "grid" | "list";
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

/** Batasi DOM sekaligus — daftar besar jadi ringan; preview tetap penuh. */
const DOCS_PAGE_SIZE = 40;

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function folderLabelForDoc(
  folderId: string | null,
  folders: RoomDocumentFolderRow[],
): string {
  if (!folderId) return "Semua file";
  return formatFolderPath(folderId, folders);
}

function fileTypeMeta(mimeType: string): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
} {
  if (mimeType.startsWith("image/"))
    return { icon: FileImage, label: "Gambar", tone: "text-emerald-600 dark:text-emerald-400" };
  if (mimeType.startsWith("video/"))
    return { icon: Film, label: "Video", tone: "text-violet-600 dark:text-violet-400" };
  if (mimeType.startsWith("audio/"))
    return { icon: Music, label: "Audio", tone: "text-pink-600 dark:text-pink-400" };
  if (mimeType === "application/pdf")
    return { icon: FileText, label: "PDF", tone: "text-rose-600 dark:text-rose-400" };
  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar")
  )
    return { icon: FileArchive, label: "Arsip", tone: "text-amber-600 dark:text-amber-400" };
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return { icon: FileSpreadsheet, label: "Spreadsheet", tone: "text-emerald-700 dark:text-emerald-400" };
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.startsWith("text/")
  )
    return { icon: FileText, label: "Dokumen", tone: "text-sky-600 dark:text-sky-400" };
  return { icon: FileIcon, label: "File", tone: "text-muted-foreground" };
}

export function RoomDocumentsWorkspace({
  roomId,
  folders,
  documents,
  currentUserId,
  isRoomManager,
}: {
  roomId: string;
  folders: RoomDocumentFolderRow[];
  documents: RoomDocumentRow[];
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
  currentFolderIdRef.current = currentFolderId;
  const folderBackStackRef = useRef<(string | null)[]>([]);
  folderBackStackRef.current = folderBackStack;
  const [title, setTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [pending, setPending] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<RoomDocumentRow | null>(null);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [uploadPanelExpanded, setUploadPanelExpanded] = useState(true);
  const [uploadTagsInput, setUploadTagsInput] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("__all__");
  const [docDisplayLimit, setDocDisplayLimit] = useState(DOCS_PAGE_SIZE);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const selectionActive = selectedDocIds.size > 0;

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

  const childFolders = useMemo(
    () =>
      isSearchActive
        ? []
        : (getChildFolders(folders, currentFolderId) as RoomDocumentFolderRow[]),
    [folders, currentFolderId, isSearchActive],
  );

  const rootFileCount = useMemo(
    () => documents.filter((d) => d.folderId == null).length,
    [documents],
  );

  const allTagsInRoom = useMemo(() => {
    const s = new Set<string>();
    for (const d of documents) {
      for (const t of d.tags ?? []) s.add(t);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "id"));
  }, [documents]);

  useEffect(() => {
    setDocDisplayLimit(DOCS_PAGE_SIZE);
    setSelectedDocIds(new Set());
  }, [currentFolderId, tagFilter, sortKey, deferredSearch]);

  const totalSize = useMemo(
    () => documents.reduce((acc, d) => acc + (d.size ?? 0), 0),
    [documents],
  );

  const visibleDocuments = useMemo(() => {
    let rows = documents;
    if (!isSearchActive) {
      rows = rows.filter((d) => d.folderId === currentFolderId);
    }
    const qSearch = deferredSearch.trim().toLowerCase();
    if (qSearch) {
      rows = rows.filter((d) => {
        const t = (d.title ?? "").toLowerCase();
        const n = d.fileName.toLowerCase();
        const tagHay = (d.tags ?? []).join(" ").toLowerCase();
        return t.includes(qSearch) || n.includes(qSearch) || tagHay.includes(qSearch);
      });
    }
    if (tagFilter && tagFilter !== "__all__") {
      rows = rows.filter((d) => (d.tags ?? []).includes(tagFilter));
    }
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
  }, [documents, currentFolderId, deferredSearch, sortKey, tagFilter, isSearchActive]);

  const pagedVisibleDocuments = useMemo(
    () => visibleDocuments.slice(0, docDisplayLimit),
    [visibleDocuments, docDisplayLimit],
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
    () => documents.filter((d) => selectedDocIds.has(d.id)),
    [documents, selectedDocIds],
  );

  const canManageAllSelected =
    selectedDocs.length > 0 &&
    selectedDocs.every(
      (d) => d.uploadedBy.id === currentUserId || isRoomManager,
    );

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
      router.refresh();
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
      toast.success("Folder dibuat.");
      navigateToFolder(id);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal membuat folder."));
    } finally {
      setPending(false);
    }
  }

  function openRename(folder: RoomDocumentFolderRow) {
    setRenameFolderId(folder.id);
    setRenameValue(folder.name);
    setRenameOpen(true);
  }

  async function onSaveRename() {
    if (!renameFolderId) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Nama folder tidak boleh kosong.");
      return;
    }
    setRenameBusy(true);
    try {
      await renameRoomDocumentFolder({ folderId: renameFolderId, name });
      toast.success("Nama folder diperbarui.");
      setRenameOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menyimpan."));
    } finally {
      setRenameBusy(false);
    }
  }

  async function onDeleteFolder(folder: RoomDocumentFolderRow) {
    const childCount = folders.filter((f) => f.parentId === folder.id).length;
    const n = folder._count.documents;
    const parts: string[] = [`Hapus folder "${folder.name}"?`];
    if (childCount > 0) {
      parts.push(`${childCount} subfolder juga akan dihapus.`);
    }
    if (n > 0) {
      parts.push(`${n} file di folder ini akan dipindah ke folder induk.`);
    }
    if (!confirm(parts.join(" "))) return;
    setPending(true);
    try {
      await deleteRoomDocumentFolder(folder.id);
      toast.success("Folder dihapus.");
      if (currentFolderId === folder.id) {
        navigateToFolder(folder.parentId, { skipHistory: true });
      }
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menghapus folder."));
    } finally {
      setPending(false);
    }
  }

  const onDeleteDoc = useCallback(
    async (d: RoomDocumentRow) => {
      if (!confirm("Hapus dokumen ini?")) return;
      try {
        await deleteRoomDocument(d.id);
        toast.success("Dokumen dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal."));
      }
    },
    [router],
  );

  const onMoveDoc = useCallback(
    async (d: RoomDocumentRow, folderId: string | null) => {
      if (folderId === d.folderId) return;
      try {
        await moveRoomDocumentToFolder({ documentId: d.id, folderId });
        const targetName = folderId
          ? formatFolderPath(folderId, folders)
          : "Semua file (root)";
        toast.success(`Dipindahkan ke ${targetName}.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memindahkan."));
      }
    },
    [router, folders],
  );

  const onPreviewDoc = useCallback((d: RoomDocumentRow) => {
    setPreviewDoc(d);
  }, []);

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
    const ids = Array.from(selectedDocIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      if (ids.length === 1) {
        const doc = documents.find((d) => d.id === ids[0]);
        if (doc) await downloadSingleRoomDocument(roomId, doc.id, doc.fileName);
        else throw new Error("File tidak ditemukan.");
      } else {
        await downloadRoomDocumentsZip(roomId, ids);
      }
      toast.success(
        ids.length === 1 ? "File diunduh." : `${ids.length} file diunduh (ZIP).`,
      );
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mengunduh."));
    } finally {
      setBulkBusy(false);
    }
  }, [documents, roomId, selectedDocIds]);

  const onBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedDocIds);
    if (!ids.length) return;
    if (!canManageAllSelected) {
      toast.error("Anda tidak dapat menghapus satu atau lebih file terpilih.");
      return;
    }
    if (!confirm(`Hapus ${ids.length} file terpilih?`)) return;
    setBulkBusy(true);
    try {
      await deleteRoomDocuments(ids);
      toast.success(`${ids.length} file dihapus.`);
      clearDocSelection();
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal menghapus."));
    } finally {
      setBulkBusy(false);
    }
  }, [
    selectedDocIds,
    canManageAllSelected,
    clearDocSelection,
    router,
  ]);

  const onBulkMove = useCallback(
    async (folderId: string | null) => {
      const ids = Array.from(selectedDocIds);
      if (!ids.length) return;
      if (!canManageAllSelected) {
        toast.error("Anda tidak dapat memindahkan satu atau lebih file terpilih.");
        return;
      }
      setBulkBusy(true);
      try {
        await moveRoomDocumentsToFolder({ documentIds: ids, folderId });
        const targetName = folderId
          ? formatFolderPath(folderId, folders)
          : "Semua file (root)";
        toast.success(`${ids.length} file dipindahkan ke ${targetName}.`);
        clearDocSelection();
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memindahkan."));
      } finally {
        setBulkBusy(false);
      }
    },
    [
      selectedDocIds,
      canManageAllSelected,
      folders,
      clearDocSelection,
      router,
    ],
  );

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (pending || uploadBusy) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void handleUploadFiles(files);
  }

  const uploadTargetLabel = formatFolderPath(currentFolderId, folders);

  const inputId = `room-doc-file-${roomId}`;
  const folderEmpty =
    !isSearchActive &&
    childFolders.length === 0 &&
    visibleDocuments.length === 0;
  const totalDocs = documents.length;

  /** Urutan file untuk prev/next di dialog pratinjau (folder / filter saat ini). */
  const previewPlaylist = useMemo(() => visibleDocuments, [visibleDocuments]);

  return (
    <div className="flex flex-col gap-4">
      {/* Page hero */}
      <header className="border-border bg-card relative isolate overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="from-primary/8 absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
          aria-hidden
        />
        <div
          className="bg-primary/10 absolute -top-12 -right-12 size-40 rounded-full blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
              <HardDrive className="size-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">
                Documents &amp; files
              </h2>
              <p className="text-muted-foreground text-sm">
                Arsip file bersama untuk ruangan ini — kontrak, logo, referensi,
                aset, dll.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="border-border bg-background/70 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <FileIcon className="size-3.5 opacity-70" aria-hidden />
              {totalDocs} file
            </div>
            <div className="border-border bg-background/70 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <Folder className="size-3.5 opacity-70" aria-hidden />
              {folders.length} folder
            </div>
            <div className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
              {formatFileSize(totalSize)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Bantuan dokumen"
              onClick={() => setShowHelp((v) => !v)}
            >
              <Info className="size-4" />
            </Button>
          </div>
        </div>
        {showHelp ? (
          <div className="border-border bg-muted/30 relative border-t px-5 py-3 text-xs leading-relaxed sm:px-6">
            Navigasi seperti Google Drive: buka folder di panel kiri atau
            klik kartu folder. Buat subfolder di dalam folder yang sedang
            dibuka. File diunggah ke lokasi yang aktif (breadcrumb). Saat
            mencari, hasil mencakup seluruh ruangan beserta jalur foldernya.
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Sidebar — pohon folder (Drive) */}
        <aside className="border-border bg-card sticky top-[5.5rem] z-10 w-full shrink-0 space-y-3 rounded-xl border p-3 lg:max-w-[260px]">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
              Drive ruangan
            </p>
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {folders.length} folder
            </span>
          </div>

          <DriveFolderTree
            folders={folders}
            currentFolderId={currentFolderId}
            rootFileCount={rootFileCount}
            isRoomManager={isRoomManager}
            onNavigate={navigateToFolder}
            onRename={openRename}
            onDelete={(f) => void onDeleteFolder(f)}
            onDownload={(f) => void onDownloadFolder(f)}
          />

          <div className="border-border space-y-1.5 border-t pt-3">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
              Folder baru di sini
            </Label>
            <div className="flex gap-1">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Logo, Legal, …"
                disabled={pending}
                maxLength={80}
                className="h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreateFolder();
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                disabled={pending || !newFolderName.trim()}
                aria-label="Buat folder"
                onClick={() => void onCreateFolder()}
              >
                <FolderPlus className="size-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isDragging) setIsDragging(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setIsDragging(false);
            }}
            onDrop={handleDrop}
            className={cn(
              "relative overflow-hidden rounded-xl border-2 border-dashed transition-colors",
              isDragging
                ? "border-primary bg-primary/8"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
                  isDragging
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                {pending || uploadBusy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <CloudUpload className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {isDragging ? "Lepas untuk mengunggah" : "Tarik & lepas file di sini"}
                </p>
                <p className="text-muted-foreground text-xs">
                  Atau klik tombol{" "}
                  <span className="text-foreground font-medium">Pilih file</span>{" "}
                  · lokasi:{" "}
                  <span className="text-foreground font-medium">
                    {uploadTargetLabel}
                  </span>
                  {title.trim() ? (
                    <>
                      {" "}
                      · judul: <span className="text-foreground font-medium">{title}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={inputId}
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  disabled={pending || uploadBusy}
                  onChange={(e) => void onFileInput(e)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || uploadBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CloudUpload className="size-4" />
                  Pilih file
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                >
                  {showAdvanced ? (
                    <>
                      <X className="size-4" />
                      Tutup opsi
                    </>
                  ) : (
                    <>
                      <Pencil className="size-4" />
                      Opsi unggah
                    </>
                  )}
                </Button>
              </div>
            </div>
            {showAdvanced ? (
              <div className="border-border bg-background/40 grid gap-3 border-t px-5 py-4 sm:grid-cols-2 sm:px-6">
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="doc-upload-tags" className="text-xs">
                    Tag batch (opsional, dipakai semua file ini)
                  </Label>
                  <Input
                    id="doc-upload-tags"
                    value={uploadTagsInput}
                    onChange={(e) => setUploadTagsInput(e.target.value)}
                    placeholder="footage, raw, approved — pisahkan koma atau spasi"
                    disabled={pending || uploadBusy}
                    className="h-9"
                  />
                  <p className="text-muted-foreground text-[11px]">
                    Maks. 20 tag; huruf kecil otomatis. Berguna untuk batch footage.
                  </p>
                </div>
                <p className="text-muted-foreground text-[11px] sm:col-span-2">
                  File disimpan ke folder yang sedang dibuka (
                  <span className="text-foreground font-medium">
                    {uploadTargetLabel}
                  </span>
                  ). Pindahkan folder lewat breadcrumb atau panel kiri.
                </p>
              </div>
            ) : null}
          </div>

          {/* Toolbar */}
          <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-xl border p-2">
            <div className="bg-muted/30 border-border flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1.5">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={!canGoBackFolder}
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
                className="shrink-0"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="bg-border hidden h-5 w-px sm:block" aria-hidden />
              <DriveBreadcrumb
                currentFolderId={currentFolderId}
                folders={folders}
                onNavigate={navigateToFolder}
              />
            </div>
            {isSearchActive ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {visibleDocuments.length} hasil · semua folder
              </span>
            ) : (
              <span className="text-muted-foreground text-xs tabular-nums">
                {childFolders.length} folder · {visibleDocuments.length} file
              </span>
            )}
            <div className="border-border focus-within:border-ring focus-within:ring-ring/40 flex items-center gap-2 rounded-lg border px-2.5 transition-colors focus-within:ring-2">
              <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / judul / tag…"
                className="placeholder:text-muted-foreground h-8 w-44 bg-transparent text-sm outline-none"
              />
              {search ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Bersihkan pencarian"
                  onClick={() => setSearch("")}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <Select
              value={tagFilter}
              onValueChange={(v) => setTagFilter(v ?? "__all__")}
            >
              <SelectTrigger
                size="sm"
                className="border-border h-8 w-[min(168px,42vw)] gap-1.5 text-xs"
              >
                <Tag className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {tagFilter === "__all__" ? "Semua tag" : tagFilter}
                </span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="__all__">Semua tag</SelectItem>
                {allTagsInRoom.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" size="sm" variant="outline">
                    <ArrowUpDown className="size-3.5" />
                    {SORT_LABEL[sortKey]}
                  </Button>
                }
              />
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuLabel>Urutkan berdasarkan</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortKey}
                  onValueChange={(v) => setSortKey(v as SortKey)}
                >
                  <DropdownMenuRadioItem value="newest">
                    <Calendar className="size-3.5" /> {SORT_LABEL.newest}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="oldest">
                    <Calendar className="size-3.5" /> {SORT_LABEL.oldest}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name">
                    <ArrowDownAZ className="size-3.5" /> {SORT_LABEL.name}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name_desc">
                    <ArrowUpAZ className="size-3.5" /> {SORT_LABEL.name_desc}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="size">
                    <HardDrive className="size-3.5" /> {SORT_LABEL.size}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="size_asc">
                    <HardDrive className="size-3.5 opacity-60" />{" "}
                    {SORT_LABEL.size_asc}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="type">
                    <Film className="size-3.5" /> {SORT_LABEL.type}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="uploader">
                    <User className="size-3.5" /> {SORT_LABEL.uploader}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="border-border bg-background flex shrink-0 items-center rounded-lg border p-0.5">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  view === "grid"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                aria-label="Tampilan grid"
              >
                <Grid3x3 className="size-3.5" />
                Grid
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  view === "list"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                aria-label="Tampilan daftar"
              >
                <LayoutList className="size-3.5" />
                List
              </button>
            </div>
          </div>

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
                {selectedDocIds.size} dipilih
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
                disabled={bulkBusy}
                onClick={() => void onBulkDownload()}
              >
                <Download className="size-3.5" />
                Unduh
              </Button>
              {canManageAllSelected ? (
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
                    disabled={bulkBusy}
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
          ) : selectableDocIds.length > 0 ? (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={selectAllVisibleDocs}
              >
                Pilih file
              </Button>
            </div>
          ) : null}

          {/* Folder + file */}
          {folderEmpty ? (
            <div className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
              <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
                <FolderOpen className="size-7" />
              </div>
              <p className="text-sm font-medium">
                {isSearchActive
                  ? "Tidak ada file yang cocok dengan pencarian."
                  : "Folder ini masih kosong."}
              </p>
              <p className="text-muted-foreground max-w-xs text-xs">
                Buat subfolder di panel kiri, atau tarik file ke area unggah di
                atas.
              </p>
            </div>
          ) : view === "grid" ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {!isSearchActive
                ? childFolders.map((f) => (
                    <DriveFolderGridCard
                      key={f.id}
                      folder={f}
                      view="grid"
                      isRoomManager={isRoomManager}
                      onOpen={() => navigateToFolder(f.id)}
                      onRename={() => openRename(f)}
                      onDelete={() => void onDeleteFolder(f)}
                      onDownload={() => void onDownloadFolder(f)}
                    />
                  ))
                : null}
              {pagedVisibleDocuments.map((d, idx) => (
                <DocCard
                  key={d.id}
                  doc={d}
                  folders={folders}
                  showFolderHint={isSearchActive}
                  canManage={d.uploadedBy.id === currentUserId || isRoomManager}
                  selected={selectedDocIds.has(d.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={() => toggleDocSelection(d.id)}
                  onPreview={onPreviewDoc}
                  onDelete={onDeleteDoc}
                  onMove={onMoveDoc}
                  onDownload={(d) => void onDownloadDocument(d)}
                  // 4 ubin pertama (1 baris di breakpoint 2xl) berada di atas
                  // fold — beri `priority` agar Next.js set `loading="eager"`
                  // + `fetchPriority="high"` dan tidak memunculkan warning LCP.
                  priority={idx < 4}
                />
              ))}
            </ul>
          ) : (
            <DocList
              childFolders={isSearchActive ? [] : childFolders}
              docs={pagedVisibleDocuments}
              folders={folders}
              showFolderHint={isSearchActive}
              isRoomManager={isRoomManager}
              onOpenFolder={(id) => navigateToFolder(id)}
              onRenameFolder={openRename}
              onDeleteFolder={(f) => void onDeleteFolder(f)}
              onDownloadFolder={(f) => void onDownloadFolder(f)}
              currentUserId={currentUserId}
              selectedDocIds={selectedDocIds}
              allDocsSelected={allDocsSelected}
              onToggleSelect={toggleDocSelection}
              onSelectAll={selectAllVisibleDocs}
              onClearSelection={clearDocSelection}
              onPreview={onPreviewDoc}
              onDelete={onDeleteDoc}
              onMove={onMoveDoc}
              onDownloadDocument={(d) => void onDownloadDocument(d)}
            />
          )}
          {(visibleDocuments.length > 0 || childFolders.length > 0) &&
          docDisplayLimit < visibleDocuments.length ? (
            <div className="flex flex-col items-center gap-2 pt-3">
              <p className="text-muted-foreground text-center text-xs tabular-nums">
                Menampilkan {pagedVisibleDocuments.length} dari{" "}
                {visibleDocuments.length} file · ketuk untuk memuat lebih banyak
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDocDisplayLimit((n) =>
                    Math.min(
                      n + DOCS_PAGE_SIZE,
                      visibleDocuments.length,
                    ),
                  )
                }
              >
                Muat {Math.min(DOCS_PAGE_SIZE, visibleDocuments.length - docDisplayLimit)}{" "}
                lagi
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
      <DocPreviewDialog
        doc={previewDoc}
        previewPlaylist={previewPlaylist}
        onNavigate={onPreviewDoc}
        onDownload={(d) => void onDownloadDocument(d)}
        canManageTags={
          previewDoc
            ? previewDoc.uploadedBy.id === currentUserId || isRoomManager
            : false
        }
        onClose={() => setPreviewDoc(null)}
      />

      {/* Rename folder dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ganti nama folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={80}
            disabled={renameBusy}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renameBusy}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={renameBusy || !renameValue.trim()}
              onClick={() => void onSaveRename()}
            >
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

function FolderChoiceItem({
  icon,
  label,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onSelect} disabled={active} className="gap-2">
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {active ? (
        <Check className="text-primary size-3.5 shrink-0" aria-label="Folder saat ini" />
      ) : null}
    </DropdownMenuItem>
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

function DocTagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  const max = 5;
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
  onDownload,
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
  onDownload: (d: RoomDocumentRow) => void | Promise<void>;
  /** Hint LCP — tile pertama yang berada di atas fold harus eager. */
  priority?: boolean;
}) {
  const meta = fileTypeMeta(doc.mimeType);
  const Icon = meta.icon;
  const isImage = doc.mimeType.startsWith("image/");
  const isVideo = doc.mimeType.startsWith("video/");
  const currentFolderName = folderLabelForDoc(doc.folderId, folders);

  return (
    <li
      className={cn(
        "doc-grid-card border-border bg-card hover:border-primary/40 hover:bg-muted/30 relative flex min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm transition-colors",
        "sm:[&:hover_.doc-grid-card-select]:opacity-100 sm:[&:focus-within_.doc-grid-card-select]:opacity-100",
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
      <button
        type="button"
        onClick={() => onPreview(doc)}
        className="bg-muted/30 relative block aspect-[16/9] w-full overflow-hidden text-left"
        title={`Pratinjau ${doc.title?.trim() || doc.fileName}`}
      >
        {isImage ? (
          // Pakai thumbnail webp (~480px) bila ada — 1 file mentah bisa
          // puluhan MB (mis. PNG transparan), thumbnail biasanya <50 KB.
          <Image
            src={doc.thumbPath ?? doc.publicPath}
            alt={doc.fileName}
            fill
            unoptimized
            priority={priority}
            className="doc-grid-card-thumb object-cover transition-transform [.doc-grid-card:hover_&]:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"
          />
        ) : isVideo ? (
          <VideoTilePlaceholder
            thumbPath={doc.thumbPath}
            alt={doc.fileName}
            className="doc-grid-card-thumb transition-transform [.doc-grid-card:hover_&]:scale-[1.02]"
            iconSize="lg"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className={cn("size-10", meta.tone)} />
          </div>
        )}
        <span className="bg-background/90 text-foreground absolute top-2 right-2 z-[1] inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
          <Icon className={cn("size-3", meta.tone)} />
          {meta.label}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {showFolderHint ? (
          canManage ? (
            <MoveFolderMenu
              doc={doc}
              folders={folders}
              onMove={onMove}
              trigger={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/40 -mx-1 -my-0.5 inline-flex w-fit max-w-full items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase transition-colors"
                  title="Pindahkan ke folder lain"
                >
                  <Folder className="size-3 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{currentFolderName}</span>
                </button>
              }
            />
          ) : (
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
              {currentFolderName}
            </p>
          )
        ) : null}
        <button
          type="button"
          onClick={() => onPreview(doc)}
          className="text-foreground line-clamp-2 text-left text-sm font-medium hover:underline"
          title={doc.title?.trim() || doc.fileName}
        >
          {doc.title?.trim() ? doc.title : doc.fileName}
        </button>
        <p
          className="text-muted-foreground line-clamp-1 text-[11px]"
          title={doc.fileName}
        >
          {doc.fileName}
        </p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className="truncate">{doc.uploadedBy.name ?? doc.uploadedBy.email}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatFileSize(doc.size)}</span>
          <span aria-hidden>·</span>
          <span>{formatDate(doc.createdAt)}</span>
        </div>
        <DocTagChips tags={doc.tags ?? []} />

        <div className="border-border/60 mt-auto flex flex-nowrap items-center justify-center gap-1 border-t pt-2">
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="shrink-0"
            aria-label={`Pratinjau ${doc.fileName}`}
            title="Pratinjau"
            onClick={() => onPreview(doc)}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="shrink-0"
            aria-label={`Unduh ${doc.fileName}`}
            title="Unduh"
            onClick={() => void onDownload(doc)}
          >
            <Download className="size-3.5" />
          </Button>
          {canManage ? (
            <>
              <MoveFolderMenu
                doc={doc}
                folders={folders}
                onMove={onMove}
                trigger={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Pindahkan ${doc.fileName}`}
                    title={`Pindah folder · sekarang: ${currentFolderName}`}
                    className="shrink-0"
                  >
                    <FolderInput className="size-3.5" />
                  </Button>
                }
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label={`Hapus ${doc.fileName}`}
                title="Hapus dokumen"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                onClick={() => void onDelete(doc)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          ) : null}
        </div>
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
  onDownload,
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
  onDownload: (d: RoomDocumentRow) => void | Promise<void>;
}) {
  const meta = fileTypeMeta(doc.mimeType);
  const Icon = meta.icon;
  const isImage = doc.mimeType.startsWith("image/");
  const isVideo = doc.mimeType.startsWith("video/");

  return (
    <li
      className={cn(
        "hover:bg-muted/40 flex flex-row flex-wrap items-center gap-2 px-3 py-2 transition-colors md:flex-nowrap md:gap-3",
        "[content-visibility:auto] [contain-intrinsic-block-size:72px]",
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
        <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded-md">
          {isImage ? (
            <Image
              src={doc.thumbPath ?? doc.publicPath}
              alt=""
              fill
              unoptimized
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
            <div className="flex h-full w-full items-center justify-center">
              <Icon className={cn("size-4", meta.tone)} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onPreview(doc)}
            className="text-foreground line-clamp-1 text-left text-sm font-medium hover:underline"
            title={doc.title?.trim() || doc.fileName}
          >
            {doc.title?.trim() ? doc.title : doc.fileName}
          </button>
          <p className="text-muted-foreground line-clamp-1 text-[11px]">
            {doc.fileName} · {doc.uploadedBy.name ?? doc.uploadedBy.email}
          </p>
          <DocTagChips tags={doc.tags ?? []} />
        </div>
      </div>
      {showFolderHint ? (
        <span className="text-muted-foreground line-clamp-1 w-32 text-[11px]">
          {folderLabelForDoc(doc.folderId, folders)}
        </span>
      ) : null}
      <span className="text-muted-foreground w-24 text-right text-[11px] tabular-nums">
        {formatFileSize(doc.size)}
      </span>
      <span className="text-muted-foreground w-32 text-[11px]">
        {formatDate(doc.createdAt)}
      </span>
      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Pratinjau ${doc.fileName}`}
          title="Pratinjau"
          onClick={() => onPreview(doc)}
        >
          <Eye className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Unduh ${doc.fileName}`}
          title="Unduh"
          onClick={() => void onDownload(doc)}
        >
          <Download className="size-4" />
        </Button>
        {canManage ? (
          <>
            <MoveFolderMenu
              doc={doc}
              folders={folders}
              onMove={onMove}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Pindahkan ${doc.fileName}`}
                  title={`Pindah folder · sekarang: ${folderLabelForDoc(
                    doc.folderId,
                    folders,
                  )}`}
                >
                  <FolderInput className="size-4" />
                </Button>
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus ${doc.fileName}`}
              title="Hapus dokumen"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void onDelete(doc)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
});

function DocList({
  childFolders,
  docs,
  folders,
  showFolderHint,
  currentUserId,
  isRoomManager,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onDownloadFolder,
  selectedDocIds,
  allDocsSelected,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onPreview,
  onDelete,
  onMove,
  onDownloadDocument,
}: {
  childFolders: RoomDocumentFolderRow[];
  docs: RoomDocumentRow[];
  folders: RoomDocumentFolderRow[];
  showFolderHint: boolean;
  currentUserId: string;
  isRoomManager: boolean;
  onOpenFolder: (folderId: string) => void;
  onRenameFolder: (folder: RoomDocumentFolderRow) => void;
  onDeleteFolder: (folder: RoomDocumentFolderRow) => void;
  onDownloadFolder: (folder: RoomDocumentFolderRow) => void;
  selectedDocIds: Set<string>;
  allDocsSelected: boolean;
  onToggleSelect: (docId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPreview: (d: RoomDocumentRow) => void;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onDownloadDocument: (d: RoomDocumentRow) => void | Promise<void>;
}) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wide uppercase md:flex">
        <Checkbox
          checked={allDocsSelected}
          onCheckedChange={(v) => {
            if (v === true) onSelectAll();
            else onClearSelection();
          }}
          aria-label="Pilih semua file"
          className="shrink-0"
        />
        <span className="flex-1">Nama</span>
        {showFolderHint ? <span className="w-48">Lokasi</span> : null}
        <span className="w-24 text-right">Ukuran</span>
        <span className="w-32">Diunggah</span>
        <span className="w-8" />
      </div>
      <ul className="divide-border divide-y">
        {childFolders.map((f) => (
          <DriveFolderGridCard
            key={f.id}
            folder={f}
            view="list"
            isRoomManager={isRoomManager}
            onOpen={() => onOpenFolder(f.id)}
            onRename={() => onRenameFolder(f)}
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
            canManage={d.uploadedBy.id === currentUserId || isRoomManager}
            selected={selectedDocIds.has(d.id)}
            onToggleSelect={() => onToggleSelect(d.id)}
            onPreview={onPreview}
            onDelete={onDelete}
            onMove={onMove}
            onDownload={onDownloadDocument}
          />
        ))}
      </ul>
    </div>
  );
}

function DocPreviewDialog({
  doc,
  previewPlaylist,
  onNavigate,
  onDownload,
  canManageTags,
  onClose,
}: {
  doc: RoomDocumentRow | null;
  previewPlaylist: RoomDocumentRow[];
  onNavigate: (d: RoomDocumentRow) => void;
  onDownload: (d: RoomDocumentRow) => void | Promise<void>;
  canManageTags: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tagDraft, setTagDraft] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  useEffect(() => {
    if (doc) setTagDraft((doc.tags ?? []).join(", "));
  }, [doc]);

  const open = doc !== null;

  const previewIndex = doc
    ? previewPlaylist.findIndex((d) => d.id === doc.id)
    : -1;
  const prevDoc = previewIndex > 0 ? previewPlaylist[previewIndex - 1]! : null;
  const nextDoc =
    previewIndex >= 0 && previewIndex < previewPlaylist.length - 1
      ? previewPlaylist[previewIndex + 1]!
      : null;
  const hasFileNav = previewPlaylist.length > 1 && previewIndex >= 0;

  useEffect(() => {
    if (!open || !doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevDoc) {
        e.preventDefault();
        onNavigate(prevDoc);
      } else if (e.key === "ArrowRight" && nextDoc) {
        e.preventDefault();
        onNavigate(nextDoc);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, doc, prevDoc, nextDoc, onNavigate]);

  async function saveTags() {
    if (!doc) return;
    const tokens = tagDraft
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const tags = normalizeRoomDocumentTags(tokens);
    setSavingTags(true);
    try {
      await updateRoomDocumentTags({ documentId: doc.id, tags });
      toast.success("Tag disimpan.");
      router.refresh();
    } catch (err) {
      toast.error(
        actionErrorMessage(err, "Gagal menyimpan tag."));
    } finally {
      setSavingTags(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="flex h-[min(90vh,820px)] w-[min(96vw,1100px)] max-w-none flex-col gap-3 p-4 sm:max-w-none">
        {doc ? (
          <>
            <DialogHeader className="flex flex-row flex-wrap items-start gap-3 pr-8">
              <div
                className={cn(
                  "bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg",
                )}
              >
                {(() => {
                  const meta = fileTypeMeta(doc.mimeType);
                  const Icon = meta.icon;
                  return <Icon className={cn("size-5", meta.tone)} />;
                })()}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <DialogTitle className="truncate text-base">
                  {doc.title?.trim() ? doc.title : doc.fileName}
                </DialogTitle>
                <p className="text-muted-foreground truncate text-xs">
                  {doc.fileName} · {fileTypeMeta(doc.mimeType).label} ·{" "}
                  {formatFileSize(doc.size)} ·{" "}
                  {doc.uploadedBy.name ?? doc.uploadedBy.email}
                </p>
                {hasFileNav ? (
                  <p className="text-muted-foreground text-[11px] tabular-nums">
                    File {previewIndex + 1} dari {previewPlaylist.length} · tampilan
                    folder saat ini
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {hasFileNav ? (
                  <>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      disabled={!prevDoc}
                      onClick={() => prevDoc && onNavigate(prevDoc)}
                      aria-label="File sebelumnya"
                      title="File sebelumnya (←)"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      disabled={!nextDoc}
                      onClick={() => nextDoc && onNavigate(nextDoc)}
                      aria-label="File berikutnya"
                      title="File berikutnya (→)"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a
                      href={doc.publicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ExternalLink className="size-3.5" />
                  Tab baru
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onDownload(doc)}
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
              </div>
            </DialogHeader>

            {canManageTags ? (
              <div className="space-y-1.5">
                <Label htmlFor="preview-doc-tags" className="text-xs">
                  Tag
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="preview-doc-tags"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    placeholder="footage, raw, approved — koma atau spasi"
                    disabled={savingTags}
                    className="h-9 sm:min-w-[240px] sm:flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void saveTags()}
                    disabled={savingTags}
                  >
                    {savingTags ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      "Simpan tag"
                    )}
                  </Button>
                </div>
              </div>
            ) : (doc.tags ?? []).length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="text-muted-foreground size-3.5 shrink-0" />
                {(doc.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="border-border bg-muted/20 relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
              {hasFileNav ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    disabled={!prevDoc}
                    onClick={() => prevDoc && onNavigate(prevDoc)}
                    aria-label="File sebelumnya"
                    title="Sebelumnya (←)"
                    className="absolute top-1/2 left-2 z-10 size-10 -translate-y-1/2 rounded-full shadow-md"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    disabled={!nextDoc}
                    onClick={() => nextDoc && onNavigate(nextDoc)}
                    aria-label="File berikutnya"
                    title="Berikutnya (→)"
                    className="absolute top-1/2 right-2 z-10 size-10 -translate-y-1/2 rounded-full shadow-md"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              ) : null}
              <PreviewBody key={doc.id} doc={doc} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const PREVIEW_IMAGE_ZOOM_MIN = 1;
const PREVIEW_IMAGE_ZOOM_MAX = 4;
const PREVIEW_IMAGE_ZOOM_STEP = 0.5;
const PREVIEW_IMAGE_ZOOM_DBLCLICK = 2;

function PreviewZoomImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(PREVIEW_IMAGE_ZOOM_MIN);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    setScale(PREVIEW_IMAGE_ZOOM_MIN);
    setPan({ x: 0, y: 0 });
    dragRef.current = null;
  }, [src]);

  const clampScale = (s: number) =>
    Math.min(PREVIEW_IMAGE_ZOOM_MAX, Math.max(PREVIEW_IMAGE_ZOOM_MIN, s));

  const applyScale = (next: number) => {
    const clamped = clampScale(next);
    setScale(clamped);
    if (clamped <= PREVIEW_IMAGE_ZOOM_MIN) setPan({ x: 0, y: 0 });
  };

  const zoomIn = () => applyScale(scale + PREVIEW_IMAGE_ZOOM_STEP);
  const zoomOut = () => applyScale(scale - PREVIEW_IMAGE_ZOOM_STEP);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (scale > PREVIEW_IMAGE_ZOOM_MIN + 0.05) {
      applyScale(PREVIEW_IMAGE_ZOOM_MIN);
    } else {
      applyScale(PREVIEW_IMAGE_ZOOM_DBLCLICK);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -PREVIEW_IMAGE_ZOOM_STEP : PREVIEW_IMAGE_ZOOM_STEP;
    applyScale(scale + delta);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= PREVIEW_IMAGE_ZOOM_MIN || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.panX + e.clientX - dragRef.current.startX,
      y: dragRef.current.panY + e.clientY - dragRef.current.startY,
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be released */
      }
    }
    dragRef.current = null;
  };

  const isZoomed = scale > PREVIEW_IMAGE_ZOOM_MIN + 0.05;

  return (
    <div
      className="bg-muted/30 relative h-full w-full overflow-hidden"
      onWheel={onWheel}
      title="Double-click untuk zoom · scroll untuk perbesar/perkecil · geser saat zoom"
    >
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-sm backdrop-blur-sm">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Perkecil"
          disabled={scale <= PREVIEW_IMAGE_ZOOM_MIN}
          onClick={zoomOut}
        >
          <ZoomOut className="size-3.5" />
        </Button>
        <span className="text-muted-foreground min-w-[3rem] text-center text-[11px] font-medium tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Perbesar"
          disabled={scale >= PREVIEW_IMAGE_ZOOM_MAX}
          onClick={zoomIn}
        >
          <ZoomIn className="size-3.5" />
        </Button>
      </div>

      <div
        className={cn(
          "flex h-full w-full touch-none items-center justify-center p-2 select-none",
          isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}

function PreviewBody({ doc }: { doc: RoomDocumentRow }) {
  const m = doc.mimeType;
  if (m.startsWith("image/")) {
    return <PreviewZoomImage src={doc.publicPath} alt={doc.fileName} />;
  }
  if (m === "application/pdf") {
    return (
      <iframe
        src={doc.publicPath}
        title={doc.fileName}
        className="h-full w-full"
      />
    );
  }
  if (m.startsWith("video/")) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <video
          key={doc.id}
          src={doc.publicPath}
          controls
          className="h-full w-full max-h-full"
          preload="metadata"
        />
      </div>
    );
  }
  if (m.startsWith("audio/")) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
        <div className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-2xl">
          <Music className="size-7" />
        </div>
        <p className="text-sm font-medium">{doc.fileName}</p>
        <audio src={doc.publicPath} controls className="w-full max-w-md" />
      </div>
    );
  }
  if (m.startsWith("text/") || m === "application/json") {
    return (
      <iframe
        src={doc.publicPath}
        title={doc.fileName}
        className="bg-background h-full w-full"
      />
    );
  }
  // Fallback
  const meta = fileTypeMeta(m);
  const Icon = meta.icon;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-2xl">
        <Icon className={cn("size-7", meta.tone)} />
      </div>
      <p className="text-sm font-medium">Pratinjau tidak tersedia</p>
      <p className="text-muted-foreground max-w-sm text-xs">
        Tipe file{" "}
        <span className="text-foreground font-medium">{meta.label}</span> tidak
        bisa ditampilkan di sini. Gunakan tombol{" "}
        <span className="text-foreground font-medium">Download</span> atau{" "}
        <span className="text-foreground font-medium">Tab baru</span>.
      </p>
    </div>
  );
}
