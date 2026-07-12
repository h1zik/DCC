"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Music,
  Tag,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "@prisma/client";
import type { RoomDocumentRow } from "@/app/(dashboard)/room/[roomId]/documents/room-document-types";
import {
  addRoomDocumentComment,
  deleteRoomDocumentComment,
  loadRoomDocumentDetail,
  resolveRoomDocumentComment,
} from "@/actions/room-document-comments";
import { updateRoomDocumentTags } from "@/actions/room-documents";
import { actionErrorMessage } from "@/lib/action-error-message";
import { normalizeRoomDocumentTags } from "@/lib/room-document-tags";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AnchoredFilePreview,
  type AnchoredCommentPin,
  type PendingSelection,
} from "@/components/tasks/anchored-file-preview";
import {
  AnchoredCommentAside,
  SelectionCommentPopover,
  type AnchoredFileComment,
} from "@/components/tasks/anchored-file-comment-panel";

function fileTypeLabel(mime: string) {
  if (mime.startsWith("image/")) return "Gambar";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.startsWith("text/")) return "Teks";
  return "File";
}

function fileKindIcon(mime: string, className: string) {
  if (mime.startsWith("image/")) return <ImageIcon className={className} />;
  if (mime === "application/pdf") return <FileText className={className} />;
  if (mime.startsWith("video/")) return <Video className={className} />;
  if (mime.startsWith("audio/")) return <Music className={className} />;
  if (mime.startsWith("text/")) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initialsOf(label: string) {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Warna chip tag berdasarkan makna workflow (approved = hijau, tolak/revisi = merah). */
function tagTone(tag: string) {
  const t = tag.toLowerCase();
  if (["approved", "approve", "final", "done", "ok"].includes(t)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (["reject", "rejected", "revisi", "revision", "hold", "ulang"].includes(t)) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

/** Chip metadata kecil di top bar. */
function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-muted/60 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}

export function RoomDocumentPreviewDialog({
  doc,
  previewPlaylist,
  onNavigate,
  onDownload,
  canManageTags,
  onClose,
  currentUserId,
  isRoomManager,
}: {
  doc: RoomDocumentRow | null;
  previewPlaylist: RoomDocumentRow[];
  onNavigate: (d: RoomDocumentRow) => void;
  onDownload: (d: RoomDocumentRow) => void | Promise<void>;
  canManageTags: boolean;
  onClose: () => void;
  currentUserId: string;
  isRoomManager: boolean;
}) {
  const router = useRouter();
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [comments, setComments] = useState<AnchoredFileComment[]>([]);
  const [users, setUsers] = useState<Pick<User, "id" | "name" | "email">[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [draft, setDraft] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [pending, startTransition] = useTransition();
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [selectionDraft, setSelectionDraft] = useState("");
  const [selectionAssigneeId, setSelectionAssigneeId] = useState("");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const pendingSelectionRef = useRef(pendingSelection);
  pendingSelectionRef.current = pendingSelection;

  // Reset state transien saat dokumen yang dipreview berganti —
  // pola "adjust state during render".
  const currentKey = doc ? doc.id : null;
  if (sessionKey !== currentKey) {
    setSessionKey(currentKey);
    if (doc) {
      setTags(doc.tags ?? []);
      setNewTag("");
      setDraft("");
      setAssigneeId("");
      setPendingSelection(null);
      setSelectionDraft("");
      setSelectionAssigneeId("");
      setActiveCommentId(null);
      setCommentsOpen(false);
    }
  }

  const openComment = useCallback((id: string) => {
    setActiveCommentId(id);
    setCommentsOpen(true);
  }, []);

  const handlePendingSelection = useCallback((sel: PendingSelection | null) => {
    if (sel === null && pendingSelectionRef.current !== null) return;
    setPendingSelection(sel);
  }, []);

  const toggleComments = useCallback(() => {
    setCommentsOpen((open) => {
      if (open) {
        setPendingSelection(null);
        setSelectionDraft("");
        setSelectionAssigneeId("");
        setActiveCommentId(null);
        window.getSelection()?.removeAllRanges();
      }
      return !open;
    });
  }, []);

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

  const imageAttachments = useMemo(
    () =>
      previewPlaylist
        .filter((a) => a.mimeType.startsWith("image/") && a.publicPath)
        .map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          publicPath: a.publicPath,
          thumbPath: a.thumbPath,
          linkUrl: null as string | null,
        })),
    [previewPlaylist],
  );

  const imageIndex = useMemo(() => {
    if (!doc?.mimeType.startsWith("image/")) return 0;
    const idx = imageAttachments.findIndex((a) => a.id === doc.id);
    return idx >= 0 ? idx : 0;
  }, [doc, imageAttachments]);

  const commentPins: AnchoredCommentPin[] = useMemo(
    () =>
      comments.map((c) => ({
        id: c.id,
        body: c.body,
        selectedText: c.selectedText,
        anchorPage: c.anchorPage,
        anchorJson: c.anchorJson,
        resolvedAt: c.resolvedAt,
      })),
    [comments],
  );

  const loading = sessionKey !== null && loadedKey !== sessionKey;

  const refresh = useCallback(
    async (documentId: string, { initial = false } = {}) => {
      try {
        const detail = await loadRoomDocumentDetail(documentId);
        setComments(detail.document.comments);
        setUsers(detail.users);
      } catch (e) {
        if (initial) {
          toast.error(actionErrorMessage(e, "Gagal memuat pratinjau."));
        }
      } finally {
        if (initial) setLoadedKey(documentId);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sessionKey) return;
    let cancelled = false;
    const runRefresh = (initial: boolean) => {
      if (cancelled || document.hidden) return;
      void refresh(sessionKey, { initial });
    };
    const deferId = window.setTimeout(() => runRefresh(true), 0);
    const interval = window.setInterval(() => runRefresh(false), 60_000);
    const onVisibility = () => {
      if (!document.hidden) runRefresh(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(deferId);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionKey, refresh]);

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

  const persistTags = useCallback(
    async (next: string[]) => {
      if (!doc) return;
      const normalized = normalizeRoomDocumentTags(next);
      setTags(normalized);
      setSavingTags(true);
      try {
        await updateRoomDocumentTags({ documentId: doc.id, tags: normalized });
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan tag."));
        setTags(doc.tags ?? []);
      } finally {
        setSavingTags(false);
      }
    },
    [doc, router],
  );

  function addTag(raw: string) {
    const value = raw.trim();
    setNewTag("");
    if (!value) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    void persistTags([...tags, value]);
  }

  function removeTag(target: string) {
    void persistTags(tags.filter((t) => t !== target));
  }

  function onSubmitComment(anchor?: PendingSelection["anchor"] | null) {
    if (!doc) return;
    const body = anchor ? selectionDraft : draft;
    const assignee = anchor ? selectionAssigneeId : assigneeId;
    if (!body.trim()) return;

    startTransition(async () => {
      try {
        const created = await addRoomDocumentComment({
          documentId: doc.id,
          body: body.trim(),
          assigneeId: assignee ? assignee : null,
          anchor: anchor ?? null,
        });
        setComments((prev) => [...prev, created]);
        if (anchor) {
          setPendingSelection(null);
          setSelectionDraft("");
          setSelectionAssigneeId("");
          window.getSelection()?.removeAllRanges();
          openComment(created.id);
        } else {
          setDraft("");
          setAssigneeId("");
        }
        toast.success("Komentar ditambahkan.");
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menambah komentar."));
      }
    });
  }

  if (!doc) return null;

  const previewAttachment = {
    id: doc.id,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    publicPath: doc.publicPath,
    thumbPath: doc.thumbPath,
    linkUrl: null as string | null,
  };

  const uploaderLabel = doc.uploadedBy.name ?? doc.uploadedBy.email;
  const showFilmstrip = imageAttachments.length > 1;
  const showBottomBar = canManageTags || tags.length > 0 || showFilmstrip;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="flex h-[min(calc(100dvh-0.75rem),840px)] w-[min(calc(100vw-0.5rem),1240px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        {/* ===== Top bar ===== */}
        <DialogHeader className="border-border bg-card shrink-0 space-y-0 border-b px-3 py-2.5 pr-14 sm:px-4 sm:pr-16">
          <div className="flex items-center gap-3">
            <span
              className="border-primary/25 bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border"
              aria-hidden
            >
              {fileKindIcon(doc.mimeType, "size-[18px]")}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-sm leading-tight sm:text-base">
                {doc.title?.trim() ? doc.title : doc.fileName}
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <MetaChip>{fileTypeLabel(doc.mimeType)}</MetaChip>
                <MetaChip>{formatFileSize(doc.size)}</MetaChip>
                <MetaChip>
                  <span
                    className="flex size-4 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-[8px] font-bold text-white"
                    aria-hidden
                  >
                    {initialsOf(uploaderLabel)}
                  </span>
                  <span className="max-w-[140px] truncate">{uploaderLabel}</span>
                </MetaChip>
                {hasFileNav ? (
                  <MetaChip>
                    <span className="tabular-nums">
                      {previewIndex + 1}/{previewPlaylist.length}
                    </span>
                  </MetaChip>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {hasFileNav ? (
                <div className="mr-0.5 hidden items-center gap-1 sm:flex">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={!prevDoc}
                    onClick={() => prevDoc && onNavigate(prevDoc)}
                    aria-label="File sebelumnya"
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
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant={commentsOpen ? "secondary" : "outline"}
                onClick={toggleComments}
                aria-pressed={commentsOpen}
              >
                <MessageSquare className="size-3.5" />
                <span className="hidden sm:inline">Komentar</span>
                {comments.length > 0 ? (
                  <span className="bg-primary/15 text-primary ml-0.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                    {comments.length}
                  </span>
                ) : null}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void onDownload(doc)}
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title="Buka di tab baru"
                aria-label="Buka di tab baru"
                nativeButton={false}
                render={
                  <a
                    href={doc.publicPath}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ===== Stage + comments ===== */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {commentsOpen ? (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                <span className="bg-background/85 text-muted-foreground rounded-full border px-3 py-1 text-[11px] shadow-sm backdrop-blur">
                  Pilih teks atau blok area untuk menambah komentar
                </span>
              </div>
            ) : null}
            {loading && comments.length === 0 ? (
              <div className="bg-background/80 pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-2 rounded-full border px-2.5 py-1 shadow-sm">
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                <span className="text-muted-foreground text-[10px]">
                  Memuat komentar…
                </span>
              </div>
            ) : null}
            <AnchoredFilePreview
              className="h-full min-h-0"
              attachment={previewAttachment}
              imageAttachments={imageAttachments}
              imageIndex={imageIndex}
              onImageIndexChange={(idx) => {
                const target = imageAttachments[idx];
                if (target) {
                  const row = previewPlaylist.find((d) => d.id === target.id);
                  if (row) onNavigate(row);
                }
              }}
              comments={commentPins}
              activeCommentId={activeCommentId}
              commentMode={commentsOpen}
              onPendingSelection={handlePendingSelection}
              onCommentPinClick={openComment}
            />
          </div>

          {commentsOpen ? (
            <AnchoredCommentAside
              comments={comments}
              users={users}
              currentUserId={currentUserId}
              isRoomManager={isRoomManager}
              activeCommentId={activeCommentId}
              draft={draft}
              assigneeId={assigneeId}
              pending={pending}
              onActiveCommentChange={setActiveCommentId}
              onDraftChange={setDraft}
              onAssigneeChange={setAssigneeId}
              onSubmitGeneral={() => onSubmitComment(null)}
              onResolve={(commentId) => {
                startTransition(async () => {
                  try {
                    await resolveRoomDocumentComment({ commentId });
                    setComments((prev) =>
                      prev.map((row) =>
                        row.id === commentId
                          ? {
                              ...row,
                              resolvedAt: row.resolvedAt ? null : new Date(),
                            }
                          : row,
                      ),
                    );
                  } catch (e) {
                    toast.error(actionErrorMessage(e, "Gagal."));
                  }
                });
              }}
              onDelete={(commentId) => {
                startTransition(async () => {
                  try {
                    await deleteRoomDocumentComment(commentId);
                    setComments((prev) =>
                      prev.filter((row) => row.id !== commentId),
                    );
                    if (activeCommentId === commentId) {
                      setActiveCommentId(null);
                    }
                  } catch (e) {
                    toast.error(actionErrorMessage(e, "Gagal."));
                  }
                });
              }}
            />
          ) : null}
        </div>

        {/* ===== Bottom bar: tag + filmstrip ===== */}
        {showBottomBar ? (
          <div className="border-border bg-card shrink-0 border-t px-3 py-2.5 sm:px-4">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
              {/* Tag editor / read-only chips */}
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:max-w-[46%]">
                <span
                  className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold"
                  aria-hidden
                >
                  <Tag className="size-3.5" />
                </span>
                {tags.map((t) => (
                  <span
                    key={t}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      tagTone(t),
                    )}
                  >
                    {t}
                    {canManageTags ? (
                      <button
                        type="button"
                        className="-mr-0.5 rounded-full opacity-60 transition hover:opacity-100 disabled:opacity-40"
                        disabled={savingTags}
                        aria-label={`Hapus tag ${t}`}
                        onClick={() => removeTag(t)}
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
                {canManageTags ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag(newTag);
                        } else if (
                          e.key === "Backspace" &&
                          newTag === "" &&
                          tags.length > 0
                        ) {
                          removeTag(tags[tags.length - 1]!);
                        }
                      }}
                      onBlur={() => addTag(newTag)}
                      placeholder={tags.length ? "tambah…" : "tambah tag…"}
                      disabled={savingTags}
                      aria-label="Tambah tag"
                      className="h-7 w-28 rounded-full text-xs"
                    />
                    {savingTags ? (
                      <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                    ) : null}
                  </span>
                ) : null}
                {!canManageTags && tags.length === 0 ? (
                  <span className="text-muted-foreground text-xs">Tanpa tag</span>
                ) : null}
              </div>

              {showFilmstrip ? (
                <>
                  <div
                    className="bg-border hidden w-px self-stretch md:block"
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
                    {imageAttachments.map((img) => {
                      const active = img.id === doc.id;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          aria-label={img.fileName}
                          aria-current={active}
                          onClick={() => {
                            const row = previewPlaylist.find(
                              (d) => d.id === img.id,
                            );
                            if (row) onNavigate(row);
                          }}
                          className={cn(
                            "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                            "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
                            active
                              ? "border-primary shadow-sm"
                              : "border-transparent opacity-70 hover:opacity-100",
                          )}
                        >
                          {img.thumbPath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img.thumbPath}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          ) : (
                            // Tanpa thumbnail jangan muat file asli — filmstrip
                            // memuat SEMUA gambar folder sekaligus, file mentah
                            // bisa puluhan MB per item.
                            <span className="bg-muted flex size-full items-center justify-center">
                              <ImageIcon className="text-muted-foreground size-4" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>

      {commentsOpen && pendingSelection ? (
        <SelectionCommentPopover
          selection={pendingSelection}
          draft={selectionDraft}
          assigneeId={selectionAssigneeId}
          pending={pending}
          users={users}
          onDraftChange={setSelectionDraft}
          onAssigneeChange={setSelectionAssigneeId}
          onSubmit={() => onSubmitComment(pendingSelection.anchor)}
          onDismiss={() => {
            setPendingSelection(null);
            setSelectionDraft("");
            window.getSelection()?.removeAllRanges();
          }}
        />
      ) : null}
    </Dialog>
  );
}
