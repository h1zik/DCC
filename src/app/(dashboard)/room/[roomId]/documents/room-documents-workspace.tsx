"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createRoomDocumentFolder,
  deleteRoomDocument,
  deleteRoomDocumentFolder,
  moveRoomDocumentToFolder,
  renameRoomDocumentFolder,
  uploadRoomDocument,
} from "@/actions/room-documents";
import { Button } from "@/components/ui/button";
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
  ArrowDownAZ,
  ArrowUpDown,
  Calendar,
  Check,
  CloudUpload,
  Copy,
  ExternalLink,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
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
  Search,
  Trash2,
  X,
} from "lucide-react";

export type RoomDocumentFolderRow = {
  id: string;
  name: string;
  sortOrder: number;
  _count: { documents: number };
};

export type RoomDocumentRow = {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  publicPath: string;
  createdAt: Date;
  folderId: string | null;
  uploadedBy: { id: string; name: string | null; email: string };
};

type BrowseKey = "all" | "ungrouped" | string;
type ViewMode = "grid" | "list";
type SortKey = "newest" | "oldest" | "name" | "size";

const SORT_LABEL: Record<SortKey, string> = {
  newest: "Terbaru",
  oldest: "Terlama",
  name: "Nama A → Z",
  size: "Ukuran",
};

const NO_FOLDER_VALUE = "__none__";

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
  if (!folderId) return "Tanpa folder";
  const f = folders.find((x) => x.id === folderId);
  return f?.name ?? "Folder";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [browseKey, setBrowseKey] = useState<BrowseKey>("all");
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
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

  useEffect(() => {
    if (browseKey === "ungrouped") setUploadFolderId(null);
    else if (browseKey !== "all") setUploadFolderId(browseKey);
  }, [browseKey]);

  const totalSize = useMemo(
    () => documents.reduce((acc, d) => acc + (d.size ?? 0), 0),
    [documents],
  );

  const ungroupedCount = useMemo(
    () => documents.filter((d) => d.folderId == null).length,
    [documents],
  );

  const visibleDocuments = useMemo(() => {
    let rows = documents;
    if (browseKey === "ungrouped") {
      rows = rows.filter((d) => d.folderId == null);
    } else if (browseKey !== "all") {
      rows = rows.filter((d) => d.folderId === browseKey);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((d) => {
        const t = (d.title ?? "").toLowerCase();
        const n = d.fileName.toLowerCase();
        return t.includes(q) || n.includes(q);
      });
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
      case "size":
        sorted.sort((a, b) => b.size - a.size);
        break;
    }
    return sorted;
  }, [documents, browseKey, search, sortKey]);

  async function handleUploadFiles(files: File[]) {
    if (!files.length) return;
    setPending(true);
    try {
      let ok = 0;
      for (const file of files) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          if (title.trim()) fd.append("title", title.trim());
          if (uploadFolderId) fd.append("folderId", uploadFolderId);
          await uploadRoomDocument(roomId, fd);
          ok += 1;
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `${file.name}: ${err.message}`
              : `${file.name}: unggah gagal.`,
          );
        }
      }
      if (ok > 0) {
        setTitle("");
        toast.success(ok === 1 ? "File diunggah." : `${ok} file diunggah.`);
        router.refresh();
      }
    } finally {
      setPending(false);
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
      const { id } = await createRoomDocumentFolder({ roomId, name });
      setNewFolderName("");
      toast.success("Folder dibuat.");
      setBrowseKey(id);
      setUploadFolderId(id);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat folder.");
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
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setRenameBusy(false);
    }
  }

  async function onDeleteFolder(folder: RoomDocumentFolderRow) {
    const n = folder._count.documents;
    const msg =
      n > 0
        ? `Hapus folder "${folder.name}"? ${n} file akan dipindahkan ke Tanpa folder.`
        : `Hapus folder "${folder.name}"?`;
    if (!confirm(msg)) return;
    setPending(true);
    try {
      await deleteRoomDocumentFolder(folder.id);
      toast.success("Folder dihapus.");
      if (browseKey === folder.id) {
        setBrowseKey("all");
        setUploadFolderId(null);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus folder.");
    } finally {
      setPending(false);
    }
  }

  async function onMoveDoc(d: RoomDocumentRow, folderId: string | null) {
    if (d.folderId === folderId) return;
    try {
      await moveRoomDocumentToFolder({ documentId: d.id, folderId });
      toast.success("Folder dokumen diperbarui.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal.");
      router.refresh();
    }
  }

  async function onDeleteDoc(d: RoomDocumentRow) {
    if (!confirm("Hapus dokumen ini?")) return;
    try {
      await deleteRoomDocument(d.id);
      toast.success("Dokumen dihapus.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal.");
    }
  }

  function copyLink(d: RoomDocumentRow) {
    const href =
      typeof window !== "undefined"
        ? new URL(d.publicPath, window.location.href).toString()
        : d.publicPath;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(href).then(
        () => toast.success("Tautan disalin."),
        () => toast.error("Gagal menyalin tautan."),
      );
    } else {
      toast.error("Browser tidak mendukung salin otomatis.");
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void handleUploadFiles(files);
  }

  const browseLabel =
    browseKey === "all"
      ? "Semua dokumen"
      : browseKey === "ungrouped"
        ? "Tanpa folder"
        : folders.find((f) => f.id === browseKey)?.name ?? "Folder";

  const inputId = `room-doc-file-${roomId}`;
  const totalDocs = documents.length;

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
            Buat folder untuk mengelompokkan file (mis. <em>Logo</em>,{" "}
            <em>Legal</em>). Saat unggah, pilih <em>Simpan ke folder</em>; file
            yang sudah ada bisa dipindahkan via menu titik tiga di kartunya.
            Manager ruangan dapat mengganti nama atau menghapus folder — file
            di folder yang dihapus akan otomatis pindah ke{" "}
            <em>Tanpa folder</em>.
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Sidebar */}
        <aside className="border-border bg-card sticky top-[5.5rem] z-10 w-full shrink-0 space-y-3 rounded-xl border p-3 lg:max-w-[240px]">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
              Folder
            </p>
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {folders.length + 2}
            </span>
          </div>

          <nav className="flex flex-col gap-0.5">
            <FolderRow
              icon={FolderOpen}
              label="Semua dokumen"
              count={totalDocs}
              active={browseKey === "all"}
              onSelect={() => setBrowseKey("all")}
            />
            <FolderRow
              icon={Folder}
              label="Tanpa folder"
              count={ungroupedCount}
              active={browseKey === "ungrouped"}
              onSelect={() => setBrowseKey("ungrouped")}
              muted
            />

            {folders.length > 0 ? (
              <div className="bg-border my-1 h-px" aria-hidden />
            ) : null}

            {folders.map((f) => (
              <div key={f.id} className="group flex items-center gap-0.5">
                <FolderRow
                  icon={Folder}
                  label={f.name}
                  count={f._count.documents}
                  active={browseKey === f.id}
                  onSelect={() => setBrowseKey(f.id)}
                  className="flex-1"
                />
                {isRoomManager ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Aksi folder ${f.name}`}
                          className="text-muted-foreground hover:text-foreground size-7 shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                        />
                      }
                    >
                      <MoreVertical className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4}>
                      <DropdownMenuItem onClick={() => openRename(f)}>
                        <Pencil className="size-3.5" />
                        Ganti nama
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => void onDeleteFolder(f)}
                      >
                        <Trash2 className="size-3.5" />
                        Hapus folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ))}
          </nav>

          <div className="border-border space-y-1.5 border-t pt-3">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
              Folder baru
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
                {pending ? (
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
                  · target folder:{" "}
                  <span className="text-foreground font-medium">
                    {uploadFolderId
                      ? folders.find((f) => f.id === uploadFolderId)?.name ??
                        "Folder"
                      : "Tanpa folder"}
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
                  disabled={pending}
                  onChange={(e) => void onFileInput(e)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
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
                    disabled={pending}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Simpan ke folder</Label>
                  <Select
                    value={uploadFolderId ?? NO_FOLDER_VALUE}
                    onValueChange={(v) =>
                      setUploadFolderId(
                        v === NO_FOLDER_VALUE || !v ? null : (v as string),
                      )
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <span>
                        {uploadFolderId
                          ? folders.find((f) => f.id === uploadFolderId)?.name ??
                            "Folder"
                          : "Tanpa folder"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_FOLDER_VALUE}>Tanpa folder</SelectItem>
                      {folders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>

          {/* Toolbar */}
          <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-xl border p-2">
            <div className="bg-muted/30 text-muted-foreground border-border flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5">
              <FolderOpen className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="text-foreground truncate text-sm font-medium">
                {browseLabel}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                · {visibleDocuments.length} dari {totalDocs}
              </span>
            </div>
            <div className="border-border focus-within:border-ring focus-within:ring-ring/40 flex items-center gap-2 rounded-lg border px-2.5 transition-colors focus-within:ring-2">
              <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / judul…"
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
                  <DropdownMenuRadioItem value="size">
                    <FileIcon className="size-3.5" /> {SORT_LABEL.size}
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

          {/* Files */}
          {visibleDocuments.length === 0 ? (
            <div className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
              <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
                <FolderOpen className="size-7" />
              </div>
              <p className="text-sm font-medium">
                {search.trim()
                  ? "Tidak ada file yang cocok dengan pencarian."
                  : browseKey === "all"
                    ? "Belum ada dokumen."
                    : browseKey === "ungrouped"
                      ? "Tidak ada file di luar folder."
                      : "Folder ini masih kosong."}
              </p>
              <p className="text-muted-foreground max-w-xs text-xs">
                Tarik file ke area atas, atau klik <em>Pilih file</em> untuk
                memulai unggah.
              </p>
            </div>
          ) : view === "grid" ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleDocuments.map((d) => (
                <DocCard
                  key={d.id}
                  doc={d}
                  folders={folders}
                  showFolderHint={browseKey === "all"}
                  canManage={d.uploadedBy.id === currentUserId || isRoomManager}
                  onMove={onMoveDoc}
                  onDelete={onDeleteDoc}
                  onCopy={copyLink}
                />
              ))}
            </ul>
          ) : (
            <DocList
              docs={visibleDocuments}
              folders={folders}
              showFolderHint={browseKey === "all"}
              isManagerOrOwner={(d) =>
                d.uploadedBy.id === currentUserId || isRoomManager
              }
              onMove={onMoveDoc}
              onDelete={onDeleteDoc}
              onCopy={copyLink}
            />
          )}
        </div>
      </div>

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

function FolderRow({
  icon: Icon,
  label,
  count,
  active,
  onSelect,
  className,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  className?: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted",
        muted && !active && "text-muted-foreground",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "opacity-100" : "opacity-70",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
          active
            ? "bg-primary-foreground/15 text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function DocCard({
  doc,
  folders,
  showFolderHint,
  canManage,
  onMove,
  onDelete,
  onCopy,
}: {
  doc: RoomDocumentRow;
  folders: RoomDocumentFolderRow[];
  showFolderHint: boolean;
  canManage: boolean;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  onCopy: (d: RoomDocumentRow) => void;
}) {
  const meta = fileTypeMeta(doc.mimeType);
  const Icon = meta.icon;
  const isImage = doc.mimeType.startsWith("image/");

  return (
    <li className="border-border bg-card group hover:border-primary/40 hover:bg-muted/30 relative flex min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm transition-colors">
      <a
        href={doc.publicPath}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-muted/30 relative block aspect-[16/9] w-full overflow-hidden"
        title={doc.title?.trim() || doc.fileName}
      >
        {isImage ? (
          <Image
            src={doc.publicPath}
            alt={doc.fileName}
            fill
            unoptimized
            className="object-cover transition-transform group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className={cn("size-10", meta.tone)} />
          </div>
        )}
        <span className="bg-background/90 text-foreground absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
          <Icon className={cn("size-3", meta.tone)} />
          {meta.label}
        </span>
      </a>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {showFolderHint ? (
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
            {folderLabelForDoc(doc.folderId, folders)}
          </p>
        ) : null}
        <a
          href={doc.publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground line-clamp-2 text-sm font-medium hover:underline"
          title={doc.title?.trim() || doc.fileName}
        >
          {doc.title?.trim() ? doc.title : doc.fileName}
        </a>
        <p
          className="text-muted-foreground line-clamp-1 text-[11px]"
          title={doc.fileName}
        >
          {doc.fileName}
        </p>
        <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className="truncate">{doc.uploadedBy.name ?? doc.uploadedBy.email}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatFileSize(doc.size)}</span>
          <span aria-hidden>·</span>
          <span>{formatDate(doc.createdAt)}</span>
        </div>
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <DocActions
          doc={doc}
          folders={folders}
          canManage={canManage}
          onMove={onMove}
          onDelete={onDelete}
          onCopy={onCopy}
          variant="card"
        />
      </div>
    </li>
  );
}

function DocList({
  docs,
  folders,
  showFolderHint,
  isManagerOrOwner,
  onMove,
  onDelete,
  onCopy,
}: {
  docs: RoomDocumentRow[];
  folders: RoomDocumentFolderRow[];
  showFolderHint: boolean;
  isManagerOrOwner: (d: RoomDocumentRow) => boolean;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  onCopy: (d: RoomDocumentRow) => void;
}) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border text-muted-foreground bg-muted/40 hidden items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wide uppercase md:flex">
        <span className="flex-1">Nama</span>
        {showFolderHint ? <span className="w-32">Folder</span> : null}
        <span className="w-24 text-right">Ukuran</span>
        <span className="w-32">Diunggah</span>
        <span className="w-8" />
      </div>
      <ul className="divide-border divide-y">
        {docs.map((d) => {
          const meta = fileTypeMeta(d.mimeType);
          const Icon = meta.icon;
          return (
            <li
              key={d.id}
              className="hover:bg-muted/40 flex flex-col gap-2 px-3 py-2 transition-colors md:flex-row md:items-center md:gap-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className={cn("bg-muted flex size-9 shrink-0 items-center justify-center rounded-md")}>
                  <Icon className={cn("size-4", meta.tone)} />
                </div>
                <div className="min-w-0">
                  <a
                    href={d.publicPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground line-clamp-1 text-sm font-medium hover:underline"
                    title={d.title?.trim() || d.fileName}
                  >
                    {d.title?.trim() ? d.title : d.fileName}
                  </a>
                  <p className="text-muted-foreground line-clamp-1 text-[11px]">
                    {d.fileName} · {d.uploadedBy.name ?? d.uploadedBy.email}
                  </p>
                </div>
              </div>
              {showFolderHint ? (
                <span className="text-muted-foreground line-clamp-1 w-32 text-[11px]">
                  {folderLabelForDoc(d.folderId, folders)}
                </span>
              ) : null}
              <span className="text-muted-foreground w-24 text-right text-[11px] tabular-nums">
                {formatFileSize(d.size)}
              </span>
              <span className="text-muted-foreground w-32 text-[11px]">
                {formatDate(d.createdAt)}
              </span>
              <div className="ml-auto md:ml-0">
                <DocActions
                  doc={d}
                  folders={folders}
                  canManage={isManagerOrOwner(d)}
                  onMove={onMove}
                  onDelete={onDelete}
                  onCopy={onCopy}
                  variant="list"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DocActions({
  doc,
  folders,
  canManage,
  onMove,
  onDelete,
  onCopy,
  variant,
}: {
  doc: RoomDocumentRow;
  folders: RoomDocumentFolderRow[];
  canManage: boolean;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  onCopy: (d: RoomDocumentRow) => void;
  variant: "card" | "list";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={variant === "card" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Aksi dokumen"
            className={cn(
              variant === "card" &&
                "bg-background/85 hover:bg-background border-border size-8 border shadow-sm backdrop-blur-sm",
            )}
          />
        }
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem
          onClick={() => {
            if (typeof window !== "undefined") {
              window.open(doc.publicPath, "_blank", "noopener,noreferrer");
            }
          }}
        >
          <ExternalLink className="size-3.5" />
          Buka di tab baru
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCopy(doc)}>
          <Copy className="size-3.5" />
          Salin tautan
        </DropdownMenuItem>

        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Pindahkan ke folder</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => void onMove(doc, null)}
              data-active={doc.folderId === null ? "" : undefined}
            >
              {doc.folderId === null ? (
                <Check className="size-3.5" />
              ) : (
                <Folder className="size-3.5 opacity-60" />
              )}
              Tanpa folder
            </DropdownMenuItem>
            {folders.map((f) => (
              <DropdownMenuItem
                key={f.id}
                onClick={() => void onMove(doc, f.id)}
                data-active={doc.folderId === f.id ? "" : undefined}
              >
                {doc.folderId === f.id ? (
                  <Check className="size-3.5" />
                ) : (
                  <Folder className="size-3.5 opacity-60" />
                )}
                {f.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void onDelete(doc)}
            >
              <Trash2 className="size-3.5" />
              Hapus dokumen
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
