"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addRoomMessage } from "@/actions/room-messages";
import type { RoomChatMessageView } from "@/lib/room-chat-message-view";
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
  Clapperboard,
  Reply,
  Smile,
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

function replySnippet(msg: { body: string; gifUrl: string | null }): string {
  const t = msg.body.trim();
  if (msg.gifUrl && t) {
    const cut = t.length > 72 ? `${t.slice(0, 72)}…` : t;
    return `${cut} · GIF`;
  }
  if (msg.gifUrl) return "GIF";
  if (!t) return "(tanpa teks)";
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
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
  currentUserId,
  messages: initialMessages,
  mentionableUsers,
}: {
  roomId: string;
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
  const [pushState, setPushState] = useState<
    "checking" | "ready" | "needs-activation" | "blocked" | "unsupported" | "not-configured"
  >("checking");
  const [mentionDraft, setMentionDraft] = useState<MentionDraft | null>(null);
  const [mentionPickIndex, setMentionPickIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
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

  const onScrollList = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = gap < 120;
  }, []);

  /** Live updates: poll server for new messages (no WebSocket required). */
  useEffect(() => {
    let cancelled = false;
    async function pull() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch(`/api/room-chat/${roomId}/messages`, {
          credentials: "include",
        });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as {
          messages?: RoomChatMessageView[];
          typingUsers?: string[];
        };
        if (!Array.isArray(j.messages) || cancelled) return;
        setTypingUsers(
          Array.isArray(j.typingUsers)
            ? j.typingUsers.filter((x): x is string => typeof x === "string")
            : [],
        );
        const incoming = j.messages;
        setMessages((prev) => {
          if (incoming.length < prev.length) {
            return incoming;
          }
          const byId = new Map(incoming.map((m) => [m.id, m]));
          for (const m of prev) {
            if (!byId.has(m.id)) byId.set(m.id, m);
          }
          const merged = [...byId.values()].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          if (
            merged.length === prev.length &&
            merged[merged.length - 1]?.id === prev[prev.length - 1]?.id
          ) {
            return prev;
          }
          return merged;
        });
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
  }, [roomId]);

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

  useEffect(() => {
    const last = messages[messages.length - 1];
    const own = last?.author.id === currentUserId;
    const container = scrollRef.current;
    if (own || nearBottomRef.current) {
      requestAnimationFrame(() => {
        if (!container) return;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: own ? "smooth" : "auto",
        });
      });
    }
  }, [messages, currentUserId]);

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

  function startReply(m: RoomChatMessageView) {
    setReply({
      id: m.id,
      authorLabel: authorLabel(m.author.name, m.author.email),
      snippet: replySnippet({ body: m.body, gifUrl: m.gifUrl }),
    });
    taRef.current?.focus();
  }

  function submit() {
    const text = body.trim();
    const gif = pendingGifUrl?.trim() ?? "";
    if ((!text && !gif) || pending) return;
    let gifUrl: string | null = null;
    if (gif) {
      try {
        gifUrl = assertSafeGifUrl(gif);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "URL GIF tidak valid.");
        return;
      }
    }
    startTransition(async () => {
      try {
        const created = await addRoomMessage({
          roomId,
          body: text,
          gifUrl: gifUrl ?? undefined,
          replyToId: reply?.id,
        });
        setBody("");
        setPendingGifUrl(null);
        setReply(null);
        nearBottomRef.current = true;
        setMessages((prev) => {
          if (prev.some((m) => m.id === created.id)) return prev;
          return [...prev, created];
        });
        taRef.current?.focus();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal mengirim.");
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
      toast.error(e instanceof Error ? e.message : "URL tidak valid.");
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
    <div className="flex flex-col gap-3">
      <div className="border-border bg-muted/10 flex max-h-[min(520px,58vh)] min-h-[280px] flex-col rounded-xl border">
        <div
          ref={scrollRef}
          onScroll={onScrollList}
          className="overflow-y-auto p-3"
        >
          <div className="flex flex-col gap-2">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Belum ada pesan. Mulai percakapan di bawah.
              </p>
            ) : (
              messages.map((m) => {
                const own = m.author.id === currentUserId;
                return (
                  <div
                    key={m.id}
                    ref={(el) => {
                      if (el) messageRefs.current.set(m.id, el);
                      else messageRefs.current.delete(m.id);
                    }}
                    data-message-id={m.id}
                    className={cn(
                      "flex gap-2",
                      own ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <Link
                      href={`/profile/${m.author.id}`}
                      className="shrink-0 rounded-full pt-0.5"
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
                    <div
                      className={cn(
                        "max-w-[min(100%,520px)] min-w-0 rounded-2xl border px-3 py-2 text-sm shadow-sm",
                        own
                          ? "border-primary/25 bg-primary/12"
                          : "border-border bg-card",
                      )}
                    >
                      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <Link
                          href={`/profile/${m.author.id}`}
                          className="font-semibold text-foreground underline-offset-4 hover:underline focus-visible:underline"
                        >
                          {authorLabel(m.author.name, m.author.email)}
                        </Link>
                        <time dateTime={m.createdAt}>
                          {new Date(m.createdAt).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                      {m.replyTo ? (
                        <button
                          type="button"
                          onClick={() => scrollToMessage(m.replyTo!.id)}
                          className="border-primary/40 bg-muted/50 hover:bg-muted mt-1.5 mb-1 w-full rounded-md border-l-4 py-1.5 pr-2 pl-2 text-left transition-colors"
                        >
                          <span className="text-primary text-[11px] font-semibold">
                            ↩ {authorLabel(m.replyTo.author.name, m.replyTo.author.email)}
                          </span>
                          <p className="text-muted-foreground truncate text-xs">
                            {replySnippet({
                              body: m.replyTo.body,
                              gifUrl: m.replyTo.gifUrl,
                            })}
                          </p>
                        </button>
                      ) : null}
                      {m.body.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                      ) : null}
                      {m.gifUrl ? (
                        <div className="mt-1.5 overflow-hidden rounded-lg border border-border/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.gifUrl}
                            alt="GIF"
                            className="max-h-64 w-full max-w-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <div className={cn("mt-1 flex", own ? "justify-start" : "justify-end")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground h-7 gap-1 px-2 text-[11px]"
                          onClick={() => startReply(m)}
                        >
                          <Reply className="size-3" />
                          Balas
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} aria-hidden />
          </div>
        </div>
      </div>

      <div className="border-border bg-card space-y-2 rounded-xl border p-3">
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
        {pendingGifUrl ? (
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
        {typingUsers.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            {typingUsers[0]} sedang mengetik
            {typingUsers.length > 1 ? ` +${typingUsers.length - 1} lainnya` : ""}
          </p>
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
          <Textarea
          ref={taRef}
          rows={3}
          placeholder="Tulis pesan… (@emoji & GIF dari toolbar)"
          value={body}
          disabled={pending}
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
                applyMentionSuggestion(mentionSuggestions[mentionPickIndex] ?? mentionSuggestions[0]);
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
          className="min-h-[88px] resize-y"
          />
        </div>
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
                aria-label="Pilih emoji"
              >
                <Smile className="size-4" />
                Emoji
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
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1",
                  pending && "pointer-events-none opacity-50",
                )}
                disabled={pending}
                aria-label="Tambah GIF"
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
                  Cari di Giphy (butuh <code className="text-foreground">GIPHY_API_KEY</code> di
                  server) atau tempel URL Giphy/Tenor.
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
          </div>
          <Button
            type="button"
            disabled={pending || (!body.trim() && !pendingGifUrl)}
            onClick={submit}
          >
            {pending ? "Mengirim…" : "Kirim"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Enter kirim · Shift+Enter baris baru · Pakai @Nama untuk summon (kirim notif WA)
        </p>
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
