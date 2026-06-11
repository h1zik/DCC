"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Quote, UserRound, X } from "lucide-react";
import type { User } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CommentMentionInput } from "@/components/tasks/comment-mention-input";
import type { PendingSelection } from "@/components/tasks/anchored-file-preview";

const emptySubscribe = () => () => {};

export type AnchoredFileComment = {
  id: string;
  body: string;
  selectedText: string | null;
  anchorPage: number | null;
  anchorJson: string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  author: Pick<User, "id" | "name" | "email">;
  assignee: Pick<User, "id" | "name" | "email"> | null;
};

export function SelectionCommentPopover({
  selection,
  draft,
  assigneeId,
  pending,
  users,
  onDraftChange,
  onAssigneeChange,
  onSubmit,
  onDismiss,
}: {
  selection: PendingSelection;
  draft: string;
  assigneeId: string;
  pending: boolean;
  users: Pick<User, "id" | "name" | "email">[];
  onDraftChange: (v: string) => void;
  onAssigneeChange: (v: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  const top = Math.min(
    window.innerHeight - 220,
    Math.max(16, selection.clientRect.top - 8),
  );
  const left = Math.min(
    window.innerWidth - 300,
    Math.max(16, selection.clientRect.left - 140),
  );

  return createPortal(
    <div
      data-anchored-selection-popover
      className="border-border bg-popover fixed z-[200] w-72 rounded-lg border p-3 shadow-xl"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">Komentar pada pilihan</p>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] italic">
            <Quote className="mr-0.5 inline size-3" />
            {selection.quote}
          </p>
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={onDismiss}
          aria-label="Tutup"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <CommentMentionInput
        value={draft}
        onChange={onDraftChange}
        assigneeId={assigneeId}
        onAssigneeChange={onAssigneeChange}
        users={users}
        onSubmit={onSubmit}
        pending={pending}
        placeholder="Jelaskan revisi… ketik @ untuk menandai"
        autoFocus
        minRows={3}
      />
    </div>,
    document.body,
  );
}

export function AnchoredCommentAside({
  comments,
  users,
  currentUserId,
  isRoomManager,
  activeCommentId,
  draft,
  assigneeId,
  pending,
  onActiveCommentChange,
  onDraftChange,
  onAssigneeChange,
  onSubmitGeneral,
  onResolve,
  onDelete,
}: {
  comments: AnchoredFileComment[];
  users: Pick<User, "id" | "name" | "email">[];
  currentUserId: string;
  isRoomManager: boolean;
  activeCommentId: string | null;
  draft: string;
  assigneeId: string;
  pending: boolean;
  onActiveCommentChange: (id: string) => void;
  onDraftChange: (v: string) => void;
  onAssigneeChange: (v: string) => void;
  onSubmitGeneral: () => void;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCommentId || !listRef.current) return;
    listRef.current
      .querySelector(`[data-aside-comment-id="${activeCommentId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeCommentId]);

  return (
    <aside className="border-border flex w-full shrink-0 flex-col border-t md:w-80 md:border-t-0 md:border-l">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <MessageSquare className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Komentar</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {comments.length}
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Blok teks di dokumen/gambar, atau tulis komentar umum di bawah.
          </p>
        ) : (
          comments.map((c) => {
            const isAssignee = c.assignee?.id === currentUserId;
            const isAuthor = c.author.id === currentUserId;
            const canResolve = isAssignee || isAuthor || isRoomManager;
            const canDelete = isAuthor || isRoomManager;
            const isActive = c.id === activeCommentId;
            return (
              <div
                key={c.id}
                data-aside-comment-id={c.id}
                role="button"
                tabIndex={0}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-sm transition-colors",
                  c.resolvedAt
                    ? "border-border/60 bg-muted/30 opacity-80"
                    : "border-border bg-background",
                  isActive && "ring-primary ring-2",
                )}
                onClick={() => onActiveCommentChange(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onActiveCommentChange(c.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground text-xs font-medium">
                      {c.author.name ?? c.author.email}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      {new Date(c.createdAt).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {c.anchorPage ? ` · Hal. ${c.anchorPage}` : null}
                    </p>
                  </div>
                  {c.resolvedAt ? (
                    <span className="bg-emerald-500/15 text-emerald-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                      Selesai
                    </span>
                  ) : c.assignee ? (
                    <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                      Menunggu
                    </span>
                  ) : null}
                </div>
                {c.selectedText ? (
                  <p className="bg-amber-500/10 text-foreground mt-1.5 line-clamp-2 rounded px-1.5 py-1 text-[11px] italic">
                    «{c.selectedText}»
                  </p>
                ) : null}
                {c.assignee ? (
                  <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[11px]">
                    <UserRound className="size-3 shrink-0" />
                    Ditugaskan:{" "}
                    <span className="text-foreground font-medium">
                      {c.assignee.name ?? c.assignee.email}
                    </span>
                  </p>
                ) : null}
                <p className="text-foreground mt-1.5 text-sm leading-snug whitespace-pre-wrap">
                  {c.body}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {canResolve ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolve(c.id);
                      }}
                    >
                      {c.resolvedAt ? "Buka kembali" : "Tandai selesai"}
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                    >
                      Hapus
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-border border-t p-3">
        <CommentMentionInput
          value={draft}
          onChange={onDraftChange}
          assigneeId={assigneeId}
          onAssigneeChange={onAssigneeChange}
          users={users}
          onSubmit={onSubmitGeneral}
          pending={pending}
          placeholder="Komentar umum… ketik @ untuk menandai"
          minRows={2}
        />
      </div>
    </aside>
  );
}
