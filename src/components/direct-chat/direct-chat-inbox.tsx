"use client";

import { memo, useMemo, useState } from "react";
import { Search, SquarePen, X } from "lucide-react";
import type { DirectInboxItem } from "@/lib/direct-chat-inbox";
import { previewText } from "@/lib/direct-chat-inbox";
import {
  directChatAuthorLabel,
  formatDirectChatTime,
  isDirectChatUserOnline,
} from "@/lib/direct-chat-format";
import { DirectChatAvatar } from "@/components/direct-chat/direct-chat-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InboxFilter = "all" | "unread";

/**
 * Kolom inbox. State pencarian & filter hidup di sini supaya mengetik di kotak
 * cari tidak me-render ulang thread yang sedang terbuka.
 */
export const DirectChatInbox = memo(function DirectChatInbox({
  inbox,
  activeId,
  currentUserId,
  onOpenConversation,
  onNewChat,
  className,
}: {
  inbox: DirectInboxItem[];
  activeId: string | null;
  currentUserId: string;
  onOpenConversation: (conversationId: string) => void;
  onNewChat: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inbox.filter((i) => {
      if (filter === "unread" && i.unreadCount === 0) return false;
      if (!q) return true;
      const name = (i.otherUser.name ?? i.otherUser.email).toLowerCase();
      return name.includes(q) || i.otherUser.email.toLowerCase().includes(q);
    });
  }, [inbox, filter, query]);

  const unreadConversations = useMemo(
    () => inbox.filter((i) => i.unreadCount > 0).length,
    [inbox],
  );

  return (
    <aside className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="shrink-0 space-y-3 px-3 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between gap-3 pl-1">
          <h1 className="text-lg font-semibold tracking-tight">Pesan pribadi</h1>
          <Button
            type="button"
            size="icon"
            className="rounded-full"
            onClick={onNewChat}
            aria-label="Tulis pesan baru"
            title="Pesan baru"
          >
            <SquarePen className="size-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-3.5" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau email…"
            aria-label="Cari percakapan"
            className="bg-muted/60 h-9 rounded-full border-transparent pr-8 pl-8.5 text-sm"
          />
          {query ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute top-2 right-2.5 inline-flex size-5 items-center justify-center rounded-full"
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-1.5 text-xs font-medium">
          {(
            [
              { value: "all", label: "Semua" },
              {
                value: "unread",
                label:
                  unreadConversations > 0
                    ? `Belum dibaca ${unreadConversations}`
                    : "Belum dibaca",
              },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "focus-visible:ring-ring/50 rounded-full px-3 py-1.5 outline-none transition-colors focus-visible:ring-3",
                filter === option.value
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium">
              {inbox.length === 0
                ? "Belum ada percakapan"
                : filter === "unread"
                  ? "Semua pesan sudah dibaca"
                  : "Percakapan tidak ditemukan"}
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-[28ch] text-xs leading-relaxed">
              {inbox.length === 0
                ? "Kirim pesan pertama ke salah satu anggota tim."
                : filter === "unread"
                  ? "Pilih Semua untuk melihat seluruh percakapan."
                  : "Coba nama lain, atau tulis pesan baru ke orangnya."}
            </p>
            {inbox.length === 0 ? (
              <Button type="button" size="sm" className="mt-4" onClick={onNewChat}>
                Tulis pesan baru
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((item) => {
              const active = item.conversationId === activeId;
              const unread = item.unreadCount > 0;
              return (
                <li key={item.conversationId}>
                  <button
                    type="button"
                    onClick={() => onOpenConversation(item.conversationId)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none transition-colors focus-visible:ring-3",
                      active ? "bg-primary/10" : "hover:bg-muted/60",
                    )}
                  >
                    <DirectChatAvatar
                      name={item.otherUser.name}
                      email={item.otherUser.email}
                      image={item.otherUser.image}
                      size={44}
                      online={isDirectChatUserOnline(item.otherUser.lastSeenAt)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            unread ? "font-bold" : "font-medium",
                          )}
                        >
                          {directChatAuthorLabel(
                            item.otherUser.name,
                            item.otherUser.email,
                          )}
                        </span>
                        {item.lastMessage ? (
                          <time
                            dateTime={item.lastMessage.createdAt}
                            className={cn(
                              "shrink-0 text-[11px] tabular-nums",
                              unread
                                ? "text-foreground font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatDirectChatTime(item.lastMessage.createdAt)}
                          </time>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-[13px]",
                            unread
                              ? "text-foreground font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          {previewText(
                            item.lastMessage,
                            item.lastMessage?.authorId ?? "",
                            currentUserId,
                          )}
                        </p>
                        {unread ? (
                          <span
                            className="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
                            aria-label={`${item.unreadCount} pesan belum dibaca`}
                          >
                            {item.unreadCount > 99 ? "99+" : item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
});
