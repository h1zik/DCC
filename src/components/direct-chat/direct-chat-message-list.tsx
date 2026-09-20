"use client";

import { memo, useMemo } from "react";
import { ChevronUp } from "lucide-react";
import type { DirectChatMessageView } from "@/lib/direct-chat-message-view";
import { isSameCalendarDay } from "@/lib/direct-chat-format";
import { DirectChatMessageBubble } from "@/components/direct-chat/direct-chat-message-bubble";
import { Button } from "@/components/ui/button";

/** Jumlah pesan terbaru yang langsung dirender saat percakapan dibuka. */
export const DIRECT_CHAT_WINDOW_SIZE = 40;
/** Tambahan pesan lama per klik "Muat pesan lama". */
export const DIRECT_CHAT_WINDOW_STEP = 40;

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

type DirectChatMessageItem =
  | { type: "date"; id: string; label: string }
  | { type: "unread"; id: string }
  | { type: "message"; message: DirectChatMessageView; compact: boolean };

function buildMessageItems(
  messages: DirectChatMessageView[],
  unreadAnchorId: string | null,
): DirectChatMessageItem[] {
  const items: DirectChatMessageItem[] = [];
  let previous: DirectChatMessageView | null = null;
  let previousDayKey = "";

  for (const message of messages) {
    const createdAt = new Date(message.createdAt);
    const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
    const showDate = dayKey !== previousDayKey;
    if (showDate) {
      items.push({
        type: "date",
        id: `date-${dayKey}-${message.id}`,
        label: formatDateSeparator(message.createdAt),
      });
    }
    const showUnread = message.id === unreadAnchorId;
    if (showUnread) items.push({ type: "unread", id: `unread-${message.id}` });
    const compact = Boolean(
      previous &&
        !showDate &&
        !showUnread &&
        previous.author.id === message.author.id &&
        createdAt.getTime() - new Date(previous.createdAt).getTime() <
          5 * 60 * 1000,
    );
    items.push({ type: "message", message, compact });
    previous = message;
    previousDayKey = dayKey;
  }

  return items;
}

/**
 * Daftar pesan percakapan pribadi.
 *
 * Semua prop sengaja dijaga stabil (primitif atau callback ber-`useCallback`)
 * supaya `memo` benar-benar menahan render ulang: mengetik di composer, poll
 * inbox, dan perubahan `peerLastReadAt` tidak boleh menyentuh daftar ini.
 */
export const DirectChatMessageList = memo(function DirectChatMessageList({
  messages,
  currentUserId,
  readReceiptMessageId,
  readReceiptState,
  highlightId,
  unreadAnchorId,
  hiddenCount,
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
  onReply,
  onEdit,
  onDelete,
  onScrollToReply,
  onOpenImage,
}: {
  messages: DirectChatMessageView[];
  currentUserId: string;
  /** Id pesan terakhir milik sendiri yang menampilkan status baca. */
  readReceiptMessageId: string | null;
  readReceiptState: "read" | "unread" | null;
  /** Pesan tujuan lompatan yang sedang disorot. */
  highlightId: string | null;
  /** Pesan belum dibaca pertama saat percakapan dibuka — diberi pembatas. */
  unreadAnchorId: string | null;
  /** Jumlah pesan lama yang belum dirender (di luar jendela). */
  hiddenCount: number;
  /** Masih ada riwayat lebih lama di server yang belum diambil. */
  hasMoreOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReply: (message: DirectChatMessageView) => void;
  onEdit: (message: DirectChatMessageView) => void;
  onDelete: (messageId: string) => void;
  onScrollToReply: (messageId: string) => void;
  onOpenImage: (attachmentId: string) => void;
}) {
  const items = useMemo(
    () => buildMessageItems(messages, unreadAnchorId),
    [messages, unreadAnchorId],
  );

  return (
    <div className="direct-chat-messages flex flex-col">
      {hiddenCount > 0 || hasMoreOlder ? (
        <div className="mb-2 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
            disabled={loadingOlder}
            onClick={onLoadOlder}
          >
            <ChevronUp className="size-3.5" aria-hidden />
            {loadingOlder
              ? "Memuat pesan lama…"
              : hiddenCount > 0
                ? `Muat pesan lama (${hiddenCount})`
                : "Muat pesan lama"}
          </Button>
        </div>
      ) : messages.length > 0 ? (
        <p className="text-muted-foreground mb-2 text-center text-[11px]">
          Awal percakapan
        </p>
      ) : null}
      {items.map((item) => {
        if (item.type === "date") {
          return (
            <div
              key={item.id}
              className="pointer-events-none sticky top-0 z-[1] mt-5 mb-1 flex justify-center"
            >
              <span className="bg-background/90 text-muted-foreground ring-border rounded-full px-3 py-1 text-[11px] font-medium ring-1 backdrop-blur-sm">
                {item.label}
              </span>
            </div>
          );
        }
        if (item.type === "unread") {
          return (
            <div
              key={item.id}
              role="separator"
              className="text-primary mt-4 flex items-center gap-3 text-[11px] font-semibold"
            >
              <span className="bg-primary/40 h-px flex-1" />
              Pesan baru
              <span className="bg-primary/40 h-px flex-1" />
            </div>
          );
        }
        const message = item.message;
        return (
          <div
            key={message.id}
            data-message-id={message.id}
            // Padding memberi ruang cincin sorotan — `content-visibility` memotong
            // apa pun yang keluar dari kotak ini.
            className="px-1.5 pb-1 [content-visibility:auto] [contain-intrinsic-size:auto_64px]"
          >
            <DirectChatMessageBubble
              message={message}
              own={message.author.id === currentUserId}
              readReceipt={
                message.id === readReceiptMessageId ? readReceiptState : null
              }
              highlighted={message.id === highlightId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onScrollToReply={onScrollToReply}
              onOpenImage={onOpenImage}
              compact={item.compact}
            />
          </div>
        );
      })}
    </div>
  );
});
