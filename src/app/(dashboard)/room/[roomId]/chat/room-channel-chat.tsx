"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Hash,
  Info,
  Lock,
  LockOpen,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  isRoomChannelProtected,
  ROOM_CHANNEL_UNREAD_CAP,
  type RoomChannelView,
} from "@/lib/room-channels";
import type { RoomChatMessageView } from "@/lib/room-chat-message-view";
import {
  createRoomChannel,
  deleteRoomChannel,
  listRoomChannels,
  markRoomChannelReadAction,
  renameRoomChannel,
  setRoomChannelLocked,
} from "@/actions/room-channels";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoomChatExperience } from "./room-chat-experience";
import { useVoice } from "@/components/voice/voice-provider";
import { useVoiceParticipants } from "@/components/voice/use-voice-participants";
import { VoiceChannelList } from "@/components/voice/voice-channel-list";
import { VoiceCallPanel } from "@/components/voice/voice-call-panel";

type MentionableUser = { id: string; name: string | null; email: string };

function unreadLabel(count: number): string {
  return count > ROOM_CHANNEL_UNREAD_CAP
    ? `${ROOM_CHANNEL_UNREAD_CAP}+`
    : String(count);
}

function ChannelManageMenu({
  channel,
  onRename,
  onToggleLock,
  onDelete,
}: {
  channel: RoomChannelView;
  onRename: (channel: RoomChannelView) => void;
  onToggleLock: (channel: RoomChannelView) => void;
  onDelete: (channel: RoomChannelView) => void;
}) {
  const protectedChannel = isRoomChannelProtected(channel);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md"
        aria-label={`Kelola #${channel.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onRename(channel)}>
          <Pencil className="size-3.5" aria-hidden />
          Ubah nama
        </DropdownMenuItem>
        {!channel.isDefault ? (
          <DropdownMenuItem onClick={() => onToggleLock(channel)}>
            {channel.isLocked ? (
              <LockOpen className="size-3.5" aria-hidden />
            ) : (
              <Lock className="size-3.5" aria-hidden />
            )}
            {channel.isLocked ? "Buka kunci" : "Kunci channel"}
          </DropdownMenuItem>
        ) : null}
        {!protectedChannel ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(channel)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Hapus channel
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RoomChannelChat({
  roomId,
  currentUserId,
  canManage,
  initialChannels,
  initialChannelId,
  initialMessages,
  mentionableUsers,
  memberCount,
  totalMessages,
  loadedMessages,
  hasMoreHistory,
}: {
  roomId: string;
  currentUserId: string;
  canManage: boolean;
  initialChannels: RoomChannelView[];
  initialChannelId: string;
  initialMessages: RoomChatMessageView[];
  mentionableUsers: MentionableUser[];
  memberCount: number;
  totalMessages: number;
  loadedMessages: number;
  hasMoreHistory: boolean;
}) {
  const voice = useVoice();
  const participantsByChannel = useVoiceParticipants(roomId);
  const [channels, setChannels] = useState<RoomChannelView[]>(initialChannels);
  const [activeChannelId, setActiveChannelId] = useState(initialChannelId);
  /**
   * Voice channel yang sedang dibuka di panel utama (bukan chat). Bila user
   * datang ke halaman ini saat sudah tersambung ke voice ruangan ini, langsung
   * tampilkan panel call-nya.
   */
  const [voiceViewId, setVoiceViewId] = useState<string | null>(() =>
    voice.activeCall?.roomId === roomId ? voice.activeCall.channelId : null,
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createLocked, setCreateLocked] = useState(false);
  const [createVoice, setCreateVoice] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RoomChannelView | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RoomChannelView | null>(null);
  const [pending, startTransition] = useTransition();
  const createInputRef = useRef<HTMLInputElement>(null);

  const activeChannelIdRef = useRef(activeChannelId);
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  const textChannels = channels.filter((c) => c.type !== "VOICE");
  const voiceChannels = channels.filter((c) => c.type === "VOICE");
  const activeChannel =
    textChannels.find((c) => c.id === activeChannelId) ??
    textChannels[0] ??
    null;
  const viewedVoiceChannel =
    voiceChannels.find((c) => c.id === voiceViewId) ?? null;

  /** Refresh daftar channel + unread; channel aktif selalu dianggap terbaca. */
  const refreshChannels = useCallback(async () => {
    try {
      const next = await listRoomChannels(roomId);
      const activeId = activeChannelIdRef.current;
      const activeServerUnread =
        next.find((c) => c.id === activeId)?.unreadCount ?? 0;
      setChannels(
        next.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c)),
      );
      // Channel yang sedang dilihat: majukan lastReadAt di server.
      if (activeServerUnread > 0) {
        void markRoomChannelReadAction(activeId).catch(() => undefined);
      }
    } catch {
      /* transient */
    }
  }, [roomId]);

  useEffect(() => {
    const id = window.setInterval(() => void refreshChannels(), 5000);
    return () => window.clearInterval(id);
  }, [refreshChannels]);

  const selectChannel = useCallback(
    (channelId: string) => {
      setVoiceViewId(null);
      if (channelId === activeChannelIdRef.current) return;
      setActiveChannelId(channelId);
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, unreadCount: 0 } : c)),
      );
      const url = new URL(window.location.href);
      url.searchParams.set("channel", channelId);
      window.history.replaceState(null, "", url.toString());
      void markRoomChannelReadAction(channelId).catch(() => undefined);
    },
    [],
  );

  function submitCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const created = await createRoomChannel({
          roomId,
          name,
          type: createVoice ? "VOICE" : "TEXT",
          isLocked: createLocked,
        });
        setChannels((prev) =>
          prev.some((c) => c.id === created.id) ? prev : [...prev, created],
        );
        setNewName("");
        setCreateLocked(false);
        setCreateVoice(false);
        setCreating(false);
        if (created.type === "VOICE") {
          setVoiceViewId(created.id);
        } else {
          selectChannel(created.id);
        }
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal membuat channel."));
      }
    });
  }

  function openRenameDialog(channel: RoomChannelView) {
    setRenameTarget(channel);
    setRenameValue(channel.name);
  }

  function submitRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    startTransition(async () => {
      try {
        await renameRoomChannel({ channelId: renameTarget.id, name });
        setRenameTarget(null);
        await refreshChannels();
        toast.success(`Channel diubah menjadi #${name}.`);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal mengganti nama channel."));
      }
    });
  }

  function confirmDeleteChannel() {
    if (!deleteTarget) return;
    const channel = deleteTarget;
    startTransition(async () => {
      try {
        const fallbackId = await deleteRoomChannel(channel.id);
        setDeleteTarget(null);
        setChannels((prev) => prev.filter((c) => c.id !== channel.id));
        if (voice.activeCall?.channelId === channel.id) {
          void voice.leave();
        }
        setVoiceViewId((prev) => (prev === channel.id ? null : prev));
        if (activeChannelIdRef.current === channel.id) {
          selectChannel(fallbackId);
        }
        await refreshChannels();
        toast.success(`Channel #${channel.name} dihapus.`);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus channel."));
      }
    });
  }

  function toggleChannelLock(channel: RoomChannelView) {
    if (channel.isDefault) return;
    const nextLocked = !channel.isLocked;
    startTransition(async () => {
      try {
        await setRoomChannelLocked({ channelId: channel.id, locked: nextLocked });
        setChannels((prev) =>
          prev.map((c) =>
            c.id === channel.id ? { ...c, isLocked: nextLocked } : c,
          ),
        );
        toast.success(
          nextLocked
            ? `Channel #${channel.name} dikunci.`
            : `Channel #${channel.name} dibuka kuncinya.`,
        );
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal mengubah kunci channel."));
      }
    });
  }

  const manageMenuFor = (channel: RoomChannelView) => (
    <ChannelManageMenu
      channel={channel}
      onRename={openRenameDialog}
      onToggleLock={toggleChannelLock}
      onDelete={setDeleteTarget}
    />
  );

  return (
    <div className="bg-card flex min-h-0 flex-1 overflow-hidden max-md:flex-col">
      <aside className="border-border bg-muted/20 flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2 max-md:w-full max-md:shrink-0 max-md:flex-row max-md:items-stretch max-md:gap-1 max-md:overflow-x-auto max-md:border-r-0 max-md:border-b">
        <div className="flex items-center justify-between gap-1 px-1.5 py-1 max-md:hidden">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Channel
          </span>
          {canManage ? (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-6 items-center justify-center rounded-md transition-colors"
              aria-label="Tambah channel"
              onClick={() => {
                setCreating(true);
                requestAnimationFrame(() => createInputRef.current?.focus());
              }}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {textChannels.map((channel) => {
          const active = channel.id === activeChannelId && !viewedVoiceChannel;
          const hasUnread = channel.unreadCount > 0 && !active;
          return (
            <div
              key={channel.id}
              className={cn(
                "group/channel relative flex shrink-0 items-center rounded-lg transition-colors",
                active
                  ? "bg-primary/12 text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {active ? (
                <span
                  className="bg-primary absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => selectChannel(channel.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm"
                title={channel.topic ?? `#${channel.name}`}
              >
                <Hash
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "opacity-70",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "truncate",
                    (active || hasUnread) && "font-semibold",
                  )}
                >
                  {channel.name}
                </span>
                {isRoomChannelProtected(channel) ? (
                  <Lock
                    className="size-3 shrink-0 opacity-40"
                    aria-label={
                      channel.isDefault ? "Channel default" : "Channel terkunci"
                    }
                  />
                ) : null}
              </button>
              {hasUnread ? (
                <span className="bg-primary text-primary-foreground mr-1 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                  {unreadLabel(channel.unreadCount)}
                </span>
              ) : null}
              {canManage ? (
                <span className="mr-1 shrink-0">{manageMenuFor(channel)}</span>
              ) : null}
            </div>
          );
        })}

        {canManage && creating ? (
          <div className="flex items-center gap-1 px-1 py-1 max-md:min-w-[200px]">
            <Input
              ref={createInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={createVoice ? "nama-voice" : "nama-channel"}
              className="h-8 text-sm"
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCreate();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setCreating(false);
                  setNewName("");
                  setCreateLocked(false);
                  setCreateVoice(false);
                }
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant={createVoice ? "secondary" : "ghost"}
              className={cn(createVoice && "text-primary")}
              aria-label={createVoice ? "Channel voice" : "Channel teks"}
              aria-pressed={createVoice}
              title={
                createVoice
                  ? "Channel voice (group call)"
                  : "Jadikan channel voice"
              }
              disabled={pending}
              onClick={() => setCreateVoice((prev) => !prev)}
            >
              {createVoice ? (
                <Volume2 className="size-4" aria-hidden />
              ) : (
                <Hash className="size-4" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={createLocked ? "secondary" : "ghost"}
              className={cn(createLocked && "text-primary")}
              aria-label={createLocked ? "Channel terkunci" : "Kunci channel"}
              aria-pressed={createLocked}
              title={createLocked ? "Channel akan dikunci" : "Kunci channel"}
              disabled={pending}
              onClick={() => setCreateLocked((prev) => !prev)}
            >
              {createLocked ? (
                <Lock className="size-4" aria-hidden />
              ) : (
                <LockOpen className="size-4" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              aria-label="Simpan channel"
              disabled={pending || !newName.trim()}
              onClick={submitCreate}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Batal"
              disabled={pending}
              onClick={() => {
                setCreating(false);
                setNewName("");
                setCreateLocked(false);
                setCreateVoice(false);
              }}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        <VoiceChannelList
          channels={voiceChannels}
          participantsByChannel={participantsByChannel}
          viewedChannelId={viewedVoiceChannel?.id ?? null}
          onOpen={(channel) => {
            setVoiceViewId(channel.id);
            void voice.join({
              roomId,
              channelId: channel.id,
              channelName: channel.name,
            });
          }}
          renderManageMenu={canManage ? manageMenuFor : undefined}
        />

        {canManage && !creating ? (
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm md:hidden"
            onClick={() => {
              setCreating(true);
              requestAnimationFrame(() => createInputRef.current?.focus());
            }}
          >
            <Plus className="size-4" aria-hidden />
            Channel
          </button>
        ) : null}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {viewedVoiceChannel ? (
          <>
            <header className="border-border flex shrink-0 items-center gap-2.5 border-b px-4 py-2.5">
              <Volume2
                className="text-muted-foreground size-5 shrink-0"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-semibold leading-tight">
                  {viewedVoiceChannel.name}
                </p>
                {viewedVoiceChannel.topic ? (
                  <p className="text-muted-foreground truncate text-xs leading-tight">
                    {viewedVoiceChannel.topic}
                  </p>
                ) : null}
              </div>
              {canManage ? manageMenuFor(viewedVoiceChannel) : null}
            </header>
            <VoiceCallPanel
              roomId={roomId}
              channel={viewedVoiceChannel}
              participants={participantsByChannel[viewedVoiceChannel.id] ?? []}
            />
          </>
        ) : null}
        {!viewedVoiceChannel && activeChannel ? (
          <header className="border-border flex shrink-0 items-center gap-2.5 border-b px-4 py-2.5">
            <Hash className="text-muted-foreground size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-foreground flex items-center gap-1.5 truncate text-sm font-semibold leading-tight">
                <span className="truncate">{activeChannel.name}</span>
                {isRoomChannelProtected(activeChannel) ? (
                  <Lock
                    className="text-muted-foreground size-3 shrink-0 opacity-60"
                    aria-label={
                      activeChannel.isDefault
                        ? "Channel default"
                        : "Channel terkunci"
                    }
                  />
                ) : null}
              </p>
              {activeChannel.topic ? (
                <p className="text-muted-foreground truncate text-xs leading-tight">
                  {activeChannel.topic}
                </p>
              ) : null}
            </div>
            <span
              className="text-muted-foreground hidden shrink-0 items-center gap-1 text-xs sm:inline-flex"
              title={`${memberCount} anggota`}
            >
              <Users className="size-3.5" aria-hidden />
              <span className="text-foreground font-medium tabular-nums">
                {memberCount}
              </span>
            </span>
            {canManage ? manageMenuFor(activeChannel) : null}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Tips & info chat"
                  >
                    <Info className="size-4" aria-hidden />
                  </Button>
                }
              />
              <PopoverContent
                align="end"
                className="text-muted-foreground w-72 space-y-2 text-xs leading-relaxed"
              >
                <p className="text-foreground font-semibold">Cara pakai chat</p>
                <p
                  className="text-muted-foreground"
                  title={
                    hasMoreHistory
                      ? `Menampilkan ${loadedMessages} dari ${totalMessages} pesan terbaru`
                      : `${totalMessages} pesan total`
                  }
                >
                  {totalMessages} pesan · {memberCount} anggota
                  {hasMoreHistory ? ` · ${loadedMessages} terbaru dimuat` : ""}
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    Mention anggota dengan{" "}
                    <code className="text-foreground">@</code> untuk notifikasi.
                  </li>
                  <li>Sisipkan emoji dari panel di kotak input.</li>
                  <li>Balas dengan kutipan untuk konteks pesan.</li>
                  <li>
                    Lampirkan GIF: pencarian Giphy bila{" "}
                    <code className="text-foreground">GIPHY_API_KEY</code> diatur,
                    atau tempel URL Giphy/Tenor.
                  </li>
                </ul>
              </PopoverContent>
            </Popover>
          </header>
        ) : null}
        {!viewedVoiceChannel && activeChannel ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <RoomChatExperience
              key={activeChannel.id}
              roomId={roomId}
              channelId={activeChannel.id}
              currentUserId={currentUserId}
              messages={
                activeChannel.id === initialChannelId ? initialMessages : []
              }
              mentionableUsers={mentionableUsers}
            />
          </div>
        ) : null}
      </div>

      <Dialog
        open={renameTarget != null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah nama channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="channel-rename">Nama channel</Label>
            <Input
              id="channel-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="nama-channel"
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setRenameTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={pending || !renameValue.trim()}
              onClick={submitRename}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus channel?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Channel <span className="text-foreground font-medium">#{deleteTarget?.name}</span>{" "}
            dan semua pesannya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmDeleteChannel}
            >
              Hapus channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
