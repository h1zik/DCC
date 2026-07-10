"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { RoomMemberAvatarStack, type RoomMemberAvatarUser } from "@/components/room-member-avatar-stack";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";

type WikiComment = Awaited<ReturnType<typeof listRoomWikiComments>>[number];
type CollaborationState = Awaited<ReturnType<typeof heartbeatRoomWikiPage>>;

export function WikiCollaborationPanel({
  pageId,
  currentUserId,
  members,
  onEditableChange,
}: {
  pageId: string;
  currentUserId: string;
  members: RoomMemberAvatarUser[];
  onEditableChange: (editable: boolean) => void;
}) {
  const [collaboration, setCollaboration] = useState<CollaborationState | null>(null);
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
    let active = true;
    const sync = async () => {
      try {
        const state = await heartbeatRoomWikiPage(pageId);
        if (!active) return;
        setCollaboration(state);
        onEditableChange(state.canEdit);
      } catch (error) {
        if (!active) return;
        onEditableChange(false);
        toast.error(actionErrorMessage(error, "Gagal menyambungkan kolaborasi Wiki."));
      }
    };
    void sync();
    const initialComments = window.setTimeout(() => void refreshComments(), 0);
    const interval = window.setInterval(() => void sync(), 30_000);
    return () => {
      active = false;
      window.clearTimeout(initialComments);
      window.clearInterval(interval);
      void releaseRoomWikiPage(pageId);
    };
  }, [onEditableChange, pageId, refreshComments]);

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

  const activeUsers = collaboration?.presences.map((presence) => presence.user) ?? [];
  const lockOwner = collaboration?.lock?.user;

  return (
    <section className="border-border space-y-3 border-t pt-4" aria-label="Kolaborasi Wiki">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Users className="size-3.5" />
          {activeUsers.length > 0 ? (
            <RoomMemberAvatarStack users={activeUsers} size="sm" linkProfiles={false} />
          ) : (
            <span>Menghubungkan presence…</span>
          )}
          <span>{activeUsers.length} aktif di halaman</span>
        </div>
        {collaboration && !collaboration.canEdit && lockOwner ? (
          <div className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <Lock className="size-3" /> Sedang diedit {lockOwner.name || lockOwner.email}
          </div>
        ) : collaboration?.canEdit ? (
          <span className="text-emerald-700 dark:text-emerald-300 text-xs">Anda memegang lock edit</span>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <MessageSquare className="size-3.5" /> Komentar ({comments.length})
        </div>
        {comments.length > 0 ? (
          <div className="space-y-2">
            {comments.map((comment) => (
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
                      className="text-muted-foreground hover:text-foreground rounded p-1"
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
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Belum ada komentar di halaman ini.</p>
        )}

        <div className="relative">
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
            className="absolute right-2 bottom-2"
            aria-label="Kirim komentar"
          >
            <Send className="size-3.5" />
          </Button>
          {mentionSuggestions.length > 0 ? (
            <div className="border-border bg-popover absolute bottom-full z-20 mb-1 w-full rounded-md border p-1 shadow-lg">
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
      </div>
    </section>
  );
}
