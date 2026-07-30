"use client";

import { memo, useMemo } from "react";
import { ChevronUp } from "lucide-react";
import type { DirectChatMessageView } from "@/lib/direct-chat-message-view";
import { DirectChatMessageBubble } from "@/components/direct-chat/direct-chat-message-bubble";
import { Button } from "@/components/ui/button";

/** Jumlah pesan terbaru yang langsung dirender saat percakapan dibuka. */
export const DIRECT_CHAT_WINDOW_SIZE = 40;
/** Tambahan pesan lama per klik "Muat pesan lama". */
export const DIRECT_CHAT_WINDOW_STEP = 40;

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
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

type DirectChatMessageItem =
  | { type: "date"; id: string; label: string }
  | { type: "message"; message: DirectChatMessageView; compact: boolean };

function buildMessageItems(
  messages: DirectChatMessageView[],
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
    const compact = Boolean(
      previous &&
        !showDate &&
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
  hiddenCount,
  onLoadOlder,
  onReply,
  onEdit,
  onDelete,
  onScrollToReply,
}: {
  messages: DirectChatMessageView[];
  currentUserId: string;
  /** Id pesan terakhir milik sendiri yang menampilkan status baca. */
  readReceiptMessageId: string | null;
  readReceiptState: "read" | "unread" | null;
  /** Jumlah pesan lama yang belum dirender (di luar jendela). */
  hiddenCount: number;
  onLoadOlder: () => void;
  onReply: (message: DirectChatMessageView) => void;
  onEdit: (message: DirectChatMessageView) => void;
  onDelete: (messageId: string) => void;
  onScrollToReply: (messageId: string) => void;
}) {
  const items = useMemo(() => buildMessageItems(messages), [messages]);

  return (
    <div className="direct-chat-messages flex flex-col">
      {hiddenCount > 0 ? (
        <div className="mb-2 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
            onClick={onLoadOlder}
          >
            <ChevronUp className="size-3.5" aria-hidden />
            Muat pesan lama ({hiddenCount})
          </Button>
        </div>
      ) : null}
      {items.map((item) => {
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
        const message = item.message;
        return (
          <div
            key={message.id}
            data-message-id={message.id}
            className="[content-visibility:auto] [contain-intrinsic-size:auto_80px]"
          >
            <DirectChatMessageBubble
              message={message}
              own={message.author.id === currentUserId}
              readReceipt={
                message.id === readReceiptMessageId ? readReceiptState : null
              }
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onScrollToReply={onScrollToReply}
              compact={item.compact}
            />
          </div>
        );
      })}
    </div>
  );
});
