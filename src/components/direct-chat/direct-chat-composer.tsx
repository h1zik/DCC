"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Paperclip, Send, Smile, X } from "lucide-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Theme } from "emoji-picker-react";
import { actionErrorMessage } from "@/lib/action-error-message";
import { CREATIVE_ACCEPT_EXTENSIONS } from "@/lib/creative-file-formats";
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
import { DirectChatPushSetup } from "@/components/direct-chat/direct-chat-push-setup";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EmojiPicker = dynamic(
  () => import("emoji-picker-react").then((m) => m.default),
  { ssr: false, loading: () => null },
);

export type DirectChatComposerReply = {
  id: string;
  authorLabel: string;
  snippet: string;
};

export type DirectChatComposerEditing = {
  id: string;
  body: string;
};

/** Penanda DOM composer aktif — dipakai `focusDirectChatComposer` dari luar. */
const COMPOSER_ATTR = "data-direct-chat-composer";

/** Fokuskan composer chat pribadi dari komponen lain tanpa mengoper ref. */
export function focusDirectChatComposer() {
  document
    .querySelector<HTMLTextAreaElement>(`textarea[${COMPOSER_ATTR}]`)
    ?.focus();
}

export type DirectChatComposerPayload = {
  body: string;
  gifUrl: string | null;
  files: File[];
  replyToId: string | null;
  editingMessageId: string | null;
};

/**
 * Composer chat pribadi — sengaja dipisah dari `DirectChatExperience`.
 *
 * Seluruh state ketikan (teks, GIF, lampiran, picker) hidup di sini, jadi tiap
 * penekanan tombol hanya me-render subtree kecil ini. Sebelumnya `body` ada di
 * komponen induk, sehingga satu karakter memicu render ulang seluruh layar chat
 * (inbox, header, dialog) dan terasa nge-lag pada percakapan panjang.
 */
export function DirectChatComposer({
  pending,
  reply,
  editing,
  onCancelReply,
  onCancelEdit,
  onSubmit,
}: {
  pending: boolean;
  reply: DirectChatComposerReply | null;
  editing: DirectChatComposerEditing | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  /** Kirim/simpan pesan; resolve `true` bila berhasil supaya composer dibersihkan. */
  onSubmit: (payload: DirectChatComposerPayload) => Promise<boolean>;
}) {
  const [body, setBody] = useState("");
  const [pendingGifUrl, setPendingGifUrl] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("happy");
  const [gifItems, setGifItems] = useState<{ url: string; preview: string }[]>(
    [],
  );
  const [gifLoading, setGifLoading] = useState(false);
  const [giphyConfigured, setGiphyConfigured] = useState<boolean | null>(null);
  const [pasteGif, setPasteGif] = useState("");

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scheduleComposerFocus = useChatComposerFocus(taRef, pending);

  const editingId = editing?.id ?? null;
  const editingBody = editing?.body ?? "";
  const replyId = reply?.id ?? null;

  /**
   * Sinkronkan draf saat masuk/keluar mode edit — disesuaikan langsung ketika
   * render, bukan lewat efek, supaya tidak ada render berantai.
   */
  const [syncedEditingId, setSyncedEditingId] = useState<string | null>(null);
  if (syncedEditingId !== editingId) {
    setSyncedEditingId(editingId);
    setBody(editingId ? editingBody : "");
    if (editingId) {
      setPendingGifUrl(null);
      setPendingFiles([]);
    }
  }

  /** Fokus composer saat mulai membalas atau mengedit (bukan saat pertama mount). */
  const focusedForRef = useRef<string | null>(null);
  useEffect(() => {
    const key = editingId ?? replyId;
    if (!key) {
      focusedForRef.current = null;
      return;
    }
    if (focusedForRef.current === key) return;
    focusedForRef.current = key;
    taRef.current?.focus();
  }, [editingId, replyId]);

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

  const onPickFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;
    setPendingFiles((prev) => mergePendingChatFiles(prev, incoming));
  }, []);

  function onComposerPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (editingId || pending) return;
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

  async function submitMessage() {
    if (pending) return;
    const text = body.trim();
    const gif = pendingGifUrl?.trim() || null;

    if (editingId) {
      if (!text) {
        toast.error("Pesan tidak boleh kosong.");
        return;
      }
      const ok = await onSubmit({
        body: text,
        gifUrl: null,
        files: [],
        replyToId: null,
        editingMessageId: editingId,
      });
      if (ok) {
        setBody("");
        scheduleComposerFocus();
      }
      return;
    }

    if (!text && !gif && pendingFiles.length === 0) return;

    const ok = await onSubmit({
      body: text,
      gifUrl: gif,
      files: pendingFiles,
      replyToId: replyId,
      editingMessageId: null,
    });
    if (!ok) return;

    setBody("");
    setPendingGifUrl(null);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    scheduleComposerFocus();
  }

  const canSend = Boolean(
    editingId ? body.trim() : body.trim() || pendingGifUrl || pendingFiles.length,
  );

  return (
    <div className="border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/90 sticky bottom-0 z-20 shrink-0 space-y-2 border-t p-2.5 shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-3 dark:shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.45)]">
      <DirectChatPushSetup className="mb-0.5 rounded-xl" />
      {editing ? (
        <div className="border-primary/25 bg-primary/10 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs">
          <span>
            <strong>Mengedit pesan</strong> — Enter simpan, Esc batal
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Batal edit"
            onClick={onCancelEdit}
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
            onClick={onCancelReply}
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
        accept={`image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,${CREATIVE_ACCEPT_EXTENSIONS}`}
        disabled={pending || Boolean(editingId)}
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
          {...{ [COMPOSER_ATTR]: "" }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={onComposerPaste}
          placeholder={editingId ? "Edit teks pesan…" : "Tulis pesan…"}
          rows={1}
          disabled={pending}
          className="max-h-40 min-h-12 resize-none rounded-none border-0 bg-transparent px-3 pt-3 pb-1 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          onKeyDown={(e) => {
            if (e.key === "Escape" && editingId) {
              e.preventDefault();
              onCancelEdit();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitMessage();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          {!editingId ? (
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
              onClick={() => void submitMessage()}
            >
              {!editingId ? <Send className="size-4" aria-hidden /> : null}
              {pending ? "…" : editingId ? "Simpan" : "Kirim"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
