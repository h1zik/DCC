"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@prisma/client";
import {
  addTaskAttachmentComment,
  deleteTaskAttachmentComment,
  loadTaskAttachmentDetail,
  resolveTaskAttachmentComment,
} from "@/actions/task-attachment-comments";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaskAttachmentRow } from "@/app/(dashboard)/tasks/task-types";
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

export function TaskAttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
  users,
  currentUserId,
  isRoomManager,
}: {
  attachment: TaskAttachmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: Pick<User, "id" | "name" | "email">[];
  currentUserId: string;
  isRoomManager: boolean;
}) {
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [comments, setComments] = useState<AnchoredFileComment[]>([]);
  const [siblings, setSiblings] = useState<
    Pick<TaskAttachmentRow, "id" | "fileName" | "mimeType" | "publicPath" | "linkUrl">[]
  >([]);
  const [imageIndex, setImageIndex] = useState(0);
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

  // Reset state transien saat lampiran yang dipreview berganti —
  // pola "adjust state during render".
  const currentKey = open && attachment ? attachment.id : null;
  if (sessionKey !== currentKey) {
    setSessionKey(currentKey);
    if (currentKey) {
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

  const imageAttachments = useMemo(
    () =>
      siblings.filter(
        (a) => a.mimeType.startsWith("image/") && a.publicPath,
      ),
    [siblings],
  );

  const activePreview = useMemo(() => {
    if (!attachment) return null;
    if (
      attachment.mimeType.startsWith("image/") &&
      imageAttachments.length > 0
    ) {
      return imageAttachments[imageIndex] ?? attachment;
    }
    return attachment;
  }, [attachment, imageAttachments, imageIndex]);

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
    async (attachmentId: string, { initial = false } = {}) => {
      try {
        const detail = await loadTaskAttachmentDetail(attachmentId);
        setComments(detail.comments);
        setSiblings(detail.task.attachments);
        if (initial) {
          // Index dihitung terhadap daftar gambar TERFILTER — daftar lengkap
          // berisi non-gambar sehingga indexnya tidak cocok dengan carousel.
          const images = detail.task.attachments.filter(
            (a) => a.mimeType.startsWith("image/") && a.publicPath,
          );
          const imgIdx = images.findIndex((a) => a.id === attachmentId);
          setImageIndex(imgIdx >= 0 ? imgIdx : 0);
        }
      } catch (e) {
        if (initial) {
          toast.error(actionErrorMessage(e, "Gagal memuat pratinjau."));
        }
      } finally {
        if (initial) setLoadedKey(attachmentId);
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

  function onSubmitComment(anchor?: PendingSelection["anchor"] | null) {
    if (!attachment) return;
    const body = anchor ? selectionDraft : draft;
    const assignee = anchor ? selectionAssigneeId : assigneeId;
    if (!body.trim()) return;

    startTransition(async () => {
      try {
        const created = await addTaskAttachmentComment({
          attachmentId: attachment.id,
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

  if (!attachment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(calc(100dvh-0.75rem),780px)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <div className="border-border flex shrink-0 items-center gap-2 border-b py-2 pr-12 pl-4">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
            {attachment.fileName}
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              Pilih teks atau blok area untuk komentar (ala Google Drive)
            </span>
          </DialogTitle>
          <Button
            type="button"
            size="sm"
            variant={commentsOpen ? "secondary" : "outline"}
            className={cn("shrink-0", commentsOpen && "ring-primary/40 ring-1")}
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
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="bg-muted/30 relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:min-h-0">
            {loading && comments.length === 0 ? (
              <div className="bg-background/80 pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-2 rounded-full border px-2.5 py-1 shadow-sm">
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                <span className="text-muted-foreground text-[10px]">Memuat komentar…</span>
              </div>
            ) : null}
            {activePreview ? (
              <AnchoredFilePreview
                className="h-full min-h-0"
                attachment={activePreview}
                imageAttachments={imageAttachments}
                imageIndex={imageIndex}
                onImageIndexChange={setImageIndex}
                comments={commentPins}
                activeCommentId={activeCommentId}
                onPendingSelection={setPendingSelection}
                onCommentPinClick={openComment}
              />
            ) : null}
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
                    await resolveTaskAttachmentComment({ commentId });
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
                    await deleteTaskAttachmentComment(commentId);
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
