"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Check,
  CheckCheck,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Reply,
  Trash2,
} from "lucide-react";
import type { DirectChatMessageView } from "@/lib/direct-chat-message-view";
import { directChatReplySnippet } from "@/lib/direct-chat-reply-snippet";
import { isDirectChatImageMime } from "@/lib/direct-chat-attachments-shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function authorLabel(name: string | null, email: string) {
  return name?.trim() || email;
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ukuran khusus isi percakapan (sedikit lebih kecil dari UI sekitar, tapi terbaca nyaman). */
const chatText = "text-[13px] leading-relaxed";
const chatMeta = "text-[11px] leading-snug";
/** Sudut bubble pesan — sedikit membulat, panel luar tetap lancip. */
const bubbleRound = "rounded-lg";
const bubbleInnerRound = "rounded-md";

export function DirectChatMessageBubble({
  message: m,
  own,
  readReceipt,
  onReply,
  onEdit,
  onDelete,
  onScrollToReply,
}: {
  message: DirectChatMessageView;
  own: boolean;
  readReceipt?: "read" | "unread" | null;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onScrollToReply?: (id: string) => void;
}) {
  const deleted = Boolean(m.deletedAt);

  return (
    <div className={cn("group flex gap-2.5", own ? "flex-row-reverse" : "flex-row")}>
      <Link
        href={`/profile/${m.author.id}`}
        className="shrink-0 rounded-full pt-0.5"
        title={`Profil ${authorLabel(m.author.name, m.author.email)}`}
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
            className={cn(
              "border-border bg-accent/40 text-accent-foreground flex size-9 items-center justify-center rounded-full border font-semibold",
              chatMeta,
            )}
            aria-hidden
          >
            {(m.author.name?.trim() || m.author.email).slice(0, 1).toUpperCase()}
          </div>
        )}
      </Link>
      <div
        className={cn(
          "max-w-[min(100%,min(72rem,92%))] min-w-0 border px-3 py-2 shadow-sm",
          bubbleRound,
          chatText,
          own ? "border-primary/25 bg-primary/12" : "border-border bg-card",
          deleted && "opacity-75",
        )}
      >
        <div
          className={cn(
            "text-muted-foreground flex flex-wrap items-center justify-between gap-1.5",
            chatMeta,
          )}
        >
          <Link
            href={`/profile/${m.author.id}`}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {own ? "Anda" : authorLabel(m.author.name, m.author.email)}
          </Link>
          <span className="flex items-center gap-1">
            {m.editedAt && !deleted ? (
              <span className="italic opacity-80">diedit</span>
            ) : null}
            <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
          </span>
        </div>

        {m.replyTo ? (
          <button
            type="button"
            onClick={() => onScrollToReply?.(m.replyTo!.id)}
            className={cn(
              "border-primary/40 bg-muted/50 hover:bg-muted mt-1 mb-0.5 w-full border-l-[3px] py-1 pr-1.5 pl-1.5 text-left transition-colors",
              bubbleInnerRound,
            )}
          >
            <span className={cn("text-primary font-semibold", chatMeta)}>
              ↩ {authorLabel(m.replyTo.author.name, m.replyTo.author.email)}
            </span>
            <p className={cn("text-muted-foreground truncate", chatMeta)}>
              {directChatReplySnippet({
                body: m.replyTo.body,
                gifUrl: m.replyTo.gifUrl,
                deletedAt: m.replyTo.deletedAt,
                attachmentCount: m.replyTo.attachmentCount,
              })}
            </p>
          </button>
        ) : null}

        {deleted ? (
          <p className={cn("text-muted-foreground mt-0.5 italic", chatMeta)}>
            Pesan dihapus
          </p>
        ) : (
          <>
            {m.body.trim() ? (
              <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>
            ) : null}
            {m.gifUrl ? (
              <div className={cn("border-border/60 mt-1 overflow-hidden border", bubbleInnerRound)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.gifUrl}
                  alt="GIF"
                  className="max-h-56 w-full max-w-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : null}
            {m.attachments.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {m.attachments.map((a) => {
                  const isImage = isDirectChatImageMime(a.mimeType);
                  return (
                    <li key={a.id}>
                      {isImage ? (
                        <a
                          href={a.publicPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn("block overflow-hidden border border-border/60", bubbleInnerRound)}
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
                          className={cn(
                            "bg-muted/40 hover:bg-muted/70 flex items-center gap-1.5 border px-2 py-1.5 transition-colors",
                            bubbleInnerRound,
                            chatMeta,
                          )}
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
          </>
        )}

        <div
          className={cn(
            "mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5",
            own ? "justify-start" : "justify-end",
          )}
        >
          {own && readReceipt && !deleted ? (
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                chatMeta,
                readReceipt === "read" ? "text-primary" : "text-muted-foreground",
              )}
            >
              {readReceipt === "read" ? (
                <>
                  <CheckCheck className="size-3" aria-hidden />
                  Dibaca
                </>
              ) : (
                <>
                  <Check className="size-3" aria-hidden />
                  Belum dibaca
                </>
              )}
            </span>
          ) : null}
          {!deleted ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className={cn(
                "text-muted-foreground h-6 gap-0.5 px-1.5 opacity-70 group-hover:opacity-100",
                chatMeta,
              )}
              onClick={onReply}
            >
              <Reply className="size-3" />
              Balas
            </Button>
          ) : null}
          {own && !deleted ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="text-muted-foreground hover:bg-muted inline-flex size-6 items-center justify-center rounded-md opacity-70 group-hover:opacity-100"
                aria-label="Aksi pesan"
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align={own ? "start" : "end"}>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-3.5" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  );
}
