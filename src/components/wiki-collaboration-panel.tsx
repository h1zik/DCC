"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AtSign, CheckCircle2, Lock, MessageSquare, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  addRoomWikiComment,
  deleteRoomWikiComment,
  heartbeatRoomWikiPage,
  listRoomWikiComments,
  releaseRoomWikiPage,
  resolveRoomWikiComment,
} from "@/actions/room-view-wiki";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { RoomMemberAvatarStack, type RoomMemberAvatarUser } from "@/components/room-member-avatar-stack";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";

type WikiComment = Awaited<ReturnType<typeof listRoomWikiComments>>[number];
export type WikiCollaborationState = Awaited<ReturnType<typeof heartbeatRoomWikiPage>>;

/**
 * Presence + status lock untuk header halaman Wiki. Heartbeat hanya membawa
 * `requestLock` saat pengguna sedang mengedit — pembaca tidak memblokir siapa pun.
 */
export function WikiPresenceRow({
  pageId,
  currentUserId,
  editing,
  collaboration,
  onCollaborationChange,
}: {
  pageId: string;
  currentUserId: string;
  editing: boolean;
  collaboration: WikiCollaborationState | null;
  onCollaborationChange: (state: WikiCollaborationState) => void;
}) {
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  const onChangeRef = useRef(onCollaborationChange);
  useEffect(() => {
    onChangeRef.current = onCollaborationChange;
  }, [onCollaborationChange]);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const state = await heartbeatRoomWikiPage(pageId, {
          requestLock: editingRef.current,
        });
        if (active) onChangeRef.current(state);
      } catch {
        // Heartbeat gagal (offline/laggy) tidak perlu mengganggu pembaca;
        // percobaan berikutnya berjalan lewat interval.
      }
    };
    void sync();
    const interval = window.setInterval(() => void sync(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void releaseRoomWikiPage(pageId);
    };
  }, [pageId]);

  const activeUsers = collaboration?.presences.map((presence) => presence.user) ?? [];
  // Lock milik sendiri tidak perlu badge "sedang diedit" — itu untuk orang lain.
  const lockOwner =
    collaboration?.lock?.user && collaboration.lock.user.id !== currentUserId
      ? collaboration.lock.user
      : null;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
      <Users className="size-3.5" aria-hidden />
      {activeUsers.length > 0 ? (
        <>
          <RoomMemberAvatarStack users={activeUsers} size="sm" linkProfiles={false} />
          <span>{activeUsers.length} aktif di halaman</span>
        </>
      ) : (
        <span>Menghubungkan presence…</span>
      )}
      {lockOwner && !editing ? (
        <span className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5">
          <Lock className="size-3" aria-hidden /> Sedang diedit {lockOwner.name || lockOwner.email}
        </span>
      ) : null}
      {editing ? (
        <span className="text-emerald-700 dark:text-emerald-300">Anda memegang lock edit</span>
      ) : null}
    </div>
  );
}

/** Tombol "Komentar (N)" di header halaman; daftar & form komentar tampil dalam Sheet. */
export function WikiCommentsSheet({
  pageId,
  currentUserId,
  members,
}: {
  pageId: string;
  currentUserId: string;
  members: RoomMemberAvatarUser[];
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<WikiComment[]>([]);
  const [body, setBody] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const refreshComments = useCallback(async () => {
    try {
      setComments(await listRoomWikiComments(pageId));
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal memuat komentar Wiki."));
    }
  }, [pageId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshComments(), 0);
    return () => window.clearTimeout(initial);
  }, [refreshComments]);

  const openCount = comments.filter((comment) => !comment.resolvedAt).length;

  const mentionMatch = /@([^@\s]*)$/.exec(body);
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase("id-ID") ?? null;
  const mentionSuggestions = mentionQuery == null
    ? []
    : members
        .filter((member) => member.id !== currentUserId)
        .filter((member) =>
          `${member.name ?? ""} ${member.email}`.toLocaleLowerCase("id-ID").includes(mentionQuery),
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
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
        aria-label={`Buka komentar (${comments.length})`}
      >
        <MessageSquare className="size-3.5" aria-hidden />
        Komentar
        {openCount > 0 ? (
          <span className="bg-primary/10 text-primary rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
            {openCount}
          </span>
        ) : null}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-[min(94vw,28rem)] flex-col sm:max-w-md">
          <SheetHeader className="border-border border-b pr-12">
            <SheetTitle>Komentar halaman</SheetTitle>
            <SheetDescription>
              Diskusikan isi halaman. Ketik @ untuk mention anggota ruangan.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2 p-4">
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
                      <div>
                        <span className="font-medium">{comment.author.name || comment.author.email}</span>
                        <span className="text-muted-foreground ml-2 text-[10px]">
                          {new Date(comment.createdAt).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => toggleResolved(comment)}
                          className={cn(
                            "text-muted-foreground hover:text-foreground rounded p-1",
                            comment.resolvedAt && "text-emerald-600 dark:text-emerald-400",
                          )}
                          aria-label={comment.resolvedAt ? "Buka kembali komentar" : "Selesaikan komentar"}
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
                    <p className="whitespace-pre-wrap">{comment.body}</p>
                  </article>
                ))
              ) : (
                <p className="text-muted-foreground py-6 text-center text-xs">
                  Belum ada komentar di halaman ini.
                </p>
              )}
            </div>
          </ScrollArea>
          <div className="border-border relative border-t p-4">
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
              className="absolute right-6 bottom-6"
              aria-label="Kirim komentar"
            >
              <Send className="size-3.5" />
            </Button>
            {mentionSuggestions.length > 0 ? (
              <div className="border-border bg-popover absolute bottom-full z-20 mb-1 w-[calc(100%-2rem)] rounded-md border p-1 shadow-lg">
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
                    {member.name ? <span className="text-muted-foreground ml-2 text-xs">{member.email}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
