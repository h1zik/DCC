"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import {
  mergePendingChatFiles,
  readClipboardImageFiles,
} from "@/lib/chat-pending-files";
import {
  preventComposerBlur,
  useChatComposerFocus,
} from "@/lib/use-chat-composer-focus";
import { assertSafeGifUrl } from "@/lib/room-chat-gif";
import { toast } from "sonner";
import { DirectChatPushSetup } from "@/components/direct-chat/direct-chat-push-setup";
import { DirectChatMessageBubble } from "@/components/direct-chat/direct-chat-message-bubble";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type InboxFilter = "all" | "unread";

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

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toLocaleString("id-ID", {
    ...(isSameCalendarDay(d, now) ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(d, now)) return "Hari ini";
  if (isSameCalendarDay(d, yesterday)) return "Kemarin";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function formatPresence(lastSeenAt: Date | string | null) {
  if (!lastSeenAt) return "Belum ada aktivitas";
  const iso = typeof lastSeenAt === "string" ? lastSeenAt : lastSeenAt.toISOString();
  if (isOnline(iso)) return "Online sekarang";
  return `Terakhir aktif ${formatTime(iso)}`;
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
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [inboxQuery, setInboxQuery] = useState("");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
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
  const scheduleComposerFocus = useChatComposerFocus(taRef, pending);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastSyncedAtRef = useRef<string>("");
  const nearBottomRef = useRef(true);
  const suppressNearBottomCheckRef = useRef(true);
  const shouldScrollToEndRef = useRef(true);
  const activeItem = useMemo(
    () => inbox.find((i) => i.conversationId === activeId) ?? null,
    [inbox, activeId],
  );

  const filteredInbox = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    return inbox.filter((i) => {
      if (inboxFilter === "unread" && i.unreadCount === 0) return false;
      if (!q) return true;
      const name = (i.otherUser.name ?? i.otherUser.email).toLowerCase();
      return name.includes(q) || i.otherUser.email.toLowerCase().includes(q);
    });
  }, [inbox, inboxFilter, inboxQuery]);

  const unreadConversationCount = useMemo(
    () => inbox.filter((i) => i.unreadCount > 0).length,
    [inbox],
  );

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

  const messageItems = useMemo(
    () =>
      messages.flatMap((message, index) => {
        const createdAt = new Date(message.createdAt);
        const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
        const previous = index > 0 ? messages[index - 1]! : null;
        const previousCreatedAt = previous ? new Date(previous.createdAt) : null;
        const previousDayKey = previousCreatedAt
          ? `${previousCreatedAt.getFullYear()}-${previousCreatedAt.getMonth()}-${previousCreatedAt.getDate()}`
          : "";
        const showDate = dayKey !== previousDayKey;
        const compact = Boolean(
          previous &&
            previous.author.id === message.author.id &&
            !showDate &&
            createdAt.getTime() - previousCreatedAt!.getTime() < 5 * 60 * 1000,
        );
        return [
          ...(showDate
            ? [
                {
                  type: "date" as const,
                  id: `date-${dayKey}-${index}`,
                  label: formatDateSeparator(message.createdAt),
                },
              ]
            : []),
          { type: "message" as const, message, compact },
        ];
      }),
    [messages],
  );

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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = scrollRef.current;
    if (!container) return;
    const top = container.scrollHeight - container.clientHeight;
    if (behavior === "auto") {
      container.scrollTop = top;
    } else {
      container.scrollTo({ top, behavior });
    }
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
        nearBottomRef.current = true;
        shouldScrollToEndRef.current = true;
        scrollToBottom("auto");
        requestAnimationFrame(() => scrollToBottom("auto"));
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

  useLayoutEffect(() => {
    shouldScrollToEndRef.current = true;
    nearBottomRef.current = true;
    suppressNearBottomCheckRef.current = true;
  }, [activeId]);

  useLayoutEffect(() => {
    if (!activeId || !shouldScrollToEndRef.current || messages.length === 0) {
      return;
    }
    const run = () => scrollToBottom("auto");
    run();
    const raf = requestAnimationFrame(run);
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 200);
    const t3 = window.setTimeout(() => {
      run();
      shouldScrollToEndRef.current = false;
      suppressNearBottomCheckRef.current = false;
    }, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [activeId, messages.length, scrollToBottom]);

  useEffect(() => {
    const container = scrollRef.current;
    const inner = container?.querySelector(".direct-chat-messages");
    if (!container || !inner) return;
    const ro = new ResizeObserver(() => {
      if (nearBottomRef.current) scrollToBottom("auto");
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [activeId, scrollToBottom]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setPeerLastReadAt(null);
      lastSyncedAtRef.current = "";
      return;
    }
    setLoadingThread(true);
    lastSyncedAtRef.current = "";
    nearBottomRef.current = true;
    void (async () => {
      await pollMessages();
      setLoadingThread(false);
      scrollToBottom("auto");
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
    setStartingUserId(userId);
    startTransition(async () => {
      try {
        const { conversationId } = await getOrCreateDirectConversation(userId);
        setNewChatOpen(false);
        setUserQuery("");
        await pollInbox();
        openConversation(conversationId);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memulai percakapan."));
      } finally {
        setStartingUserId(null);
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

  function onPickFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    setPendingFiles((prev) => mergePendingChatFiles(prev, incoming));
  }

  function onComposerPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (editingMessage || pending) return;
    const images = readClipboardImageFiles(e.clipboardData);
    if (images.length === 0) return;
    e.preventDefault();
    onPickFiles(images);
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
          scheduleComposerFocus();
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
        scheduleComposerFocus();
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
      <div className="border-border/70 bg-card/95 flex h-full min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        {/* Inbox */}
        <aside
          className={cn(
            "border-border/70 flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-r md:w-[300px] lg:w-[340px]",
            activeId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="border-border/70 bg-card/95 shrink-0 space-y-3 border-b p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">Inbox</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {totalUnread > 0
                    ? `${totalUnread} pesan belum dibaca`
                    : "Semua percakapan terbaca"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 rounded-full px-3"
                onClick={() => setNewChatOpen(true)}
              >
                Pesan baru
              </Button>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-3.5" />
              <Input
                value={inboxQuery}
                onChange={(e) => setInboxQuery(e.target.value)}
                placeholder="Cari nama atau email…"
                className="h-9 rounded-full bg-background/70 pl-8 pr-8 text-sm"
              />
              {inboxQuery ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute top-2 right-2 inline-flex size-5 items-center justify-center rounded-full"
                  onClick={() => setInboxQuery("")}
                  aria-label="Hapus pencarian"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="bg-muted/50 flex rounded-full p-1 text-xs font-medium">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 transition-colors",
                  inboxFilter === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setInboxFilter("all")}
              >
                Semua
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 transition-colors",
                  inboxFilter === "unread"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setInboxFilter("unread")}
              >
                Belum dibaca{unreadConversationCount > 0 ? ` (${unreadConversationCount})` : ""}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {filteredInbox.length === 0 ? (
              <div className="text-muted-foreground flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-5 text-center text-sm">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                  <MessageCircle className="size-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <p className="text-foreground font-medium">
                    {inbox.length === 0
                      ? "Belum ada percakapan"
                      : inboxFilter === "unread"
                        ? "Tidak ada pesan belum dibaca"
                        : "Percakapan tidak ditemukan"}
                  </p>
                  <p className="text-xs leading-relaxed">
                    {inbox.length === 0
                      ? "Mulai percakapan pribadi dengan anggota tim yang tersedia."
                      : inboxFilter === "unread"
                        ? "Semua pesan sudah terbaca. Ubah filter untuk melihat semua percakapan."
                        : "Coba kata kunci lain atau mulai pesan baru."}
                  </p>
                </div>
                {inbox.length === 0 ? (
                  <Button type="button" size="sm" onClick={() => setNewChatOpen(true)}>
                    Mulai pesan baru
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredInbox.map((item) => {
                  const active = item.conversationId === activeId;
                  const online = isOnline(item.otherUser.lastSeenAt);
                  const unread = item.unreadCount > 0;
                  return (
                    <li key={item.conversationId}>
                      <button
                        type="button"
                        onClick={() => openConversation(item.conversationId)}
                        className={cn(
                          "group hover:bg-muted/60 flex w-full gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors",
                          active && "border-primary/25 bg-primary/10 shadow-sm",
                          unread && !active && "bg-primary/5",
                        )}
                      >
                        <div className="relative shrink-0">
                          {item.otherUser.image ? (
                            <Image
                              src={item.otherUser.image}
                              alt=""
                              width={44}
                              height={44}
                              className="border-border size-11 rounded-full border object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="border-border bg-accent/40 text-accent-foreground flex size-11 items-center justify-center rounded-full border text-sm font-semibold">
                              {authorInitial(
                                item.otherUser.name,
                                item.otherUser.email,
                              )}
                            </div>
                          )}
                          {online ? (
                            <span
                              className="border-background absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-emerald-500"
                              aria-label="Online"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                unread ? "font-bold" : "font-semibold",
                              )}
                            >
                              {authorLabel(
                                item.otherUser.name,
                                item.otherUser.email,
                              )}
                            </span>
                            {item.lastMessage ? (
                              <time
                                className={cn(
                                  "shrink-0 text-[10px] tabular-nums",
                                  unread ? "text-primary font-semibold" : "text-muted-foreground",
                                )}
                              >
                                {formatTime(item.lastMessage.createdAt)}
                              </time>
                            ) : null}
                          </div>
                          <p
                            className={cn(
                              "mt-0.5 truncate text-xs",
                              unread ? "text-foreground font-medium" : "text-muted-foreground",
                            )}
                          >
                            {previewText(
                              item.lastMessage,
                              item.lastMessage?.authorId ?? "",
                              currentUserId,
                            )}
                          </p>
                          <p className="text-muted-foreground mt-1 text-[10px]">
                            {online ? "Online" : "Pesan pribadi"}
                          </p>
                        </div>
                        {unread ? (
                          <span className="bg-primary text-primary-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums shadow-sm">
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
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="border-border/70 bg-background/70 max-w-sm rounded-2xl border p-6 shadow-sm">
                <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
                  <MessageCircle className="size-7" aria-hidden />
                </div>
                <h3 className="text-foreground mt-4 text-base font-semibold">
                  Pilih percakapan
                </h3>
                <p className="mt-2 text-xs leading-relaxed">
                  Buka percakapan dari inbox, atau mulai chat pribadi baru dengan anggota tim yang tersedia.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={() => setNewChatOpen(true)}
                >
                  Mulai pesan baru
                </Button>
              </div>
            </div>
          ) : activeItem ? (
            <>
              <header className="border-border/70 bg-card/95 z-10 flex shrink-0 items-center gap-3 border-b px-3 py-3 backdrop-blur-sm sm:px-4">
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
                  <div className="relative shrink-0">
                    {activeItem.otherUser.image ? (
                      <Image
                        src={activeItem.otherUser.image}
                        alt=""
                        width={40}
                        height={40}
                        className="border-border size-10 rounded-full border object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="border-border bg-accent/40 flex size-10 items-center justify-center rounded-full border text-sm font-semibold">
                        {authorInitial(
                          activeItem.otherUser.name,
                          activeItem.otherUser.email,
                        )}
                      </div>
                    )}
                    {isOnline(activeItem.otherUser.lastSeenAt) ? (
                      <span
                        className="border-background absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-emerald-500"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {authorLabel(
                        activeItem.otherUser.name,
                        activeItem.otherUser.email,
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {peerReadSubtitle ?? formatPresence(activeItem.otherUser.lastSeenAt)}
                    </p>
                  </div>
                </Link>
              </header>

              <div
                ref={scrollRef}
                className="bg-muted/15 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
                onScroll={() => {
                  if (suppressNearBottomCheckRef.current) return;
                  const el = scrollRef.current;
                  if (!el) return;
                  nearBottomRef.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
              >
                {loadingThread && messages.length === 0 ? (
                  <div className="text-muted-foreground flex min-h-[200px] items-center justify-center text-sm">
                    Memuat pesan…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[260px] items-center justify-center">
                    <div className="border-border/70 bg-background/70 max-w-sm rounded-2xl border p-5 text-center shadow-sm">
                      <p className="text-foreground text-sm font-semibold">
                        Mulai percakapan dengan {authorLabel(activeItem.otherUser.name, activeItem.otherUser.email)}
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                        Belum ada pesan di percakapan ini. Tulis pesan pertama di composer bawah.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-4"
                        onClick={() => taRef.current?.focus()}
                      >
                        Tulis pesan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="direct-chat-messages flex flex-col">
                    {messageItems.map((item) => {
                      if (item.type === "date") {
                        return (
                          <div key={item.id} className="my-4 flex items-center gap-3">
                            <span className="bg-border h-px flex-1" />
                            <span className="border-border bg-background text-muted-foreground rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm">
                              {item.label}
                            </span>
                            <span className="bg-border h-px flex-1" />
                          </div>
                        );
                      }
                      const m = item.message;
                      return (
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
                            compact={item.compact}
                          />
                        </div>
                      );
                    })}
                    <div ref={endRef} aria-hidden />
                  </div>
                )}
              </div>

              <div className="border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/90 sticky bottom-0 z-20 shrink-0 space-y-2 border-t p-2.5 shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-3 dark:shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.45)]">
                <DirectChatPushSetup className="mb-0.5 rounded-xl" />
                {editingMessage ? (
                  <div className="border-primary/25 bg-primary/10 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs">
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
                  <div className="border-border bg-muted/60 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs">
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
                  <div className="border-border bg-muted/60 flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingGifUrl}
                        alt=""
                        className="border-border size-12 shrink-0 rounded-lg border object-cover"
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
                  <ul className="border-border bg-muted/40 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border p-2 text-xs">
                    {pendingFiles.map((f, idx) => (
                      <li
                        key={`${f.name}-${idx}`}
                        className="bg-background/80 flex max-w-full items-center justify-between gap-2 rounded-full border px-2 py-1"
                      >
                        <span className="max-w-[12rem] truncate">{f.name}</span>
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
                  disabled={pending || Boolean(editingMessage)}
                  onChange={(e) => {
                    const input = e.target;
                    /** `FileList` hidup: reset `value` mengosongkan `files` — salin dulu. */
                    const picked = input.files?.length ? Array.from(input.files) : [];
                    input.value = "";
                    onPickFiles(picked);
                  }}
                />
                <div className="border-border bg-background focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-2xl border transition-[border-color,box-shadow] focus-within:ring-3">
                  <Textarea
                    ref={taRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onPaste={onComposerPaste}
                    placeholder={editingMessage ? "Edit teks pesan…" : "Tulis pesan…"}
                    rows={1}
                    disabled={pending}
                    className="max-h-40 min-h-12 resize-none rounded-none border-0 bg-transparent px-3 pt-3 pb-1 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
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
                  <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    {!editingMessage ? (
                      <div className="flex items-center gap-0.5">
                        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                          <PopoverTrigger
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon-sm" }),
                              "text-muted-foreground hover:text-foreground",
                              pending && "pointer-events-none opacity-50",
                            )}
                            disabled={pending}
                            aria-label="Pilih emoji"
                            title="Emoji"
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
                        <Popover open={gifOpen} onOpenChange={setGifOpen}>
                          <PopoverTrigger
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon-sm" }),
                              "text-muted-foreground hover:text-foreground",
                              pending && "pointer-events-none opacity-50",
                            )}
                            disabled={pending}
                            aria-label="Tambah GIF"
                            title="GIF"
                          >
                            <Clapperboard className="size-4" />
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
                                      className="border-border overflow-hidden rounded-md border"
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
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          disabled={
                            pending ||
                            pendingFiles.length >= DIRECT_CHAT_MAX_FILES_PER_MESSAGE
                          }
                          onClick={() => fileInputRef.current?.click()}
                          aria-label="Lampirkan file"
                          title="Lampirkan file"
                        >
                          <Paperclip className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground px-1 text-xs">
                        Mode edit: hanya teks pesan.
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground hidden text-[10px] sm:inline">
                        Enter kirim · Shift+Enter baris baru
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0 gap-1.5 rounded-full px-3"
                        disabled={pending || !canSend}
                        onMouseDown={preventComposerBlur}
                        onClick={submitMessage}
                      >
                        {!editingMessage ? <Send className="size-4" aria-hidden /> : null}
                        {pending ? "…" : editingMessage ? "Simpan" : "Kirim"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md gap-3">
          <DialogHeader>
            <DialogTitle>Pesan baru</DialogTitle>
            <DialogDescription>
              Cari anggota tim yang punya akses pesan pribadi, lalu pilih untuk membuka percakapan 1:1.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-3.5" />
            <Input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Cari nama atau email…"
              className="rounded-full pl-8 pr-8"
            />
            {userQuery ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1.5 right-2 inline-flex size-5 items-center justify-center rounded-full"
                onClick={() => setUserQuery("")}
                aria-label="Hapus pencarian pengguna"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          {filteredUsers.length === 0 ? (
            <div className="text-muted-foreground rounded-xl border border-dashed p-5 text-center text-sm">
              <p className="text-foreground font-medium">
                {eligibleUsers.length === 0
                  ? "Belum ada pengguna tersedia"
                  : "Pengguna tidak ditemukan"}
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                {eligibleUsers.length === 0
                  ? "Tidak ada anggota tim lain yang bisa dikirimi pesan saat ini."
                  : "Coba cari dengan nama atau email lain."}
              </p>
            </div>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const online = isOnline(typeof u.lastSeenAt === "string" ? u.lastSeenAt : u.lastSeenAt?.toISOString() ?? null);
                const starting = startingUserId === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors disabled:cursor-wait disabled:opacity-70"
                      disabled={pending}
                      onClick={() => startChatWithUser(u.id)}
                    >
                      <div className="relative shrink-0">
                        {u.image ? (
                          <Image
                            src={u.image}
                            alt=""
                            width={36}
                            height={36}
                            className="border-border size-9 rounded-full border object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="border-border bg-muted flex size-9 items-center justify-center rounded-full border text-xs font-semibold">
                            {authorInitial(u.name, u.email)}
                          </div>
                        )}
                        {online ? (
                          <span
                            className="border-background absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 bg-emerald-500"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {authorLabel(u.name, u.email)}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                        <p className="text-muted-foreground mt-0.5 text-[10px]">
                          {formatPresence(u.lastSeenAt)}
                        </p>
                      </div>
                      {starting ? (
                        <span className="text-muted-foreground text-xs">Membuka…</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
