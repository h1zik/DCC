"use client";
import { actionErrorMessage } from "@/lib/action-error-message";
import { CREATIVE_ACCEPT_EXTENSIONS } from "@/lib/creative-file-formats";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { addRoomMessage, addRoomMessageForm, deleteRoomMessage, editRoomMessage } from "@/actions/room-messages";
import { ChatLinkifiedText } from "@/components/chat-linkified-text";
import {
  mergePendingChatFiles,
  readClipboardImageFiles,
} from "@/lib/chat-pending-files";
import {
  preventComposerBlur,
  useChatComposerFocus,
} from "@/lib/use-chat-composer-focus";
import {
  DIRECT_CHAT_MAX_FILES_PER_MESSAGE,
  isDirectChatImageMime,
} from "@/lib/direct-chat-attachments-shared";
import type { RoomChatMessageView } from "@/lib/room-chat-message-view";
import {
  mergeRoomMessageLists,
  roomMessageActivityMs,
} from "@/lib/room-chat-message-view";
import { assertSafeGifUrl } from "@/lib/room-chat-gif";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Clapperboard,
  Download,
  FileText,
  MessagesSquare,
  Paperclip,
  Pencil,
  Reply,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Theme } from "emoji-picker-react";

const EmojiPicker = dynamic(
  () => import("emoji-picker-react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex h-[360px] w-[352px] items-center justify-center text-sm">
        Memuat emoji…
      </div>
    ),
  },
);

function authorInitial(name: string | null, email: string) {
  const s = (name?.trim() || email).trim();
  return s.slice(0, 1).toUpperCase() || "?";
}

function authorLabel(name: string | null, email: string) {
  return name?.trim() || email;
}

function replySnippet(msg: {
  body: string;
  gifUrl: string | null;
  deletedAt?: string | null;
  attachmentCount?: number;
}): string {
  if (msg.deletedAt) return "Pesan dihapus";
  const t = msg.body.trim();
  const att = msg.attachmentCount ?? 0;
  if (att > 0 && !t && !msg.gifUrl) {
    return att === 1 ? "Lampiran" : `${att} lampiran`;
  }
  if (msg.gifUrl && t) {
    const cut = t.length > 72 ? `${t.slice(0, 72)}…` : t;
    return `${cut} · GIF`;
  }
  if (msg.gifUrl) return "GIF";
  if (!t && att > 0) {
    return att === 1 ? "Lampiran" : `${att} lampiran`;
  }
  if (!t) return "(tanpa teks)";
  const suffix = att > 0 ? ` · ${att} lampiran` : "";
  const text = t.length > 120 ? `${t.slice(0, 120)}…` : t;
  return `${text}${suffix}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Kelompokkan pesan beruntun dari author yang sama dalam jendela ini. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** Label pembatas tanggal: Hari ini / Kemarin / tanggal lengkap. */
function dayDividerLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d.toISOString(), today.toISOString())) return "Hari ini";
  if (isSameDay(d.toISOString(), yesterday.toISOString())) return "Kemarin";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ReplyTarget = {
  id: string;
  authorLabel: string;
  snippet: string;
};

type MentionableUser = {
  id: string;
  name: string | null;
  email: string;
};

type MentionDraft = {
  start: number;
  end: number;
  query: string;
};

function mentionTokenOf(user: MentionableUser): string {
  const source = user.name?.trim() || user.email.split("@")[0] || user.email;
  return source.replace(/\s+/g, "");
}

function detectMentionDraft(body: string, cursorPos: number): MentionDraft | null {
  const before = body.slice(0, cursorPos);
  const m = before.match(/(^|[\s(])@([a-zA-Z0-9._-]{0,40})$/);
  if (!m) return null;
  const query = m[2] ?? "";
  const start = before.length - query.length - 1;
  if (start < 0) return null;
  return { start, end: cursorPos, query };
}

function insertAtCursor(
  el: HTMLTextAreaElement | null,
  text: string,
  body: string,
  setBody: (s: string) => void,
) {
  if (!el) {
    setBody(body + text);
    return;
  }
  const start = el.selectionStart ?? body.length;
  const end = el.selectionEnd ?? body.length;
  const next = body.slice(0, start) + text + body.slice(end);
  setBody(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const safeBase64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(safeBase64), (c) => c.charCodeAt(0));
}

export function RoomChatExperience({
  roomId,
  channelId,
  currentUserId,
  messages: initialMessages,
  mentionableUsers,
}: {
  roomId: string;
  channelId: string;
  currentUserId: string;
  messages: RoomChatMessageView[];
  mentionableUsers: MentionableUser[];
}) {
  const [messages, setMessages] =
    useState<RoomChatMessageView[]>(initialMessages);
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [pendingGifUrl, setPendingGifUrl] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("happy");
  const [gifItems, setGifItems] = useState<{ url: string; preview: string }[]>(
    [],
  );
  const [gifLoading, setGifLoading] = useState(false);
  const [giphyConfigured, setGiphyConfigured] = useState<boolean | null>(null);
  const [pasteGif, setPasteGif] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pushState, setPushState] = useState<
    "checking" | "ready" | "needs-activation" | "blocked" | "unsupported" | "not-configured"
  >("checking");
  const [mentionDraft, setMentionDraft] = useState<MentionDraft | null>(null);
  const [mentionPickIndex, setMentionPickIndex] = useState(0);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  /** Tombol "ke pesan terbaru" saat user scroll jauh ke atas + hitung pesan baru. */
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scheduleComposerFocus = useChatComposerFocus(taRef, pending);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const suppressNearBottomCheckRef = useRef(true);
  const shouldScrollToEndRef = useRef(true);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const bodyRef = useRef(body);
  const lastTypingPingRef = useRef(0);
  bodyRef.current = body;

  const mentionSuggestions = useMemo(() => {
    if (!mentionDraft) return [];
    const q = mentionDraft.query.trim().toLowerCase();
    const sorted = [...mentionableUsers].sort((a, b) => {
      const an = (a.name?.trim() || a.email).toLowerCase();
      const bn = (b.name?.trim() || b.email).toLowerCase();
      return an.localeCompare(bn);
    });
    const filtered = !q
      ? sorted
      : sorted.filter((u) => {
          const n = (u.name ?? "").toLowerCase();
          const e = u.email.toLowerCase();
          const local = e.split("@")[0] ?? "";
          return n.includes(q) || e.includes(q) || local.includes(q);
        });
    return filtered.slice(0, 8);
  }, [mentionDraft, mentionableUsers]);

  useEffect(() => {
    setMentionPickIndex((prev) => Math.min(prev, Math.max(0, mentionSuggestions.length - 1)));
  }, [mentionSuggestions.length]);

  const syncPushSubscription = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("blocked");
      return;
    }
    const keyRes = await fetch("/api/push/subscription", { credentials: "include" });
    if (!keyRes.ok) {
      setPushState("not-configured");
      return;
    }
    const keyData = (await keyRes.json()) as { configured?: boolean; publicKey?: string };
    if (!keyData.configured || !keyData.publicKey) {
      setPushState("not-configured");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    await registration.update();
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(existing.toJSON()),
      });
      setPushState("ready");
      return;
    }
    setPushState("needs-activation");
  }, []);

  const enablePushNotification = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushState("unsupported");
      toast.error("Browser ini belum mendukung push notification.");
      return;
    }
    try {
      const keyRes = await fetch("/api/push/subscription", { credentials: "include" });
      const keyData = (await keyRes.json()) as { configured?: boolean; publicKey?: string };
      if (!keyRes.ok || !keyData.configured || !keyData.publicKey) {
        setPushState("not-configured");
        toast.error("Push notification belum dikonfigurasi di server.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("blocked");
        toast.error("Izin notifikasi belum diberikan.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await registration.update();
      const serverKey = urlBase64ToUint8Array(keyData.publicKey);
      const currentSub = await registration.pushManager.getSubscription();
      if (currentSub) {
        await currentSub.unsubscribe();
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverKey,
      });
      await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setPushState("ready");
      toast.success("Push notification chat aktif.");
    } catch {
      setPushState("needs-activation");
      toast.error("Gagal mengaktifkan push notification.");
    }
  }, []);

  useEffect(() => {
    void syncPushSubscription();
  }, [syncPushSubscription]);

  const scrollToMessage = useCallback((id: string) => {
    const el = messageRefs.current.get(id);
    const container = scrollRef.current;
    if (!el || !container) return;
    const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

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

  const onScrollList = useCallback(() => {
    if (suppressNearBottomCheckRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = gap < 120;
    setShowJumpToLatest(gap > 200);
    if (gap < 120) setUnseenCount(0);
  }, []);

  useLayoutEffect(() => {
    shouldScrollToEndRef.current = true;
    nearBottomRef.current = true;
  }, [roomId]);

  /** Saat buka chat: paksa scroll ke pesan terbaru (beberapa frame untuk layout/media). */
  useLayoutEffect(() => {
    if (!shouldScrollToEndRef.current || messages.length === 0) return;
    suppressNearBottomCheckRef.current = true;
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
  }, [roomId, messages.length, scrollToBottom]);

  /** GIF/gambar yang muat belakangan menambah tinggi — tetap di bawah jika user di pesan terbaru. */
  useEffect(() => {
    const container = scrollRef.current;
    const inner = container?.firstElementChild;
    if (!container || !inner) return;
    const ro = new ResizeObserver(() => {
      if (nearBottomRef.current) scrollToBottom("auto");
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [roomId, scrollToBottom]);

  /**
   * Live updates: hanya menarik pesan baru sejak `lastSyncedAtRef`.
   * Server menggunakan index `RoomMessage(roomId, createdAt)` jadi delta
   * empty hanya menyentuh metadata index, bukan men-scan riwayat lengkap.
   */
  const lastSyncedAtRef = useRef<string>(
    initialMessages.length > 0
      ? new Date(
          Math.max(...initialMessages.map(roomMessageActivityMs)),
        ).toISOString()
      : new Date(0).toISOString(),
  );
  /**
   * Apakah baseline awal sudah ada. Saat berpindah channel tanpa pesan
   * pra-muat, fetch pertama harus mode "initial" (tanpa `since`) agar
   * mengambil N pesan TERBARU — bukan delta dari epoch (yang justru menarik
   * pesan tertua pada channel ramai).
   */
  const hasBaselineRef = useRef(initialMessages.length > 0);
  useEffect(() => {
    let cancelled = false;
    async function pull() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const url = new URL(
          `/api/room-chat/${roomId}/messages`,
          window.location.origin,
        );
        url.searchParams.set("channelId", channelId);
        if (hasBaselineRef.current) {
          url.searchParams.set("since", lastSyncedAtRef.current);
        }
        const r = await fetch(url.toString(), { credentials: "include" });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as {
          messages?: RoomChatMessageView[];
          typingUsers?: string[];
          mode?: "initial" | "delta";
        };
        if (!Array.isArray(j.messages) || cancelled) return;
        hasBaselineRef.current = true;
        setTypingUsers(
          Array.isArray(j.typingUsers)
            ? j.typingUsers.filter((x): x is string => typeof x === "string")
            : [],
        );
        const incoming = j.messages;
        if (incoming.length === 0) return;
        const maxActivity = Math.max(...incoming.map(roomMessageActivityMs));
        const prevMs = lastSyncedAtRef.current
          ? new Date(lastSyncedAtRef.current).getTime()
          : 0;
        if (maxActivity > prevMs) {
          lastSyncedAtRef.current = new Date(maxActivity).toISOString();
        }
        setMessages((prev) => mergeRoomMessageLists(prev, incoming));
      } catch {
        /* offline / transient */
      }
    }
    const id = window.setInterval(() => void pull(), 2500);
    void pull();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomId, channelId, initialMessages]);

  useEffect(() => {
    if (!body.trim()) return;
    const id = window.setTimeout(() => {
      const now = Date.now();
      // Batasi ping agar tidak flood saat user mengetik cepat.
      if (now - lastTypingPingRef.current < 1800) return;
      lastTypingPingRef.current = now;
      void fetch(`/api/room-chat/${roomId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ typing: true }),
      }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(id);
  }, [body, roomId]);

  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    const added = messages.length - prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    const last = messages[messages.length - 1];
    const own = last?.author.id === currentUserId;
    if (own || nearBottomRef.current) {
      setUnseenCount(0);
      requestAnimationFrame(() => {
        scrollToBottom(own ? "smooth" : "auto");
      });
    } else if (added > 0 && !shouldScrollToEndRef.current) {
      // User sedang membaca riwayat — tandai ada pesan baru di bawah.
      setUnseenCount((n) => n + added);
    }
  }, [messages, currentUserId, scrollToBottom]);

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

  function onEmojiPick(data: EmojiClickData) {
    insertAtCursor(taRef.current, data.emoji, bodyRef.current, setBody);
    setEmojiOpen(false);
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

  function startReply(m: RoomChatMessageView) {
    if (m.deletedAt) return;
    setReply({
      id: m.id,
      authorLabel: authorLabel(m.author.name, m.author.email),
      snippet: replySnippet({
        body: m.body,
        gifUrl: m.gifUrl,
        deletedAt: m.deletedAt,
        attachmentCount: m.attachments.length,
      }),
    });
    taRef.current?.focus();
  }

  function startEdit(m: RoomChatMessageView) {
    if (m.deletedAt) return;
    setEditingMessage({ id: m.id, body: m.body });
    setBody(m.body);
    setReply(null);
    setPendingGifUrl(null);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    taRef.current?.focus();
  }

  function cancelEdit() {
    setEditingMessage(null);
    setBody("");
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function confirmDeleteMessage(messageId: string) {
    if (!window.confirm("Hapus pesan ini? Tindakan tidak dapat dibatalkan.")) return;
    startTransition(async () => {
      try {
        await deleteRoomMessage(messageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  body: "",
                  gifUrl: null,
                  attachments: [],
                  deletedAt: new Date().toISOString(),
                  editedAt: null,
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

  function submit() {
    const text = body.trim();
    const gif = pendingGifUrl?.trim() ?? "";
    if (pending) return;

    if (editingMessage) {
      if (!text) {
        toast.error("Pesan tidak boleh kosong.");
        return;
      }
      startTransition(async () => {
        try {
          const updated = await editRoomMessage({
            messageId: editingMessage.id,
            body: text,
          });
          setEditingMessage(null);
          setBody("");
          setMessages((prev) => mergeRoomMessageLists(prev, [updated]));
          lastSyncedAtRef.current = new Date(
            roomMessageActivityMs(updated),
          ).toISOString();
          scheduleComposerFocus();
        } catch (e) {
          toast.error(actionErrorMessage(e, "Gagal mengedit pesan."));
        }
      });
      return;
    }

    if ((!text && !gif && pendingFiles.length === 0) || pending) return;
    let gifUrl: string | null = null;
    if (gif) {
      try {
        gifUrl = assertSafeGifUrl(gif);
      } catch (e) {
        toast.error(actionErrorMessage(e, "URL GIF tidak valid."));
        return;
      }
    }
    const hasFiles = pendingFiles.length > 0;
    startTransition(async () => {
      try {
        let created: RoomChatMessageView;
        if (hasFiles) {
          const fd = new FormData();
          fd.append("roomId", roomId);
          fd.append("channelId", channelId);
          fd.append("body", text);
          if (gifUrl) fd.append("gifUrl", gifUrl);
          if (reply?.id) fd.append("replyToId", reply.id);
          for (const f of pendingFiles) fd.append("files", f);
          created = await addRoomMessageForm(fd);
        } else {
          created = await addRoomMessage({
            roomId,
            channelId,
            body: text,
            gifUrl: gifUrl ?? undefined,
            replyToId: reply?.id,
          });
        }
        setBody("");
        setPendingGifUrl(null);
        setPendingFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setReply(null);
        nearBottomRef.current = true;
        setMessages((prev) => mergeRoomMessageLists(prev, [created]));
        requestAnimationFrame(() => scrollToBottom("smooth"));
        lastSyncedAtRef.current = new Date(
          roomMessageActivityMs(created),
        ).toISOString();
        scheduleComposerFocus();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal mengirim."));
      }
    });
  }

  function applyPastedGif() {
    const raw = pasteGif.trim();
    if (!raw) return;
    try {
      setPendingGifUrl(assertSafeGifUrl(raw));
      setPasteGif("");
      setGifOpen(false);
      toast.success("GIF ditambahkan ke pesan (kirim untuk mengunggah).");
    } catch (e) {
      toast.error(actionErrorMessage(e, "URL tidak valid."));
    }
  }

  function applyMentionSuggestion(user: MentionableUser) {
    const draft = mentionDraft;
    if (!draft) return;
    const token = mentionTokenOf(user);
    const mentionText = `@${token} `;
    const next =
      bodyRef.current.slice(0, draft.start) +
      mentionText +
      bodyRef.current.slice(draft.end);
    setBody(next);
    setMentionDraft(null);
    setMentionPickIndex(0);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      const pos = draft.start + mentionText.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 basis-0">
      <div
        ref={scrollRef}
        onScroll={onScrollList}
        className="h-full overflow-y-auto overscroll-contain px-2 py-3 sm:px-3"
      >
        <div className="flex flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-2 py-16 text-center">
              <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
                <MessagesSquare className="size-7" aria-hidden />
              </span>
              <div>
                <p className="text-foreground text-sm font-semibold">
                  Belum ada pesan
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Jadilah yang pertama menyapa di channel ini 👋
                </p>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => {
              const own = m.author.id === currentUserId;
              const deleted = Boolean(m.deletedAt);
              const prev = idx > 0 ? messages[idx - 1] : null;
              const showDate = !prev || !isSameDay(prev.createdAt, m.createdAt);
              const grouped =
                !showDate &&
                !!prev &&
                prev.author.id === m.author.id &&
                !prev.deletedAt &&
                !m.replyTo &&
                new Date(m.createdAt).getTime() -
                  new Date(prev.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              return (
                <Fragment key={m.id}>
                  {showDate ? (
                    <div className="my-2 flex items-center gap-3 px-2">
                      <span className="bg-border h-px flex-1" aria-hidden />
                      <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                        {dayDividerLabel(m.createdAt)}
                      </span>
                      <span className="bg-border h-px flex-1" aria-hidden />
                    </div>
                  ) : null}
                  <div
                    ref={(el) => {
                      if (el) messageRefs.current.set(m.id, el);
                      else messageRefs.current.delete(m.id);
                    }}
                    data-message-id={m.id}
                    className={cn(
                      "group hover:bg-muted/40 relative flex gap-2.5 rounded-lg px-2 transition-colors",
                      grouped ? "mt-0.5 py-0.5" : "mt-3 py-1 first:mt-0",
                    )}
                  >
                    <div className="w-9 shrink-0">
                      {grouped ? (
                        <time
                          dateTime={m.createdAt}
                          className="text-muted-foreground pointer-events-none mt-1 block text-right text-[10px] tabular-nums opacity-0 group-hover:opacity-100"
                        >
                          {timeOnly(m.createdAt)}
                        </time>
                      ) : (
                        <Link
                          href={`/profile/${m.author.id}`}
                          className="block shrink-0 rounded-full"
                          title={`Lihat profil ${authorLabel(m.author.name, m.author.email)}`}
                          aria-label={`Lihat profil ${authorLabel(m.author.name, m.author.email)}`}
                        >
                          {m.author.image ? (
                            <Image
                              src={m.author.image}
                              alt=""
                              width={36}
                              height={36}
                              className="border-border size-9 rounded-full border object-cover"
                              unoptimized
                            />
                          ) : (
                            <div
                              className="border-border bg-accent/40 text-accent-foreground flex size-9 items-center justify-center rounded-full border text-xs font-semibold"
                              aria-hidden
                            >
                              {authorInitial(m.author.name, m.author.email)}
                            </div>
                          )}
                        </Link>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {!grouped ? (
                        <div className="flex items-baseline gap-2">
                          <Link
                            href={`/profile/${m.author.id}`}
                            className={cn(
                              "truncate text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline",
                              own ? "text-primary" : "text-foreground",
                            )}
                          >
                            {own
                              ? "Anda"
                              : authorLabel(m.author.name, m.author.email)}
                          </Link>
                          <time
                            dateTime={m.createdAt}
                            className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
                          >
                            {timeOnly(m.createdAt)}
                          </time>
                          {m.editedAt && !deleted ? (
                            <span className="text-muted-foreground text-[11px] italic">
                              diedit
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {m.replyTo ? (
                        <button
                          type="button"
                          onClick={() => scrollToMessage(m.replyTo!.id)}
                          className="border-primary/40 bg-muted/40 hover:bg-muted mt-1 mb-1 flex w-full max-w-[640px] items-center gap-1.5 rounded-md border-l-2 py-1 pr-2 pl-2 text-left transition-colors"
                        >
                          <Reply className="text-primary size-3 shrink-0" aria-hidden />
                          <span className="text-primary shrink-0 text-[11px] font-semibold">
                            {authorLabel(
                              m.replyTo.author.name,
                              m.replyTo.author.email,
                            )}
                          </span>
                          <span className="text-muted-foreground truncate text-xs">
                            {replySnippet({
                              body: m.replyTo.body,
                              gifUrl: m.replyTo.gifUrl,
                              deletedAt: m.replyTo.deletedAt,
                              attachmentCount: m.replyTo.attachmentCount,
                            })}
                          </span>
                        </button>
                      ) : null}

                      {deleted ? (
                        <p className="text-muted-foreground text-xs italic">
                          Pesan dihapus
                        </p>
                      ) : (
                        <div className="text-sm">
                          {m.body.trim() ? (
                            <ChatLinkifiedText text={m.body} />
                          ) : null}
                          {m.gifUrl ? (
                            <div className="border-border/60 mt-1.5 max-w-[400px] overflow-hidden rounded-lg border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.gifUrl}
                                alt="GIF"
                                className="max-h-64 w-full max-w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                          ) : null}
                          {m.attachments.length > 0 ? (
                            <ul className="mt-1.5 max-w-[440px] space-y-1">
                              {m.attachments.map((a) => {
                                const isImage = isDirectChatImageMime(a.mimeType);
                                return (
                                  <li key={a.id}>
                                    {isImage ? (
                                      <a
                                        href={a.publicPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="border-border/60 block overflow-hidden rounded-md border"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={a.publicPath}
                                          alt={a.fileName}
                                          className="max-h-64 w-full object-contain"
                                          loading="lazy"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={a.publicPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={a.fileName}
                                        className="bg-muted/40 hover:bg-muted/70 flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors"
                                      >
                                        <FileText className="text-muted-foreground size-3.5 shrink-0" />
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate font-medium">
                                            {a.fileName}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {formatFileSize(a.sizeBytes)}
                                          </span>
                                        </span>
                                        <Download className="text-muted-foreground size-3 shrink-0" />
                                      </a>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {!deleted ? (
                      <div className="border-border bg-card absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded"
                          aria-label="Balas pesan"
                          onClick={() => startReply(m)}
                        >
                          <Reply className="size-3.5" />
                        </button>
                        {own ? (
                          <>
                            <button
                              type="button"
                              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded"
                              aria-label="Edit pesan"
                              onClick={() => startEdit(m)}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex size-7 items-center justify-center rounded"
                              aria-label="Hapus pesan"
                              onClick={() => confirmDeleteMessage(m.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Fragment>
              );
            })
          )}
          <div ref={endRef} aria-hidden />
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          onClick={() => {
            setUnseenCount(0);
            nearBottomRef.current = true;
            scrollToBottom("smooth");
          }}
          className={cn(
            "border-border absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors",
            "animate-in fade-in slide-in-from-bottom-2",
            unseenCount > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-card/95 text-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <ChevronDown className="size-3.5" aria-hidden />
          {unseenCount > 0
            ? `${unseenCount > 99 ? "99+" : unseenCount} pesan baru`
            : "Ke pesan terbaru"}
        </button>
      ) : null}
      </div>

      <div className="border-border bg-card shrink-0 space-y-2 border-t p-3">
        {editingMessage ? (
          <div className="bg-primary/10 flex items-center justify-between gap-2 rounded-lg border border-dashed px-2 py-1.5 text-xs">
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
          <div className="bg-muted/60 flex items-start justify-between gap-2 rounded-lg border border-dashed px-2 py-1.5 text-xs">
            <div className="min-w-0">
              <p className="text-primary font-semibold">
                Membalas {reply.authorLabel}
              </p>
              <p className="text-muted-foreground truncate">{reply.snippet}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label="Batal balas"
              onClick={() => setReply(null)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : null}
        {pendingGifUrl && !editingMessage ? (
          <div className="bg-muted/60 flex items-center justify-between gap-2 rounded-lg border border-dashed px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingGifUrl}
                alt=""
                className="border-border size-12 shrink-0 rounded-md border object-cover"
              />
              <p className="text-muted-foreground truncate text-xs">GIF akan dikirim bersama teks.</p>
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
        {pendingFiles.length > 0 && !editingMessage ? (
          <ul className="bg-muted/40 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-dashed p-2 text-xs">
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
        {typingUsers.length > 0 ? (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="flex items-center gap-0.5" aria-hidden>
              <span className="bg-muted-foreground/70 size-1 animate-bounce rounded-full" />
              <span className="bg-muted-foreground/70 size-1 animate-bounce rounded-full [animation-delay:150ms]" />
              <span className="bg-muted-foreground/70 size-1 animate-bounce rounded-full [animation-delay:300ms]" />
            </span>
            <span>
              <span className="text-foreground font-medium">{typingUsers[0]}</span>{" "}
              sedang mengetik
              {typingUsers.length > 1
                ? ` +${typingUsers.length - 1} lainnya`
                : ""}
              …
            </span>
          </div>
        ) : null}
        {pushState !== "ready" ? (
          <div className="bg-muted/60 flex items-center justify-between gap-2 rounded-lg border border-dashed px-2 py-1.5 text-xs">
            <p className="text-muted-foreground">
              {pushState === "unsupported"
                ? "Browser ini belum mendukung push notification."
                : pushState === "not-configured"
                  ? "Push notification belum dikonfigurasi di server."
                  : pushState === "blocked"
                    ? "Izin notifikasi diblokir. Ubah ke Allow di setting browser, lalu refresh."
                  : "Aktifkan push notification agar chat bisa bunyi/getar di device."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void enablePushNotification()}
              disabled={pushState === "unsupported" || pushState === "not-configured"}
            >
              Aktifkan
            </Button>
          </div>
        ) : null}
        <div className="relative">
          {mentionDraft && mentionSuggestions.length > 0 ? (
            <div className="border-border bg-popover absolute bottom-[calc(100%+0.5rem)] left-0 z-20 w-full max-w-sm overflow-hidden rounded-md border shadow-lg">
              <ul className="max-h-56 overflow-y-auto p-1">
                {mentionSuggestions.map((u, idx) => {
                  const displayName = u.name?.trim() || u.email;
                  const active = idx === mentionPickIndex;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded px-2 py-1.5 text-left text-sm transition-colors",
                          active ? "bg-accent text-accent-foreground" : "hover:bg-muted/70",
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyMentionSuggestion(u)}
                      >
                        <p className="truncate font-medium">{displayName}</p>
                        <p className="text-muted-foreground truncate text-xs">@{mentionTokenOf(u)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            accept={`image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,${CREATIVE_ACCEPT_EXTENSIONS}`}
            disabled={pending || Boolean(editingMessage)}
            onChange={(e) => {
              const input = e.target;
              /** `FileList` hidup: reset `value` mengosongkan `files` — salin dulu. */
              const picked = input.files?.length ? Array.from(input.files) : [];
              input.value = "";
              onPickFiles(picked);
            }}
          />
          <div className="border-border bg-background focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-xl border transition-[border-color,box-shadow] focus-within:ring-3">
            <Textarea
              ref={taRef}
              rows={2}
              placeholder={editingMessage ? "Edit pesan…" : "Tulis pesan…"}
              value={body}
              disabled={pending}
              onPaste={onComposerPaste}
              onChange={(e) => {
                const next = e.target.value;
                setBody(next);
                const cursor = e.target.selectionStart ?? next.length;
                setMentionDraft(detectMentionDraft(next, cursor));
              }}
              onClick={(e) => {
                const el = e.currentTarget;
                const cursor = el.selectionStart ?? bodyRef.current.length;
                setMentionDraft(detectMentionDraft(bodyRef.current, cursor));
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && editingMessage) {
                  e.preventDefault();
                  cancelEdit();
                  return;
                }
                if (mentionDraft && mentionSuggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionPickIndex((prev) => (prev + 1) % mentionSuggestions.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionPickIndex((prev) =>
                      prev === 0 ? mentionSuggestions.length - 1 : prev - 1,
                    );
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    applyMentionSuggestion(
                      mentionSuggestions[mentionPickIndex] ?? mentionSuggestions[0],
                    );
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMentionDraft(null);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="min-h-[72px] resize-none rounded-none border-0 bg-transparent px-3 pt-3 pb-1 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
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
                        onEmojiClick={onEmojiPick}
                        theme={Theme.AUTO}
                        width={352}
                        height={420}
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
                        Cari di Giphy (butuh <code className="text-foreground">GIPHY_API_KEY</code>{" "}
                        di server) atau tempel URL Giphy/Tenor.
                      </p>
                      <Input
                        value={gifQuery}
                        onChange={(e) => setGifQuery(e.target.value)}
                        placeholder="Cari GIF…"
                        className="mb-2"
                      />
                      {giphyConfigured === false ? (
                        <p className="text-muted-foreground mb-2 text-xs">
                          API Giphy belum diatur — gunakan tempel URL di bawah.
                        </p>
                      ) : null}
                      <div className="max-h-56 overflow-y-auto">
                        {gifLoading ? (
                          <p className="text-muted-foreground py-6 text-center text-sm">
                            Memuat…
                          </p>
                        ) : gifItems.length === 0 ? (
                          <p className="text-muted-foreground py-4 text-center text-xs">
                            Tidak ada hasil. Ubah kata kunci atau tempel URL.
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5">
                            {gifItems.map((g) => (
                              <button
                                key={g.url}
                                type="button"
                                className="border-border hover:ring-primary overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none"
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
                      <div className="border-border mt-3 space-y-1.5 border-t pt-2">
                        <LabelTiny>Tempel URL GIF (HTTPS)</LabelTiny>
                        <div className="flex gap-1">
                          <Input
                            value={pasteGif}
                            onChange={(e) => setPasteGif(e.target.value)}
                            placeholder="https://media.giphy.com/…"
                            className="text-xs"
                          />
                          <Button type="button" size="sm" variant="secondary" onClick={applyPastedGif}>
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
                      pending || pendingFiles.length >= DIRECT_CHAT_MAX_FILES_PER_MESSAGE
                    }
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Lampirkan file"
                    title="Lampirkan file"
                  >
                    <Paperclip className="size-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground px-1 text-xs">Mode edit: hanya teks pesan.</p>
              )}
              <Button
                type="button"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={
                  pending ||
                  (editingMessage
                    ? !body.trim()
                    : !body.trim() && !pendingGifUrl && pendingFiles.length === 0)
                }
                onMouseDown={preventComposerBlur}
                onClick={submit}
              >
                {!editingMessage ? <Send className="size-4" aria-hidden /> : null}
                {pending
                  ? editingMessage
                    ? "Menyimpan…"
                    : "Mengirim…"
                  : editingMessage
                    ? "Simpan"
                    : "Kirim"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabelTiny({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
      {children}
    </label>
  );
}
