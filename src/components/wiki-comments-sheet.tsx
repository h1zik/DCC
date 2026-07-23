"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AtSign, CheckCircle2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addRoomWikiComment,
  deleteRoomWikiComment,
  listRoomWikiComments,
  resolveRoomWikiComment,
} from "@/actions/room-view-wiki";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type RoomMemberAvatarUser } from "@/components/room-member-avatar-stack";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";

type WikiComment = Awaited<ReturnType<typeof listRoomWikiComments>>[number];

/**
 * Panel komentar wiki sebagai slide-over kanan (ala Notion/ClickUp).
 * Memuat komentar saat mount (untuk badge jumlah) & tiap kali dibuka.
 */
export function WikiCommentsSheet({
  pageId,
  currentUserId,
  members,
  open,
  onOpenChange,
  onCountChange,
}: {
  pageId: string;
  currentUserId: string;
  members: RoomMemberAvatarUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<WikiComment[]>([]);
  const [body, setBody] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const refreshComments = useCallback(async () => {
    try {
      const next = await listRoomWikiComments(pageId);
      setComments(next);
      onCountChangeRef.current?.(next.length);
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal memuat komentar Wiki."));
    }
  }, [pageId]);

  // Muat awal (badge jumlah tampil walau panel belum dibuka).
  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshComments(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshComments]);

  // Segarkan tiap kali panel dibuka (ditunda ke macrotask agar refetch tak
  // memicu setState sinkron di dalam effect).
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => void refreshComments(), 0);
    return () => window.clearTimeout(timeout);
  }, [open, refreshComments]);

  const mentionMatch = /@([^@\s]*)$/.exec(body);
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase("id-ID") ?? null;
  const mentionSuggestions =
    mentionQuery == null
      ? []
      : members
          .filter((member) => member.id !== currentUserId)
          .filter((member) =>
            `${member.name ?? ""} ${member.email}`
              .toLocaleLowerCase("id-ID")
              .includes(mentionQuery),
          )
          .slice(0, 6);

  function insertMention(member: RoomMemberAvatarUser) {
    if (!mentionMatch) return;
    const name = member.name?.trim() || member.email.split("@")[0];
    setBody(`${body.slice(0, mentionMatch.index)}@${name} `);
    setMentionedUserIds((current) =>
      current.includes(member.id) ? current : [...current, member.id],
    );
  }

  function submitComment() {
    if (!body.trim() || pending) return;
    startTransition(async () => {
      try {
        await addRoomWikiComment({ pageId, body, mentionedUserIds });
        setBody("");
        setMentionedUserIds([]);
        await refreshComments();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal mengirim komentar."));
      }
    });
  }

  function toggleResolved(comment: WikiComment) {
    startTransition(async () => {
      try {
        await resolveRoomWikiComment(comment.id, !comment.resolvedAt);
        await refreshComments();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal memperbarui komentar."));
      }
    });
  }

  function removeComment(commentId: string) {
    startTransition(async () => {
      try {
        await deleteRoomWikiComment(commentId);
        await refreshComments();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal menghapus komentar."));
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[min(92vw,26rem)] flex-col gap-0 p-0 sm:max-w-[26rem]">
        <SheetHeader className="border-border border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" aria-hidden /> Komentar
            <span className="text-muted-foreground text-sm font-normal">
              {comments.length}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <article
                key={comment.id}
                className={cn(
                  "border-border rounded-lg border px-3 py-2 text-sm",
                  comment.resolvedAt && "bg-muted/40 opacity-70",
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium">
                      {comment.author.name || comment.author.email}
                    </span>
                    <span className="text-muted-foreground ml-2 text-[10px]">
                      {new Date(comment.createdAt).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => toggleResolved(comment)}
                      className={cn(
                        "text-muted-foreground hover:text-foreground rounded p-1",
                        comment.resolvedAt && "text-emerald-600 dark:text-emerald-400",
                      )}
                      aria-label={
                        comment.resolvedAt ? "Buka kembali komentar" : "Selesaikan komentar"
                      }
                    >
                      <CheckCircle2 className="size-3.5" />
                    </button>
                    {comment.authorId === currentUserId ? (
                      <button
                        type="button"
                        onClick={() => removeComment(comment.id)}
                        className="text-muted-foreground hover:text-destructive rounded p-1"
                        aria-label="Hapus komentar"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words">{comment.body}</p>
              </article>
            ))
          ) : (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm">
              <MessageSquare className="size-8 opacity-40" aria-hidden />
              <p>Belum ada komentar di halaman ini.</p>
              <p className="text-xs">Tulis komentar pertama di bawah.</p>
            </div>
          )}
        </div>

        <div className="border-border relative border-t p-3">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Tulis komentar. Ketik @ untuk mention anggota…"
            maxLength={2_000}
            className="min-h-20 pr-12"
          />
          <Button
            type="button"
            size="icon-sm"
            onClick={submitComment}
            disabled={!body.trim() || pending}
            className="absolute right-5 bottom-5"
            aria-label="Kirim komentar"
          >
            <Send className="size-3.5" />
          </Button>
          {mentionSuggestions.length > 0 ? (
            <div className="border-border bg-popover absolute bottom-full left-3 z-20 mb-1 w-[calc(100%-1.5rem)] rounded-md border p-1 shadow-lg">
              <div className="text-muted-foreground flex items-center gap-1 px-2 py-1 text-[10px] uppercase">
                <AtSign className="size-3" /> Mention anggota
              </div>
              {mentionSuggestions.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => insertMention(member)}
                  className="hover:bg-muted w-full rounded px-2 py-1.5 text-left text-sm"
                >
                  {member.name || member.email}
                  {member.name ? (
                    <span className="text-muted-foreground ml-2 text-xs">{member.email}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
