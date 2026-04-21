"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Folder, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";

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

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function folderLabelForDoc(
  folderId: string | null,
  folders: RoomDocumentFolderRow[],
): string {
  if (!folderId) return "Tanpa folder";
  const f = folders.find((x) => x.id === folderId);
  return f?.name ?? "Folder";
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
  const [browseKey, setBrowseKey] = useState<BrowseKey>("all");
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [pending, setPending] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  useEffect(() => {
    if (browseKey === "ungrouped") setUploadFolderId(null);
    else if (browseKey !== "all") setUploadFolderId(browseKey);
  }, [browseKey]);

  const visibleDocuments = useMemo(() => {
    if (browseKey === "all") return documents;
    if (browseKey === "ungrouped") {
      return documents.filter((d) => d.folderId == null);
    }
    return documents.filter((d) => d.folderId === browseKey);
  }, [documents, browseKey]);

  const ungroupedCount = useMemo(
    () => documents.filter((d) => d.folderId == null).length,
    [documents],
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
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

  const inputId = `room-doc-file-${roomId}`;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="border-border bg-card w-full shrink-0 space-y-3 rounded-xl border p-3 lg:max-w-[220px]">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Folder
        </p>
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setBrowseKey("all")}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              browseKey === "all"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/80",
            )}
          >
            <FolderOpen className="size-4 shrink-0 opacity-80" aria-hidden />
            Semua dokumen
            <span
              className={cn(
                "ml-auto text-xs tabular-nums",
                browseKey === "all"
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {documents.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setBrowseKey("ungrouped")}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              browseKey === "ungrouped"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/80",
            )}
          >
            <Folder className="size-4 shrink-0 opacity-80" aria-hidden />
            Tanpa folder
            <span
              className={cn(
                "ml-auto text-xs tabular-nums",
                browseKey === "ungrouped"
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {ungroupedCount}
            </span>
          </button>
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setBrowseKey(f.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  browseKey === f.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/80",
                )}
              >
                <Folder className="size-4 shrink-0 opacity-80" aria-hidden />
                <span className="truncate">{f.name}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    browseKey === f.id
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {f._count.documents}
                </span>
              </button>
              {isRoomManager ? (
                <div className="flex shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="h-7 w-7"
                    aria-label={`Ganti nama ${f.name}`}
                    onClick={() => openRename(f)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:text-destructive h-7 w-7"
                    aria-label={`Hapus folder ${f.name}`}
                    onClick={() => void onDeleteFolder(f)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="border-border space-y-2 border-t pt-2">
          <Label className="text-xs">Folder baru</Label>
          <div className="flex gap-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Logo, Legal, …"
              disabled={pending}
              maxLength={80}
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
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="border-border bg-card space-y-3 rounded-xl border p-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Judul (opsional)</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Briefing Q3"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload-folder">Simpan ke folder</Label>
            <select
              id="upload-folder"
              className="border-input bg-background h-9 w-full max-w-md rounded-lg border px-2 text-sm"
              value={uploadFolderId ?? ""}
              onChange={(e) =>
                setUploadFolderId(e.target.value === "" ? null : e.target.value)
              }
              disabled={pending}
            >
              <option value="">Tanpa folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Sisipkan file</Label>
            <input
              id={inputId}
              type="file"
              multiple
              disabled={pending}
              onChange={(e) => void onFile(e)}
              className={cn(
                "border-input bg-background text-foreground file:bg-muted file:text-foreground flex min-h-9 w-full cursor-pointer rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none",
                "file:mr-3 file:inline-flex file:h-8 file:cursor-pointer file:items-center file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
            <p className="text-muted-foreground text-xs">
              Dokumen bersama ruangan. Beberapa file sekaligus diperbolehkan; batas
              ukuran mengikuti pengaturan server.
            </p>
          </div>
          {pending ? (
            <Button type="button" variant="secondary" size="sm" disabled>
              Memproses…
            </Button>
          ) : null}
        </div>

        <ul className="divide-border divide-y rounded-xl border border-border">
          {visibleDocuments.length === 0 ? (
            <li className="text-muted-foreground p-4 text-sm">
              {browseKey === "all"
                ? "Belum ada dokumen."
                : browseKey === "ungrouped"
                  ? "Tidak ada file di luar folder."
                  : "Folder ini masih kosong."}
            </li>
          ) : (
            visibleDocuments.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  {browseKey === "all" ? (
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      {folderLabelForDoc(d.folderId, folders)}
                    </p>
                  ) : null}
                  {d.mimeType.startsWith("image/") ? (
                    <a
                      href={d.publicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border relative block max-h-36 max-w-full overflow-hidden rounded-md border"
                    >
                      <Image
                        src={d.publicPath}
                        alt={d.fileName}
                        width={480}
                        height={320}
                        unoptimized
                        className="max-h-36 w-auto max-w-full object-contain"
                      />
                    </a>
                  ) : null}
                  <div>
                    <a
                      href={d.publicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-foreground font-medium hover:underline"
                    >
                      {d.title?.trim() ? d.title : d.fileName}
                    </a>
                    <p className="text-muted-foreground text-xs">
                      {d.uploadedBy.name ?? d.uploadedBy.email} ·{" "}
                      {formatFileSize(d.size)} ·{" "}
                      {new Date(d.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(d.uploadedBy.id === currentUserId || isRoomManager) && (
                    <>
                      <label className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap">
                        Folder
                        <select
                          className="border-input bg-background h-8 min-w-[8.5rem] rounded-md border px-1.5 text-xs"
                          value={d.folderId ?? ""}
                          onChange={async (e) => {
                            const v = e.target.value;
                            const next = v === "" ? null : v;
                            try {
                              await moveRoomDocumentToFolder({
                                documentId: d.id,
                                folderId: next,
                              });
                              toast.success("Folder dokumen diperbarui.");
                              router.refresh();
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Gagal.",
                              );
                              router.refresh();
                            }
                          }}
                        >
                          <option value="">Tanpa folder</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Hapus dokumen"
                        onClick={async () => {
                          if (!confirm("Hapus dokumen ini?")) return;
                          try {
                            await deleteRoomDocument(d.id);
                            toast.success("Dokumen dihapus.");
                            router.refresh();
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Gagal.",
                            );
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

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
