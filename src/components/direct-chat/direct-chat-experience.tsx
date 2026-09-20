"use client";

import { actionErrorMessage } from "@/lib/action-error-message";
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
import { isDirectChatImageMime } from "@/lib/direct-chat-attachments-shared";
import {
  directChatAuthorLabel,
  formatDirectChatPresence,
  isDirectChatUserOnline,
} from "@/lib/direct-chat-format";
import { directChatReplySnippet } from "@/lib/direct-chat-reply-snippet";
import { toast } from "sonner";
import {
  DirectChatArchivePanel,
  type DirectChatArchiveTab,
} from "@/components/direct-chat/direct-chat-archive-panel";
import { DirectChatAvatar } from "@/components/direct-chat/direct-chat-avatar";
import {
  addFilesToDirectChatComposer,
  DirectChatComposer,
  focusDirectChatComposer,
  type DirectChatComposerPayload,
} from "@/components/direct-chat/direct-chat-composer";
import { DirectChatInbox } from "@/components/direct-chat/direct-chat-inbox";
import {
  DirectChatLightbox,
  type DirectChatLightboxImage,
  type DirectChatLightboxState,
} from "@/components/direct-chat/direct-chat-lightbox";
import {
  DirectChatMessageList,
  DIRECT_CHAT_WINDOW_SIZE,
  DIRECT_CHAT_WINDOW_STEP,
} from "@/components/direct-chat/direct-chat-message-list";
import { DirectChatThreadHeader } from "@/components/direct-chat/direct-chat-thread-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ArrowDown, Paperclip, Search, X } from "lucide-react";

type EligibleUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  lastSeenAt: Date | string | null;
};

/** Di bawah lebar ini arsip tampil sebagai sheet, bukan kolom ketiga. */
const WIDE_LAYOUT_QUERY = "(min-width: 1280px)";

function useWideLayout() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(WIDE_LAYOUT_QUERY);
    const onChange = () => setWide(mql.matches);
    mql.addEventListener("change", onChange);
    queueMicrotask(onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return wide;
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
  let maxMs = 0;
  for (const m of list) {
    const ms = messageActivityMs(m);
    if (ms > maxMs) maxMs = ms;
  }
  const prevMs = ref.current ? new Date(ref.current).getTime() : 0;
  if (maxMs > prevMs) ref.current = new Date(maxMs).toISOString();
}

/** Tanda tangan ringkas inbox — dipakai agar poll 5 detik tidak memicu render ulang sia-sia. */
function inboxSignature(items: DirectInboxItem[]): string {
  return items
    .map(
      (i) =>
        `${i.conversationId}:${i.unreadCount}:${i.updatedAt}:${i.lastMessage?.createdAt ?? ""}:${i.otherUser.lastSeenAt ?? ""}`,
    )
    .join("|");
}

/** Pesan lawan bicara tertua di antara `unreadCount` pesan belum dibaca terakhir. */
function findUnreadAnchorId(
  list: DirectChatMessageView[],
  currentUserId: string,
  unreadCount: number,
): string | null {
  if (unreadCount <= 0) return null;
  let anchor: string | null = null;
  let seen = 0;
  for (let i = list.length - 1; i >= 0 && seen < unreadCount; i--) {
    const m = list[i]!;
    if (m.author.id === currentUserId || m.deletedAt) continue;
    anchor = m.id;
    seen++;
  }
  return anchor;
}

function dragHasFiles(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
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
  const isWide = useWideLayout();

  const [inbox, setInbox] = useState(initialInbox);
  const [messages, setMessages] = useState<DirectChatMessageView[]>([]);
  const [windowSize, setWindowSize] = useState(DIRECT_CHAT_WINDOW_SIZE);
  /** Server masih menyimpan riwayat lebih lama dari yang sudah diambil. */
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reply, setReply] = useState<{
    id: string;
    authorLabel: string;
    snippet: string;
  } | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingThread, setLoadingThread] = useState(false);

  /** Arsip percakapan (cari / media / file / tautan); `null` = tertutup. */
  const [archiveTab, setArchiveTab] = useState<DirectChatArchiveTab | null>(null);
  const [searchFocusToken, setSearchFocusToken] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  /** Pesan lawan bicara yang masuk selagi pengguna membaca riwayat di atas. */
  const [newBelowCount, setNewBelowCount] = useState(0);
  const [lightbox, setLightbox] = useState<DirectChatLightboxState | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSyncedAtRef = useRef<string>("");
  const nearBottomRef = useRef(true);
  const awayFromBottomRef = useRef(false);
  const suppressNearBottomCheckRef = useRef(true);
  const shouldScrollToEndRef = useRef(true);
  const messagesRef = useRef<DirectChatMessageView[]>(messages);
  const windowSizeRef = useRef(windowSize);
  const inboxRef = useRef(inbox);
  const activeIdRef = useRef(activeId);
  const isWideRef = useRef(isWide);
  const inboxSignatureRef = useRef(inboxSignature(initialInbox));
  const olderAnchorRef = useRef<{ height: number; top: number } | null>(null);
  /** Jumlah belum dibaca saat percakapan dibuka — dipakai sekali untuk pembatas "Pesan baru". */
  const pendingUnreadRef = useRef(0);
  const highlightTimerRef = useRef<number | null>(null);
  const jumpingRef = useRef(false);
  const dragDepthRef = useRef(0);

  /** Cermin state untuk dibaca handler tanpa membuat ulang callback tiap poll. */
  useEffect(() => {
    messagesRef.current = messages;
    windowSizeRef.current = windowSize;
    inboxRef.current = inbox;
    activeIdRef.current = activeId;
    isWideRef.current = isWide;
  }, [messages, windowSize, inbox, activeId, isWide]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    },
    [],
  );

  /** Reset state per-percakapan tiap ganti percakapan — disesuaikan saat render agar tidak berantai. */
  const [windowedConversationId, setWindowedConversationId] = useState(activeId);
  if (windowedConversationId !== activeId) {
    setWindowedConversationId(activeId);
    setMessages([]);
    setWindowSize(DIRECT_CHAT_WINDOW_SIZE);
    setHasMoreOlder(false);
    setLoadingOlder(false);
    setPeerLastReadAt(null);
    setReply(null);
    setEditingMessage(null);
    setHighlightId(null);
    setUnreadAnchorId(null);
    setAwayFromBottom(false);
    setNewBelowCount(0);
    setLightbox(null);
  }

  const activeItem = useMemo(
    () => inbox.find((i) => i.conversationId === activeId) ?? null,
    [inbox, activeId],
  );

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return eligibleUsers;
    return eligibleUsers.filter((u) => {
      const name = (u.name ?? u.email).toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [eligibleUsers, userQuery]);

  /**
   * Jendela render: hanya pesan terbaru yang masuk DOM. Riwayat panjang tidak
   * lagi menambah ribuan node yang harus di-layout ulang tiap kali composer
   * berubah tinggi atau ada pesan baru.
   */
  const visibleMessages = useMemo(
    () =>
      messages.length > windowSize ? messages.slice(-windowSize) : messages,
    [messages, windowSize],
  );
  const hiddenCount = messages.length - visibleMessages.length;

  const lastOwnMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.author.id === currentUserId && !m.deletedAt) return m;
    }
    return null;
  }, [messages, currentUserId]);

  /**
   * Status baca dihitung di sini menjadi dua nilai primitif, bukan dilempar
   * sebagai `peerLastReadAt` mentah ke daftar pesan — supaya poll yang
   * mengembalikan waktu baca berbeda tapi status sama tidak me-render ulang
   * seluruh riwayat.
   */
  const readReceiptState = useMemo<"read" | "unread" | null>(() => {
    if (!lastOwnMessage) return null;
    if (!peerLastReadAt) return "unread";
    return new Date(lastOwnMessage.createdAt).getTime() <=
      new Date(peerLastReadAt).getTime()
      ? "read"
      : "unread";
  }, [lastOwnMessage, peerLastReadAt]);

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
      const signature = inboxSignature(data.inbox);
      if (signature === inboxSignatureRef.current) return;
      inboxSignatureRef.current = signature;
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
        hasMore?: boolean;
        peerLastReadAt?: string | null;
        mode: "delta" | "initial";
      };
      if (activeIdRef.current !== activeId) return;
      if (typeof data.peerLastReadAt !== "undefined") {
        setPeerLastReadAt(data.peerLastReadAt);
      }
      if (data.mode === "initial") {
        const unread = pendingUnreadRef.current;
        pendingUnreadRef.current = 0;
        if (unread > 0) {
          setUnreadAnchorId(
            findUnreadAnchorId(data.messages, currentUserId, unread),
          );
        }
        setHasMoreOlder(Boolean(data.hasMore));
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
        if (!nearBottomRef.current) {
          const known = new Set(messagesRef.current.map((m) => m.id));
          const fresh = data.messages.filter(
            (m) =>
              m.author.id !== currentUserId && !m.deletedAt && !known.has(m.id),
          ).length;
          if (fresh > 0) setNewBelowCount((n) => n + fresh);
        }
        setMessages((prev) => mergeMessageLists(prev, data.messages));
        syncLastActivityRef(lastSyncedAtRef, data.messages);
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
    awayFromBottomRef.current = false;
    suppressNearBottomCheckRef.current = true;
    olderAnchorRef.current = null;
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

  /** Pertahankan posisi baca setelah pesan lama disisipkan di atas. */
  useLayoutEffect(() => {
    const anchor = olderAnchorRef.current;
    if (!anchor) return;
    olderAnchorRef.current = null;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = anchor.top + (el.scrollHeight - anchor.height);
  }, [windowSize, messages]);

  /**
   * Ikuti pesan terbaru setelah React menempelkannya ke DOM.
   *
   * `scrollToBottom()` yang dipanggil langsung di handler kirim/poll berjalan
   * sebelum render, jadi ia hanya menggulir ke dasar daftar yang *lama* —
   * pesan yang baru dikirim tetap di bawah garis pandang.
   */
  const lastMessage = messages.length > 0 ? messages[messages.length - 1]! : null;
  const lastMessageId = lastMessage?.id ?? null;
  const lastMessageOwn = lastMessage?.author.id === currentUserId;
  useLayoutEffect(() => {
    if (!activeId || !lastMessageId) return;
    /** Pesan sendiri selalu ditarik ke bawah; pesan lawan hanya bila sedang di bawah. */
    if (!lastMessageOwn && !nearBottomRef.current) return;
    nearBottomRef.current = true;
    scrollToBottom("auto");
    /** Tinggi bubble baru bisa mengendap satu frame kemudian. */
    const raf = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(raf);
  }, [activeId, lastMessageId, lastMessageOwn, scrollToBottom]);

  const hasMessages = messages.length > 0;
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      if (nearBottomRef.current) scrollToBottom("auto");
    });
    /**
     * Dua sumber pergeseran: isi yang tumbuh (media telat muat) dan area baca
     * yang menyusut (keyboard HP terbuka). Daftar pesan baru ada di DOM setelah
     * pesan termuat, jadi efek ini ikut dijalankan ulang lewat `hasMessages`.
     */
    ro.observe(container);
    const inner = container.querySelector(".direct-chat-messages");
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [activeId, hasMessages, scrollToBottom]);

  useEffect(() => {
    if (!activeId) {
      lastSyncedAtRef.current = "";
      return;
    }
    let cancelled = false;
    lastSyncedAtRef.current = "";
    nearBottomRef.current = true;
    activeIdRef.current = activeId;
    pendingUnreadRef.current =
      inboxRef.current.find((i) => i.conversationId === activeId)?.unreadCount ??
      0;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoadingThread(true);
      await pollMessages();
      if (cancelled) return;
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
      inboxSignatureRef.current = "";
      window.dispatchEvent(new Event("direct-chat-inbox-changed"));
    })();
    const t = window.setInterval(pollMessages, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [activeId, pollMessages, scrollToBottom]);

  const openConversation = useCallback(
    (conversationId: string) => {
      router.replace(`/messages?c=${conversationId}`, { scroll: false });
    },
    [router],
  );

  const backToInbox = useCallback(() => {
    router.replace("/messages", { scroll: false });
  }, [router]);

  const openNewChat = useCallback(() => setNewChatOpen(true), []);

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

  const startReplyTo = useCallback((message: DirectChatMessageView) => {
    if (message.deletedAt) return;
    setEditingMessage(null);
    setReply({
      id: message.id,
      authorLabel: directChatAuthorLabel(message.author.name, message.author.email),
      snippet: directChatReplySnippet({
        body: message.body,
        gifUrl: message.gifUrl,
        attachmentCount: message.attachments.length,
      }),
    });
  }, []);

  const startEdit = useCallback((message: DirectChatMessageView) => {
    if (message.deletedAt) return;
    setReply(null);
    setEditingMessage({ id: message.id, body: message.body });
  }, []);

  const cancelEdit = useCallback(() => setEditingMessage(null), []);
  const cancelReply = useCallback(() => setReply(null), []);

  /**
   * Kunci posisi baca. Dipanggil tepat sebelum state yang menyisipkan riwayat
   * lama di-set — bukan sebelum fetch — supaya poll pesan baru yang kebetulan
   * mendarat di tengah fetch tidak memakai anchor ini duluan.
   */
  const captureScrollAnchor = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      olderAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
    }
  }, []);

  /** Cegah observer/efek menarik tampilan balik ke pesan terbaru. */
  const suppressAutoScrollToEnd = useCallback(() => {
    nearBottomRef.current = false;
    shouldScrollToEndRef.current = false;
  }, []);

  /**
   * Dua tahap: buka dulu pesan yang sudah diambil tapi belum dirender, baru
   * ambil halaman berikutnya dari server. Dengan begitu riwayat bisa
   * ditelusuri sampai pesan pertama tanpa memuat semuanya sekaligus.
   */
  const loadOlderMessages = useCallback(() => {
    const all = messagesRef.current;
    suppressAutoScrollToEnd();

    if (all.length > windowSizeRef.current) {
      captureScrollAnchor();
      setWindowSize((n) => n + DIRECT_CHAT_WINDOW_STEP);
      return;
    }
    const oldest = all[0];
    if (!activeId || !oldest || !hasMoreOlder || loadingOlder) return;

    setLoadingOlder(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/direct-chat/${activeId}/messages?before=${encodeURIComponent(oldest.id)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages: DirectChatMessageView[];
          hasMore?: boolean;
        };
        if (activeIdRef.current !== activeId) return;
        setHasMoreOlder(Boolean(data.hasMore));
        if (data.messages.length > 0) {
          captureScrollAnchor();
          setMessages((prev) => mergeMessageLists(prev, data.messages));
          setWindowSize((n) => n + DIRECT_CHAT_WINDOW_STEP);
        }
      } catch {
        /* abaikan — tombol tetap tersedia untuk dicoba lagi */
      } finally {
        setLoadingOlder(false);
      }
    })();
  }, [
    activeId,
    captureScrollAnchor,
    suppressAutoScrollToEnd,
    hasMoreOlder,
    loadingOlder,
  ]);

  const flashMessage = useCallback((messageId: string) => {
    setHighlightId(messageId);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(
      () => setHighlightId(null),
      2200,
    );
  }, []);

  /**
   * Lompat ke pesan mana pun di riwayat — dari kutipan balasan, hasil cari,
   * atau arsip. Tiga kemungkinan: sudah di DOM; sudah diambil tapi di luar
   * jendela render; atau belum pernah diambil (minta rentangnya ke server).
   */
  const scrollToMessage = useCallback(
    async (messageId: string) => {
      const container = scrollRef.current;
      if (!container) return;
      const focus = (behavior: ScrollBehavior) => {
        const el = container.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(messageId)}"]`,
        );
        el?.scrollIntoView({ behavior, block: "center" });
        return Boolean(el);
      };

      suppressAutoScrollToEnd();
      if (focus("smooth")) {
        flashMessage(messageId);
        return;
      }

      let all = messagesRef.current;
      let index = all.findIndex((m) => m.id === messageId);

      if (index < 0) {
        if (!activeId || jumpingRef.current) return;
        jumpingRef.current = true;
        const toastId = toast.loading("Membuka pesan lama…");
        try {
          const oldest = all[0];
          const res = await fetch(
            `/api/direct-chat/${activeId}/messages?until=${encodeURIComponent(messageId)}${
              oldest ? `&before=${encodeURIComponent(oldest.id)}` : ""
            }`,
            { credentials: "include" },
          );
          if (!res.ok) {
            toast.error(
              "Pesan itu terlalu jauh di riwayat atau sudah tidak ada.",
              { id: toastId },
            );
            return;
          }
          const data = (await res.json()) as {
            messages: DirectChatMessageView[];
            hasMore?: boolean;
          };
          if (activeIdRef.current !== activeId) {
            toast.dismiss(toastId);
            return;
          }
          all = mergeMessageLists(messagesRef.current, data.messages);
          messagesRef.current = all;
          setHasMoreOlder(Boolean(data.hasMore));
          setMessages(all);
          toast.dismiss(toastId);
          index = all.findIndex((m) => m.id === messageId);
        } catch {
          toast.error("Gagal membuka pesan. Coba lagi.", { id: toastId });
          return;
        } finally {
          jumpingRef.current = false;
        }
      }
      if (index < 0) return;

      /** Target masih di luar jendela render — lebarkan dulu, baru lompat. */
      const needed = all.length - index + 5;
      setWindowSize((n) => Math.max(n, needed));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!focus("auto")) return;
          flashMessage(messageId);
          /** Tinggi asli bubble baru diketahui setelah dirender — koreksi sekali. */
          window.setTimeout(() => focus("auto"), 140);
        }),
      );
    },
    [activeId, flashMessage, suppressAutoScrollToEnd],
  );

  const scrollToReply = useCallback(
    (messageId: string) => void scrollToMessage(messageId),
    [scrollToMessage],
  );

  /** Lompatan dari arsip / lightbox: singkirkan dulu lapisan yang menutupi chat. */
  const jumpFromOverlay = useCallback(
    (messageId: string) => {
      setLightbox(null);
      if (!isWideRef.current) setArchiveTab(null);
      void scrollToMessage(messageId);
    },
    [scrollToMessage],
  );

  const jumpToLatest = useCallback(() => {
    nearBottomRef.current = true;
    awayFromBottomRef.current = false;
    setAwayFromBottom(false);
    setNewBelowCount(0);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  const openThreadImage = useCallback((attachmentId: string) => {
    const images: DirectChatLightboxImage[] = messagesRef.current.flatMap((m) =>
      m.attachments
        .filter((a) => isDirectChatImageMime(a.mimeType))
        .map((a) => ({
          id: a.id,
          src: a.publicPath,
          fileName: a.fileName,
          messageId: m.id,
        })),
    );
    const index = images.findIndex((img) => img.id === attachmentId);
    if (index >= 0) setLightbox({ images, index });
  }, []);

  const openArchiveImages = useCallback(
    (images: DirectChatLightboxImage[], index: number) =>
      setLightbox({ images, index }),
    [],
  );

  const setLightboxIndex = useCallback(
    (index: number) => setLightbox((prev) => (prev ? { ...prev, index } : prev)),
    [],
  );
  const closeLightbox = useCallback(() => setLightbox(null), []);

  const openSearch = useCallback(() => {
    setArchiveTab("search");
    setSearchFocusToken((n) => n + 1);
  }, []);

  const toggleSearch = useCallback(() => {
    if (archiveTab === "search") setArchiveTab(null);
    else openSearch();
  }, [archiveTab, openSearch]);

  const toggleArchive = useCallback(() => {
    setArchiveTab((tab) => (tab && tab !== "search" ? null : "media"));
  }, []);

  const closeArchive = useCallback(() => setArchiveTab(null), []);

  /** Ctrl/⌘+F mencari di percakapan yang sedang dibuka, bukan di halaman. */
  useEffect(() => {
    if (!activeId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, openSearch]);

  const handleComposerSubmit = useCallback(
    (payload: DirectChatComposerPayload) =>
      new Promise<boolean>((resolve) => {
        if (!activeId) {
          resolve(false);
          return;
        }
        startTransition(async () => {
          try {
            if (payload.editingMessageId) {
              const updated = await editDirectMessage({
                messageId: payload.editingMessageId,
                body: payload.body,
              });
              setEditingMessage(null);
              setMessages((prev) => mergeMessageLists(prev, [updated]));
              syncLastActivityRef(lastSyncedAtRef, [updated]);
              resolve(true);
              return;
            }

            let created: DirectChatMessageView;
            if (payload.files.length > 0) {
              const fd = new FormData();
              fd.append("conversationId", activeId);
              fd.append("body", payload.body);
              if (payload.gifUrl) fd.append("gifUrl", payload.gifUrl);
              if (payload.replyToId) fd.append("replyToId", payload.replyToId);
              for (const f of payload.files) fd.append("files", f);
              created = await sendDirectMessageForm(fd);
            } else {
              created = await sendDirectMessage({
                conversationId: activeId,
                body: payload.body,
                gifUrl: payload.gifUrl ?? undefined,
                replyToId: payload.replyToId ?? undefined,
              });
            }

            setReply(null);
            /** Membalas berarti semua pesan di atasnya sudah terbaca. */
            setUnreadAnchorId(null);
            setNewBelowCount(0);
            nearBottomRef.current = true;
            setMessages((prev) => mergeMessageLists(prev, [created]));
            syncLastActivityRef(lastSyncedAtRef, [created]);
            void pollInbox();
            window.dispatchEvent(new Event("direct-chat-inbox-changed"));
            resolve(true);
          } catch (e) {
            toast.error(
              actionErrorMessage(
                e,
                payload.editingMessageId
                  ? "Gagal mengedit pesan."
                  : "Gagal mengirim.",
              ),
            );
            resolve(false);
          }
        });
      }),
    [activeId, pollInbox],
  );

  const confirmDeleteMessage = useCallback(
    (messageId: string) => {
      if (!window.confirm("Hapus pesan ini? Tindakan tidak dapat dibatalkan.")) {
        return;
      }
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
          setEditingMessage((current) =>
            current?.id === messageId ? null : current,
          );
        } catch (e) {
          toast.error(actionErrorMessage(e, "Gagal menghapus pesan."));
        }
      });
    },
    [],
  );

  function onThreadScroll() {
    if (suppressNearBottomCheckRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distance < 80;
    const away = distance > 320;
    if (away !== awayFromBottomRef.current) {
      awayFromBottomRef.current = away;
      setAwayFromBottom(away);
    }
    if (nearBottomRef.current) setNewBelowCount(0);
  }

  const archivePanel = activeItem ? (
    <DirectChatArchivePanel
      key={activeItem.conversationId}
      conversationId={activeItem.conversationId}
      currentUserId={currentUserId}
      peerLabel={directChatAuthorLabel(
        activeItem.otherUser.name,
        activeItem.otherUser.email,
      )}
      tab={archiveTab ?? "media"}
      onTabChange={setArchiveTab}
      onClose={closeArchive}
      onJump={jumpFromOverlay}
      onOpenImages={openArchiveImages}
      refreshToken={lastMessageId}
      searchFocusToken={searchFocusToken}
    />
  ) : null;

  const archiveInline = Boolean(archiveTab) && isWide && Boolean(activeItem);

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="border-border/70 bg-card flex h-full min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        <DirectChatInbox
          inbox={inbox}
          activeId={activeId}
          currentUserId={currentUserId}
          onOpenConversation={openConversation}
          onNewChat={openNewChat}
          className={cn(
            "border-border/70 w-full shrink-0 border-r md:w-[300px]",
            archiveInline ? "lg:w-[300px]" : "lg:w-[340px]",
            activeId ? "hidden md:flex" : "flex",
          )}
        />

        {/* Thread */}
        <section
          className={cn(
            "relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            !activeId ? "hidden md:flex" : "flex",
          )}
          onDragEnter={(e) => {
            if (!activeItem || !dragHasFiles(e)) return;
            dragDepthRef.current += 1;
            setDragActive(true);
          }}
          onDragOver={(e) => {
            if (activeItem && dragHasFiles(e)) e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (!activeItem || !dragHasFiles(e)) return;
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setDragActive(false);
          }}
          onDrop={(e) => {
            if (!activeItem || !dragHasFiles(e)) return;
            e.preventDefault();
            dragDepthRef.current = 0;
            setDragActive(false);
            addFilesToDirectChatComposer(Array.from(e.dataTransfer.files));
          }}
        >
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <h2 className="text-base font-semibold">Pilih percakapan</h2>
              <p className="text-muted-foreground mt-1.5 max-w-[34ch] text-sm leading-relaxed">
                Buka percakapan dari daftar di kiri, atau tulis pesan baru ke
                anggota tim.
              </p>
              <Button type="button" className="mt-5" onClick={openNewChat}>
                Tulis pesan baru
              </Button>
            </div>
          ) : activeItem ? (
            <>
              <DirectChatThreadHeader
                peer={activeItem.otherUser}
                searchOpen={archiveTab === "search"}
                archiveOpen={Boolean(archiveTab) && archiveTab !== "search"}
                onBack={backToInbox}
                onToggleSearch={toggleSearch}
                onToggleArchive={toggleArchive}
              />

              <div className="relative flex min-h-0 flex-1 flex-col">
                <div
                  ref={scrollRef}
                  className="bg-muted/25 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-3 sm:px-3.5"
                  onScroll={onThreadScroll}
                >
                  {loadingThread && messages.length === 0 ? (
                    <div className="text-muted-foreground flex min-h-[200px] items-center justify-center text-sm">
                      Memuat pesan…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                      <DirectChatAvatar
                        name={activeItem.otherUser.name}
                        email={activeItem.otherUser.email}
                        image={activeItem.otherUser.image}
                        size={64}
                      />
                      <p className="mt-4 text-sm font-semibold">
                        Belum ada pesan dengan{" "}
                        {directChatAuthorLabel(
                          activeItem.otherUser.name,
                          activeItem.otherUser.email,
                        )}
                      </p>
                      <p className="text-muted-foreground mt-1 max-w-[34ch] text-xs leading-relaxed">
                        Pesan, file, dan tautan yang kalian kirim akan tersimpan
                        di arsip percakapan ini.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-4"
                        onClick={focusDirectChatComposer}
                      >
                        Tulis pesan pertama
                      </Button>
                    </div>
                  ) : (
                    <DirectChatMessageList
                      messages={visibleMessages}
                      currentUserId={currentUserId}
                      readReceiptMessageId={lastOwnMessage?.id ?? null}
                      readReceiptState={readReceiptState}
                      highlightId={highlightId}
                      unreadAnchorId={unreadAnchorId}
                      hiddenCount={hiddenCount}
                      hasMoreOlder={hasMoreOlder}
                      loadingOlder={loadingOlder}
                      onLoadOlder={loadOlderMessages}
                      onReply={startReplyTo}
                      onEdit={startEdit}
                      onDelete={confirmDeleteMessage}
                      onScrollToReply={scrollToReply}
                      onOpenImage={openThreadImage}
                    />
                  )}
                </div>

                {awayFromBottom || newBelowCount > 0 ? (
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="bg-background text-foreground ring-border hover:bg-muted focus-visible:ring-ring absolute right-4 bottom-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium shadow-md ring-1 outline-none focus-visible:ring-2"
                    aria-label={
                      newBelowCount > 0
                        ? `${newBelowCount} pesan baru, ke pesan terbaru`
                        : "Ke pesan terbaru"
                    }
                  >
                    {newBelowCount > 0 ? (
                      <span className="bg-primary text-primary-foreground -ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums">
                        {newBelowCount > 99 ? "99+" : newBelowCount}
                      </span>
                    ) : null}
                    {newBelowCount > 0 ? "Pesan baru" : null}
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>

              <DirectChatComposer
                pending={pending}
                reply={reply}
                editing={editingMessage}
                onCancelReply={cancelReply}
                onCancelEdit={cancelEdit}
                onSubmit={handleComposerSubmit}
              />

              {dragActive ? (
                <div className="border-primary bg-background/90 pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center">
                  <Paperclip className="size-6" aria-hidden />
                  <p className="text-sm font-semibold">Lepas untuk melampirkan</p>
                  <p className="text-muted-foreground text-xs">
                    File masuk ke kolom pesan dan baru terkirim setelah Anda
                    menekan Kirim.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              Membuka percakapan…
            </div>
          )}
        </section>

        {archiveInline ? (
          <aside className="border-border/70 h-full w-[340px] shrink-0 border-l">
            {archivePanel}
          </aside>
        ) : null}
      </div>

      <Sheet
        open={Boolean(archiveTab) && !isWide && Boolean(activeItem)}
        onOpenChange={(open) => {
          if (!open) setArchiveTab(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetTitle className="sr-only">Arsip percakapan</SheetTitle>
          {archivePanel}
        </SheetContent>
      </Sheet>

      <DirectChatLightbox
        state={lightbox}
        onIndexChange={setLightboxIndex}
        onClose={closeLightbox}
        onShowInChat={jumpFromOverlay}
      />

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md gap-3">
          <DialogHeader>
            <DialogTitle>Pesan baru</DialogTitle>
            <DialogDescription>
              Pilih anggota tim untuk membuka percakapan berdua.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-3.5" />
            <Input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Cari nama atau email…"
              aria-label="Cari anggota tim"
              className="rounded-full pr-8 pl-8.5"
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
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {eligibleUsers.length === 0
                  ? "Belum ada anggota tim yang bisa dikirimi pesan"
                  : "Tidak ada yang cocok"}
              </p>
              {eligibleUsers.length > 0 ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Coba nama atau email lain.
                </p>
              ) : null}
            </div>
          ) : (
            <ul className="-mx-1 max-h-80 space-y-0.5 overflow-y-auto px-1">
              {filteredUsers.map((u) => {
                const lastSeenIso =
                  typeof u.lastSeenAt === "string"
                    ? u.lastSeenAt
                    : (u.lastSeenAt?.toISOString() ?? null);
                const starting = startingUserId === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors focus-visible:ring-3 disabled:cursor-wait disabled:opacity-70"
                      disabled={pending}
                      onClick={() => startChatWithUser(u.id)}
                    >
                      <DirectChatAvatar
                        name={u.name}
                        email={u.email}
                        image={u.image}
                        size={38}
                        online={isDirectChatUserOnline(lastSeenIso)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {directChatAuthorLabel(u.name, u.email)}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {starting
                            ? "Membuka percakapan…"
                            : formatDirectChatPresence(u.lastSeenAt)}
                        </p>
                      </div>
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
