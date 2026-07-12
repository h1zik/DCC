"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FolderClosed,
  FolderPlus,
  FolderInput,
  Home,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createPersonalFolder,
  deletePersonalFile,
  deletePersonalFolder,
  movePersonalFile,
  renamePersonalFile,
  renamePersonalFolder,
} from "@/actions/personal-files";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FolderItem = { id: string; name: string; parentId: string | null };
type FileItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fileTypeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("gzip")
  ) {
    return FileArchive;
  }
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("document")
  ) {
    return FileText;
  }
  return FileIcon;
}

/** Label path folder untuk dialog pindah ("Induk / Anak"). */
function folderPathLabel(folder: FolderItem, byId: Map<string, FolderItem>) {
  const parts = [folder.name];
  let cursor = folder.parentId ? byId.get(folder.parentId) : null;
  let hops = 0;
  while (cursor && hops < 20) {
    parts.unshift(cursor.name);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
    hops += 1;
  }
  return parts.join(" / ");
}

export function FilesClient({
  currentFolderId,
  breadcrumb,
  folders,
  allFolders,
  files,
}: {
  currentFolderId: string | null;
  breadcrumb: { id: string; name: string }[];
  folders: FolderItem[];
  allFolders: FolderItem[];
  files: FileItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folderDialog, setFolderDialog] = useState<FolderItem | "new" | null>(
    null,
  );
  const [folderName, setFolderName] = useState("");
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveFile, setMoveFile] = useState<FileItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");

  const folderById = new Map(allFolders.map((f) => [f.id, f]));

  async function onUpload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const formData = new FormData();
        formData.set("file", file);
        if (currentFolderId) formData.set("folderId", currentFolderId);
        const res = await fetch("/api/personal/files", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          throw new Error(
            (await res.text()) || `Gagal mengunggah ${file.name}.`,
          );
        }
      }
      toast.success(
        list.length === 1 ? "File terunggah." : `${list.length} file terunggah.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Gagal mengunggah file."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function submitFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = folderName.trim();
    if (!name) {
      toast.error("Nama folder wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        if (folderDialog === "new") {
          await createPersonalFolder({ name, parentId: currentFolderId });
          toast.success("Folder dibuat.");
        } else if (folderDialog) {
          await renamePersonalFolder({ id: folderDialog.id, name });
          toast.success("Folder diubah.");
        }
        setFolderDialog(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan folder."));
      }
    });
  }

  function onDeleteFolder(folder: FolderItem) {
    if (
      !confirm(
        `Hapus folder “${folder.name}” beserta seluruh isinya? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deletePersonalFolder(folder.id);
        toast.success("Folder dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus folder."));
      }
    });
  }

  function submitRenameFile(e: React.FormEvent) {
    e.preventDefault();
    if (!renameFile) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Nama file wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await renamePersonalFile({ id: renameFile.id, fileName: name });
        toast.success("Nama file diubah.");
        setRenameFile(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah nama."));
      }
    });
  }

  function submitMoveFile(e: React.FormEvent) {
    e.preventDefault();
    if (!moveFile) return;
    startTransition(async () => {
      try {
        await movePersonalFile({
          id: moveFile.id,
          folderId: moveTarget || null,
        });
        toast.success("File dipindahkan.");
        setMoveFile(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memindahkan file."));
      }
    });
  }

  function onDeleteFile(file: FileItem) {
    if (!confirm(`Hapus file “${file.fileName}”?`)) return;
    startTransition(async () => {
      try {
        await deletePersonalFile(file.id);
        toast.success("File dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus file."));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav
          aria-label="Lokasi folder"
          className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-sm"
        >
          <Link
            href="/personal/files"
            className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <Home className="size-3.5" aria-hidden />
            File
          </Link>
          {breadcrumb.map((crumb) => (
            <span key={crumb.id} className="inline-flex items-center gap-1">
              <ChevronRight className="size-3" aria-hidden />
              <Link
                href={`/personal/files?folder=${crumb.id}`}
                className="hover:text-foreground max-w-40 truncate transition-colors"
              >
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setFolderName("");
              setFolderDialog("new");
            }}
          >
            <FolderPlus className="size-3.5" aria-hidden />
            Folder baru
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-3.5" aria-hidden />
            )}
            {uploading ? "Mengunggah…" : "Unggah file"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void onUpload(e.target.files)}
          />
        </div>
      </div>

      {folders.length === 0 && files.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
            <FolderClosed
              className="text-muted-foreground/60 size-8"
              aria-hidden
            />
            Folder ini masih kosong. Unggah file atau buat folder baru.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-border divide-y p-0">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group flex items-center gap-3 px-3 py-2.5"
              >
                <FolderClosed
                  className="text-primary/70 size-4 shrink-0"
                  aria-hidden
                />
                <Link
                  href={`/personal/files?folder=${folder.id}`}
                  className="text-foreground hover:text-primary min-w-0 flex-1 truncate text-sm font-medium transition-colors"
                >
                  {folder.name}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    type="button"
                    aria-label={`Menu folder ${folder.name}`}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setFolderName(folder.name);
                        setFolderDialog(folder);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Ubah nama
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDeleteFolder(folder)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Hapus folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {files.map((file) => {
              const Icon = fileTypeIcon(file.mimeType);
              return (
                <div
                  key={file.id}
                  className="group flex items-center gap-3 px-3 py-2.5"
                >
                  <Icon
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden
                  />
                  <a
                    href={`/api/personal/files/${file.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground hover:text-primary min-w-0 flex-1 truncate text-sm transition-colors"
                  >
                    {file.fileName}
                  </a>
                  <span className="text-muted-foreground hidden shrink-0 text-xs tabular-nums sm:inline">
                    {formatSize(file.size)}
                  </span>
                  <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                    {fmt(file.createdAt)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      type="button"
                      aria-label={`Menu file ${file.fileName}`}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = `/api/personal/files/${file.id}/download`;
                          a.download = file.fileName;
                          a.click();
                        }}
                      >
                        <Download className="size-3.5" aria-hidden />
                        Unduh
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameValue(file.fileName);
                          setRenameFile(file);
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Ubah nama
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setMoveTarget("");
                          setMoveFile(file);
                        }}
                      >
                        <FolderInput className="size-3.5" aria-hidden />
                        Pindahkan
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDeleteFile(file)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Hapus file
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Dialog folder baru / ubah nama folder */}
      <Dialog
        open={folderDialog !== null}
        onOpenChange={(open) => !open && setFolderDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {folderDialog === "new" ? "Folder baru" : "Ubah nama folder"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitFolder} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Nama folder</Label>
              <Input
                id="folder-name"
                value={folderName}
                maxLength={120}
                onChange={(e) => setFolderName(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {folderDialog === "new" ? "Buat folder" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog ubah nama file */}
      <Dialog
        open={renameFile !== null}
        onOpenChange={(open) => !open && setRenameFile(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah nama file</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitRenameFile} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="file-name">Nama file</Label>
              <Input
                id="file-name"
                value={renameValue}
                maxLength={240}
                onChange={(e) => setRenameValue(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog pindahkan file */}
      <Dialog
        open={moveFile !== null}
        onOpenChange={(open) => !open && setMoveFile(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pindahkan file</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitMoveFile} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="move-target">Folder tujuan</Label>
              <select
                id="move-target"
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="">Root (tanpa folder)</option>
                {allFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folderPathLabel(folder, folderById)}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Pindahkan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
