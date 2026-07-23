"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import {
  heartbeatRoomWikiPage,
  releaseRoomWikiPage,
} from "@/actions/room-view-wiki";
import { RoomMemberAvatarStack } from "@/components/room-member-avatar-stack";
import { actionErrorMessage } from "@/lib/action-error-message";

type CollaborationState = Awaited<ReturnType<typeof heartbeatRoomWikiPage>>;

/**
 * Indikator kolaborasi ringkas (presence + status lock edit) untuk baris aksi
 * atas. Komponen ini juga pemilik heartbeat yang menentukan `canEdit` seluruh
 * editor lewat `onEditableChange`. Komentar dipindah ke {@link "@/components/wiki-comments-sheet"}.
 */
export function WikiCollaborationPanel({
  pageId,
  onEditableChange,
}: {
  pageId: string;
  onEditableChange: (editable: boolean) => void;
}) {
  const [collaboration, setCollaboration] = useState<CollaborationState | null>(null);

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
    const interval = window.setInterval(() => void sync(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void releaseRoomWikiPage(pageId);
    };
  }, [onEditableChange, pageId]);

  const activeUsers = collaboration?.presences.map((presence) => presence.user) ?? [];
  const lockOwner = collaboration?.lock?.user;

  return (
    <div className="flex items-center gap-2" aria-label="Kolaborasi Wiki">
      {activeUsers.length > 0 ? (
        <RoomMemberAvatarStack users={activeUsers} size="sm" linkProfiles={false} />
      ) : null}
      {collaboration && !collaboration.canEdit && lockOwner ? (
        <span
          className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]"
          title={`Sedang diedit ${lockOwner.name || lockOwner.email}`}
        >
          <Lock className="size-3" aria-hidden />
          <span className="hidden max-w-28 truncate sm:inline">
            {lockOwner.name || lockOwner.email}
          </span>
        </span>
      ) : null}
    </div>
  );
}
