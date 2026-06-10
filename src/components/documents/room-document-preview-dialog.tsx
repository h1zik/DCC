"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  Tag,
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [tagDraft, setTagDraft] = useState("");
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

  // Reset state transien saat dokumen yang dipreview berganti —
  // pola "adjust state during render".
  const currentKey = doc ? doc.id : null;
  if (sessionKey !== currentKey) {
    setSessionKey(currentKey);
    if (doc) {
      setTagDraft((doc.tags ?? []).join(", "));
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
    void refresh(sessionKey, { initial: true });
    const interval = window.setInterval(() => {
      void refresh(sessionKey);
    }, 45_000);
    return () => window.clearInterval(interval);
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
      toast.error(actionErrorMessage(err, "Gagal menyimpan tag."));
    } finally {
      setSavingTags(false);
    }
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
    linkUrl: null as string | null,
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="flex h-[min(92vh,820px)] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-border shrink-0 border-b px-4 py-3 pr-12">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">
                {doc.title?.trim() ? doc.title : doc.fileName}
              </DialogTitle>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {doc.fileName} · {fileTypeLabel(doc.mimeType)} ·{" "}
                {formatFileSize(doc.size)} ·{" "}
                {doc.uploadedBy.name ?? doc.uploadedBy.email}
                {hasFileNav
                  ? ` · File ${previewIndex + 1}/${previewPlaylist.length}`
                  : null}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                Pilih teks atau blok area untuk komentar (ala Google Drive)
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {hasFileNav ? (
                <>
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
              <Button
                type="button"
                size="sm"
                variant={commentsOpen ? "secondary" : "outline"}
                onClick={() => setCommentsOpen((v) => !v)}
                aria-pressed={commentsOpen}
              >
                <MessageSquare className="size-3.5" />
                Komentar
                {comments.length > 0 ? (
                  <span className="bg-primary/10 text-primary ml-1 rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                    {comments.length}
                  </span>
                ) : null}
              </Button>
            </div>
          </div>

          {canManageTags ? (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="preview-doc-tags" className="text-xs">
                Tag
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="preview-doc-tags"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  placeholder="footage, raw, approved"
                  disabled={savingTags}
                  className="h-8 sm:min-w-[200px] sm:flex-1"
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
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="bg-muted/20 relative min-h-[280px] min-w-0 flex-1 md:min-h-0">
            {loading && comments.length === 0 ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : null}
            <AnchoredFilePreview
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
              onPendingSelection={setPendingSelection}
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
      </DialogContent>

      {pendingSelection ? (
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
