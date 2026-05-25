"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  deleteDirectMessage,
  editDirectMessage,
  getOrCreateDirectConversation,
  markDirectConversationRead,
  sendDirectMessage,
  sendDirectMessageForm,
} from "@/actions/direct-messages";
import type { DirectChatMessageView } from "@/lib/direct-chat-message-view";
import type { DirectInboxItem } from "@/lib/direct-chat-inbox";
import { previewText } from "@/lib/direct-chat-inbox";
import { directChatReplySnippet } from "@/lib/direct-chat-reply-snippet";
import { DIRECT_CHAT_MAX_FILES_PER_MESSAGE } from "@/lib/direct-chat-attachments-shared";
import { assertSafeGifUrl } from "@/lib/room-chat-gif";
import { toast } from "sonner";
import { DirectChatPushSetup } from "@/components/direct-chat/direct-chat-push-setup";
import { DirectChatMessageBubble } from "@/components/direct-chat/direct-chat-message-bubble";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clapperboard,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Smile,
  X,
} from "lucide-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Theme } from "emoji-picker-react";

const EmojiPicker = dynamic(
  () => import("emoji-picker-react").then((m) => m.default),
  { ssr: false, loading: () => null },
);

type EligibleUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  lastSeenAt: Date | string | null;
};

function authorLabel(name: string | null, email: string) {
  return name?.trim() || email;
}

function authorInitial(name: string | null, email: string) {
  return (name?.trim() || email).slice(0, 1).toUpperCase() || "?";
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return d.toLocaleString("id-ID", {
    ...(sameDay ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageActivityMs(m: DirectChatMessageView): number {
  return Math.max(
    new Date(m.createdAt).getTime(),
    new Date(m.updatedAt).getTime(),
  );
}

function mergeMessageLists(
  prev: DirectChatMessageView[],
  incoming: DirectChatMessageView[],
): DirectChatMessageView[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function syncLastActivityRef(
  ref: { current: string },
  list: DirectChatMessageView[],
) {
  if (list.length === 0) return;
  const maxMs = Math.max(...list.map(messageActivityMs));
  const prevMs = ref.current ? new Date(ref.current).getTime() : 0;
  if (maxMs > prevMs) ref.current = new Date(maxMs).toISOString();
}

export function DirectChatExperience({
  className,
  currentUserId,
  initialInbox,
  eligibleUsers,
}: {
  className?: string;
  currentUserId: string;
  initialInbox: DirectInboxItem[];
  eligibleUsers: EligibleUser[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");

  const [inbox, setInbox] = useState(initialInbox);
  const [messages, setMessages] = useState<DirectChatMessageView[]>([]);
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<{
    id: string;
    authorLabel: string;
    snippet: string;
  } | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [inboxQuery, setInboxQuery] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingGifUrl, setPendingGifUrl] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("happy");
  const [gifItems, setGifItems] = useState<{ url: string; preview: string }[]>(
    [],
  );
  const [gifLoading, setGifLoading] = useState(false);
  const [giphyConfigured, setGiphyConfigured] = useState<boolean | null>(null);
  const [pasteGif, setPasteGif] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingThread, setLoadingThread] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastSyncedAtRef = useRef<string>("");
  const nearBottomRef = useRef(true);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  const activeItem = useMemo(
    () => inbox.find((i) => i.conversationId === activeId) ?? null,
    [inbox, activeId],
  );

  const filteredInbox = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    if (!q) return inbox;
    return inbox.filter((i) => {
      const name = (i.otherUser.name ?? i.otherUser.email).toLowerCase();
      return name.includes(q) || i.otherUser.email.toLowerCase().includes(q);
    });
  }, [inbox, inboxQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return eligibleUsers;
    return eligibleUsers.filter((u) => {
      const name = (u.name ?? u.email).toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [eligibleUsers, userQuery]);

  const totalUnread = useMemo(
    () => inbox.reduce((acc, i) => acc + i.unreadCount, 0),
    [inbox],
  );

  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.author.id === currentUserId && !m.deletedAt) return m.id;
    }
    return null;
  }, [messages, currentUserId]);

  function readReceiptForMessage(m: DirectChatMessageView): "read" | "unread" | null {
    if (m.author.id !== currentUserId || m.deletedAt || m.id !== lastOwnMessageId) {
      return null;
    }
    if (!peerLastReadAt) return "unread";
    return new Date(m.createdAt).getTime() <= new Date(peerLastReadAt).getTime()
      ? "read"
      : "unread";
  }

  const peerReadSubtitle = useMemo(() => {
    if (!lastOwnMessageId || !peerLastReadAt) return null;
    const lastOwn = messages.find((m) => m.id === lastOwnMessageId);
    if (!lastOwn) return null;
    if (new Date(lastOwn.createdAt).getTime() > new Date(peerLastReadAt).getTime()) {
      return null;
    }
    return `Dibaca ${formatTime(peerLastReadAt)}`;
  }, [lastOwnMessageId, peerLastReadAt, messages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const pollInbox = useCallback(async () => {
    if (document.hidden) return;
    try {
      const res = await fetch("/api/direct-chat/inbox", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { inbox: DirectInboxItem[] };
      setInbox(data.inbox);
    } catch {
      /* abaikan */
    }
  }, []);

  const pollMessages = useCallback(async () => {
    if (!activeId || document.hidden) return;
    const since = lastSyncedAtRef.current;
    const url = since
      ? `/api/direct-chat/${activeId}/messages?since=${encodeURIComponent(since)}`
      : `/api/direct-chat/${activeId}/messages`;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: DirectChatMessageView[];
        peerLastReadAt?: string | null;
        mode: "delta" | "initial";
      };
      if (typeof data.peerLastReadAt !== "undefined") {
        setPeerLastReadAt(data.peerLastReadAt);
      }
      if (data.mode === "initial") {
        setMessages(data.messages);
        syncLastActivityRef(lastSyncedAtRef, data.messages);
        if (nearBottomRef.current) scrollToBottom("auto");
      } else if (data.messages.length > 0) {
        const fromPeer = data.messages.some(
          (m) => m.author.id !== currentUserId,
        );
        setMessages((prev) => mergeMessageLists(prev, data.messages));
        syncLastActivityRef(lastSyncedAtRef, data.messages);
        if (nearBottomRef.current) scrollToBottom();
        if (fromPeer && activeId) {
          void markDirectConversationRead(activeId).then(() => {
            window.dispatchEvent(new Event("direct-chat-inbox-changed"));
          });
        }
      }
    } catch {
      /* abaikan */
    }
  }, [activeId, currentUserId, scrollToBottom]);

  useEffect(() => {
    const t = window.setInterval(pollInbox, 5000);
    return () => window.clearInterval(t);
  }, [pollInbox]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setPeerLastReadAt(null);
      lastSyncedAtRef.current = "";
      return;
    }
    setLoadingThread(true);
    lastSyncedAtRef.current = "";
    void (async () => {
      await pollMessages();
      setLoadingThread(false);
      void markDirectConversationRead(activeId).then(() => {
        window.dispatchEvent(new Event("direct-chat-inbox-changed"));
      });
      setInbox((prev) =>
        prev.map((i) =>
          i.conversationId === activeId ? { ...i, unreadCount: 0 } : i,
        ),
      );
      window.dispatchEvent(new Event("direct-chat-inbox-changed"));
    })();
    const t = window.setInterval(pollMessages, 2500);
    return () => window.clearInterval(t);
  }, [activeId, pollMessages]);

  function openConversation(conversationId: string) {
    router.replace(`/messages?c=${conversationId}`, { scroll: false });
  }

  function startChatWithUser(userId: string) {
    startTransition(async () => {
      try {
        const { conversationId } = await getOrCreateDirectConversation(userId);
        setNewChatOpen(false);
        setUserQuery("");
        await pollInbox();
        openConversation(conversationId);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memulai percakapan."));
      }
    });
  }

  useEffect(() => {
    if (!gifOpen) return;
    const t = window.setTimeout(async () => {
      setGifLoading(true);
      try {
        const r = await fetch(
          `/api/room-chat/giphy?q=${encodeURIComponent(gifQuery)}`,
        );
        const j = (await r.json()) as {
          items?: { url: string; preview: string }[];
          configured?: boolean;
        };
        setGifItems(Array.isArray(j.items) ? j.items : []);
        if (typeof j.configured === "boolean") setGiphyConfigured(j.configured);
      } catch {
        setGifItems([]);
      } finally {
        setGifLoading(false);
      }
    }, 380);
    return () => window.clearTimeout(t);
  }, [gifQuery, gifOpen]);

  function startReplyTo(m: DirectChatMessageView) {
    if (m.deletedAt) return;
    setEditingMessage(null);
    setReply({
      id: m.id,
      authorLabel: authorLabel(m.author.name, m.author.email),
      snippet: directChatReplySnippet({
        body: m.body,
        gifUrl: m.gifUrl,
        attachmentCount: m.attachments.length,
      }),
    });
    taRef.current?.focus();
  }

  function startEdit(m: DirectChatMessageView) {
    if (m.deletedAt) return;
    setReply(null);
    setPendingGifUrl(null);
    setPendingFiles([]);
    setEditingMessage({ id: m.id, body: m.body });
    setBody(m.body);
    taRef.current?.focus();
  }

  function cancelEdit() {
    setEditingMessage(null);
    setBody("");
  }

  function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setPendingFiles((prev) => {
      const next = [...prev, ...Array.from(files)];
      return next.slice(0, DIRECT_CHAT_MAX_FILES_PER_MESSAGE);
    });
  }

  function applyPastedGif() {
    const raw = pasteGif.trim();
    if (!raw) return;
    try {
      setPendingGifUrl(assertSafeGifUrl(raw));
      setPasteGif("");
      setGifOpen(false);
    } catch (e) {
      toast.error(actionErrorMessage(e, "URL GIF tidak valid."));
    }
  }

  function scrollToMessage(id: string) {
    messageRefs.current.get(id)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function submitMessage() {
    const text = body.trim();
    const gif = pendingGifUrl?.trim() ?? "";
    const hasFiles = pendingFiles.length > 0;
    if (!activeId || pending) return;
    if (editingMessage) {
      if (!text) {
        toast.error("Pesan tidak boleh kosong.");
        return;
      }
      startTransition(async () => {
        try {
          const updated = await editDirectMessage({
            messageId: editingMessage.id,
            body: text,
          });
          setEditingMessage(null);
          setBody("");
          setMessages((prev) => mergeMessageLists(prev, [updated]));
          syncLastActivityRef(lastSyncedAtRef, [updated]);
        } catch (e) {
          toast.error(actionErrorMessage(e, "Gagal mengedit pesan."));
        }
      });
      return;
    }
    if (!text && !gif && !hasFiles) return;

    startTransition(async () => {
      try {
        let created: DirectChatMessageView;
        if (hasFiles) {
          const fd = new FormData();
          fd.append("conversationId", activeId);
          fd.append("body", text);
          if (gif) fd.append("gifUrl", gif);
          if (reply?.id) fd.append("replyToId", reply.id);
          for (const f of pendingFiles) fd.append("files", f);
          created = await sendDirectMessageForm(fd);
        } else {
          created = await sendDirectMessage({
            conversationId: activeId,
            body: text,
            gifUrl: gif || undefined,
            replyToId: reply?.id,
          });
        }
        setBody("");
        setReply(null);
        setPendingGifUrl(null);
        setPendingFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        nearBottomRef.current = true;
        setMessages((prev) => mergeMessageLists(prev, [created]));
        syncLastActivityRef(lastSyncedAtRef, [created]);
        scrollToBottom();
        void pollInbox();
        window.dispatchEvent(new Event("direct-chat-inbox-changed"));
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal mengirim."));
      }
    });
  }

  function confirmDeleteMessage(messageId: string) {
    if (!window.confirm("Hapus pesan ini? Tindakan tidak dapat dibatalkan.")) return;
    startTransition(async () => {
      try {
        await deleteDirectMessage(messageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  body: "",
                  gifUrl: null,
                  deletedAt: new Date().toISOString(),
                  editedAt: null,
                  attachments: [],
                  updatedAt: new Date().toISOString(),
                }
              : m,
          ),
        );
        lastSyncedAtRef.current = new Date().toISOString();
        if (editingMessage?.id === messageId) cancelEdit();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus pesan."));
      }
    });
  }

  const canSend =
    Boolean(editingMessage ? body.trim() : body.trim() || pendingGifUrl || pendingFiles.length);

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="border-border bg-card flex h-full min-h-0 flex-1 overflow-hidden rounded-none border shadow-sm">
        {/* Inbox */}
        <aside
          className={cn(
            "border-border flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-r md:w-[260px] lg:w-[280px]",
            activeId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="border-border shrink-0 space-y-2 border-b p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Pesan</h2>
                <p className="text-muted-foreground text-xs">
                  {totalUnread > 0 ? `${totalUnread} belum dibaca` : "Semua terbaca"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => setNewChatOpen(true)}
              >
                Baru
              </Button>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-3.5" />
              <Input
                value={inboxQuery}
                onChange={(e) => setInboxQuery(e.target.value)}
                placeholder="Cari percakapan…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {filteredInbox.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center text-sm">
                Belum ada percakapan. Ketuk <strong>Baru</strong> untuk mulai.
              </p>
            ) : (
              <ul>
                {filteredInbox.map((item) => {
                  const active = item.conversationId === activeId;
                  const online = isOnline(item.otherUser.lastSeenAt);
                  return (
                    <li key={item.conversationId}>
                      <button
                        type="button"
                        onClick={() => openConversation(item.conversationId)}
                        className={cn(
                          "hover:bg-muted/50 flex w-full gap-3 px-3 py-3 text-left transition-colors",
                          active && "bg-primary/8 border-primary/20 border-l-2",
                        )}
                      >
                        <div className="relative shrink-0">
                          {item.otherUser.image ? (
                            <Image
                              src={item.otherUser.image}
                              alt=""
                              width={44}
                              height={44}
                              className="size-11 rounded-full border object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="bg-accent/30 text-accent-foreground flex size-11 items-center justify-center rounded-full text-sm font-semibold">
                              {authorInitial(
                                item.otherUser.name,
                                item.otherUser.email,
                              )}
                            </div>
                          )}
                          {online ? (
                            <span
                              className="border-background absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-emerald-500"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {authorLabel(
                                item.otherUser.name,
                                item.otherUser.email,
                              )}
                            </span>
                            {item.lastMessage ? (
                              <time className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                                {formatTime(item.lastMessage.createdAt)}
                              </time>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {previewText(
                              item.lastMessage,
                              item.lastMessage?.authorId ?? "",
                              currentUserId,
                            )}
                          </p>
                        </div>
                        {item.unreadCount > 0 ? (
                          <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums">
                            {item.unreadCount > 9 ? "9+" : item.unreadCount}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section
          className={cn(
            "relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            !activeId ? "hidden md:flex" : "flex",
          )}
        >
          {!activeId ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-none">
                <MessageCircle className="size-7" aria-hidden />
              </div>
              <p className="text-foreground text-sm font-medium">
                Pilih percakapan atau mulai chat baru
              </p>
              <p className="max-w-xs text-xs leading-relaxed">
                Pesan pribadi antar tim. Aktifkan notifikasi push agar tidak ketinggalan
                pesan masuk.
              </p>
            </div>
          ) : activeItem ? (
            <>
              <header className="border-border bg-card z-10 flex shrink-0 items-center gap-3 border-b px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Kembali"
                  onClick={() => router.replace("/messages", { scroll: false })}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Link
                  href={`/profile/${activeItem.otherUser.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {activeItem.otherUser.image ? (
                    <Image
                      src={activeItem.otherUser.image}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-full border object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="bg-accent/30 flex size-10 items-center justify-center rounded-full text-sm font-semibold">
                      {authorInitial(
                        activeItem.otherUser.name,
                        activeItem.otherUser.email,
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {authorLabel(
                        activeItem.otherUser.name,
                        activeItem.otherUser.email,
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {peerReadSubtitle ??
                        (isOnline(activeItem.otherUser.lastSeenAt)
                          ? "Online"
                          : "Pesan pribadi")}
                    </p>
                  </div>
                </Link>
              </header>

              <div
                ref={scrollRef}
                className="bg-muted/15 min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
                onScroll={() => {
                  const el = scrollRef.current;
                  if (!el) return;
                  nearBottomRef.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
              >
                {loadingThread && messages.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">
                    Memuat pesan…
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">
                    Belum ada pesan. Ucapkan halo 👋
                  </p>
                ) : (
                  <div className="direct-chat-messages flex flex-col gap-2.5">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        ref={(el) => {
                          if (el) messageRefs.current.set(m.id, el);
                          else messageRefs.current.delete(m.id);
                        }}
                        data-message-id={m.id}
                      >
                        <DirectChatMessageBubble
                          message={m}
                          own={m.author.id === currentUserId}
                          readReceipt={readReceiptForMessage(m)}
                          onReply={() => startReplyTo(m)}
                          onEdit={() => startEdit(m)}
                          onDelete={() => confirmDeleteMessage(m.id)}
                          onScrollToReply={scrollToMessage}
                        />
                      </div>
                    ))}
                    <div ref={endRef} aria-hidden />
                  </div>
                )}
              </div>

              <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/90 sticky bottom-0 z-20 shrink-0 space-y-2 border-t p-3 shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.45)]">
                <DirectChatPushSetup className="mb-0.5" />
                {editingMessage ? (
                  <div className="bg-primary/10 flex items-center justify-between gap-2 rounded-none border border-dashed px-2 py-1.5 text-xs">
                    <span>
                      <strong>Mengedit pesan</strong> — Enter simpan, Esc batal
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Batal edit"
                      onClick={cancelEdit}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
                {reply ? (
                  <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-none border border-dashed px-2 py-1.5 text-xs">
                    <span className="truncate">
                      Balas <strong>{reply.authorLabel}</strong>: {reply.snippet}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setReply(null)}
                      aria-label="Batal balas"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
                {pendingGifUrl ? (
                  <div className="bg-muted/60 flex items-center justify-between gap-2 rounded-none border border-dashed px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingGifUrl}
                        alt=""
                        className="border-border size-12 shrink-0 rounded-none border object-cover"
                      />
                      <p className="text-muted-foreground truncate text-xs">
                        GIF akan dikirim bersama teks.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Hapus GIF"
                      onClick={() => setPendingGifUrl(null)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
                {pendingFiles.length > 0 ? (
                  <ul className="bg-muted/40 max-h-28 space-y-1 overflow-y-auto rounded-none border border-dashed p-2 text-xs">
                    {pendingFiles.map((f, idx) => (
                      <li
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{f.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Hapus ${f.name}`}
                          onClick={() =>
                            setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <X className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv"
                  onChange={(e) => {
                    onPickFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Textarea
                  ref={taRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    editingMessage
                      ? "Edit teks pesan…"
                      : "Tulis pesan… (lampiran, GIF, emoji)"
                  }
                  rows={2}
                  disabled={pending}
                  className="min-h-[72px] resize-y text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && editingMessage) {
                      e.preventDefault();
                      cancelEdit();
                      return;
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitMessage();
                    }
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                      <PopoverTrigger
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "gap-1",
                          pending && "pointer-events-none opacity-50",
                        )}
                        disabled={pending}
                        aria-label="Emoji"
                      >
                        <Smile className="size-4" />
                      </PopoverTrigger>
                      <PopoverContent
                        className="border-border w-auto max-w-[calc(100vw-2rem)] overflow-hidden border p-0 shadow-lg"
                        align="start"
                        side="top"
                        sideOffset={8}
                      >
                        <EmojiPicker
                          theme={Theme.AUTO}
                          onEmojiClick={(d: EmojiClickData) => {
                            setBody((b) => b + d.emoji);
                            setEmojiOpen(false);
                            taRef.current?.focus();
                          }}
                          width={352}
                          height={380}
                          previewConfig={{ showPreview: false }}
                          skinTonesDisabled
                        />
                      </PopoverContent>
                    </Popover>
                    {!editingMessage ? (
                      <>
                        <Popover open={gifOpen} onOpenChange={setGifOpen}>
                          <PopoverTrigger
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "gap-1",
                              pending && "pointer-events-none opacity-50",
                            )}
                            disabled={pending}
                            aria-label="GIF"
                          >
                            <Clapperboard className="size-4" />
                            GIF
                          </PopoverTrigger>
                          <PopoverContent
                            className="border-border w-[min(100vw-2rem,380px)] p-3 shadow-lg"
                            align="start"
                            side="top"
                            sideOffset={8}
                          >
                            <p className="text-muted-foreground mb-2 text-xs">
                              Cari Giphy atau tempel URL GIF (HTTPS).
                            </p>
                            <Input
                              value={gifQuery}
                              onChange={(e) => setGifQuery(e.target.value)}
                              placeholder="Cari GIF…"
                              className="mb-2"
                            />
                            {giphyConfigured === false ? (
                              <p className="text-muted-foreground mb-2 text-xs">
                                API Giphy belum diatur — tempel URL di bawah.
                              </p>
                            ) : null}
                            <div className="max-h-48 overflow-y-auto">
                              {gifLoading ? (
                                <p className="text-muted-foreground py-4 text-center text-sm">
                                  Memuat…
                                </p>
                              ) : gifItems.length === 0 ? (
                                <p className="text-muted-foreground py-3 text-center text-xs">
                                  Tidak ada hasil.
                                </p>
                              ) : (
                                <div className="grid grid-cols-3 gap-1.5">
                                  {gifItems.map((g) => (
                                    <button
                                      key={g.url}
                                      type="button"
                                      className="border-border overflow-hidden rounded-none border"
                                      onClick={() => {
                                        setPendingGifUrl(g.url);
                                        setGifOpen(false);
                                      }}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={g.preview}
                                        alt=""
                                        className="aspect-square w-full object-cover"
                                        loading="lazy"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="border-border mt-2 space-y-1 border-t pt-2">
                              <p className="text-muted-foreground text-[10px] font-medium">
                                Tempel URL GIF
                              </p>
                              <div className="flex gap-1">
                                <Input
                                  value={pasteGif}
                                  onChange={(e) => setPasteGif(e.target.value)}
                                  placeholder="https://media.giphy.com/…"
                                  className="text-xs"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={applyPastedGif}
                                >
                                  Pakai
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={
                            pending ||
                            pendingFiles.length >= DIRECT_CHAT_MAX_FILES_PER_MESSAGE
                          }
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="size-4" />
                          File
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    disabled={pending || !canSend}
                    onClick={submitMessage}
                    className="gap-1"
                  >
                    <Send className="size-4" />
                    {pending
                      ? "…"
                      : editingMessage
                        ? "Simpan"
                        : "Kirim"}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Enter kirim · Shift+Enter baris baru · Maks.{" "}
                  {DIRECT_CHAT_MAX_FILES_PER_MESSAGE} file per pesan
                </p>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pesan baru</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-3.5" />
            <Input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Cari nama atau email…"
              className="pl-8"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {filteredUsers.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-none px-2 py-2.5 text-left"
                  disabled={pending}
                  onClick={() => startChatWithUser(u.id)}
                >
                  {u.image ? (
                    <Image
                      src={u.image}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="bg-muted flex size-9 items-center justify-center rounded-full text-xs font-semibold">
                      {authorInitial(u.name, u.email)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {authorLabel(u.name, u.email)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
