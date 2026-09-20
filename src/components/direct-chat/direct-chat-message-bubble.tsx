"use client";

import { memo } from "react";
import {
  Check,
  CheckCheck,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Reply,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { DirectChatMessageView } from "@/lib/direct-chat-message-view";
import { directChatReplySnippet } from "@/lib/direct-chat-reply-snippet";
import {
  formatDirectChatFileSize,
  isDirectChatImageMime,
  isDirectChatVideoMime,
} from "@/lib/direct-chat-attachments-shared";
import {
  directChatAuthorLabel,
  formatDirectChatClock,
} from "@/lib/direct-chat-format";
import { ChatLinkifiedText } from "@/components/chat-linkified-text";
import { DirectChatFileBadge } from "@/components/direct-chat/direct-chat-file-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Ukuran khusus isi percakapan (sedikit lebih kecil dari UI sekitar, tapi terbaca nyaman). */
const chatText = "text-[13.5px] leading-relaxed";
const chatMeta = "text-[11px] leading-snug";

const actionButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-3";

async function copyMessageText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Teks pesan disalin.");
  } catch {
    toast.error("Browser menolak akses clipboard.");
  }
}

/**
 * `memo` di sini penting untuk performa: daftar pesan bisa berisi ratusan
 * gelembung, dan setiap poll (2,5 detik) mengganti identitas array `messages`.
 * Tanpa memo, satu pesan baru memaksa render ulang seluruh riwayat — termasuk
 * puluhan `DropdownMenu` — sehingga main thread tersendat dan ketikan di
 * composer terasa delay.
 *
 * Percakapan ini selalu 1:1, jadi posisi kiri/kanan sudah menjelaskan siapa
 * pengirimnya — avatar & nama sengaja tidak diulang di tiap gelembung.
 */
export const DirectChatMessageBubble = memo(function DirectChatMessageBubble({
  message: m,
  own,
  readReceipt,
  highlighted = false,
  onReply,
  onEdit,
  onDelete,
  onScrollToReply,
  onOpenImage,
  compact = false,
}: {
  message: DirectChatMessageView;
  own: boolean;
  readReceipt?: "read" | "unread" | null;
  /** Pesan tujuan lompatan (hasil cari / arsip / kutipan) — diberi cincin sesaat. */
  highlighted?: boolean;
  onReply: (message: DirectChatMessageView) => void;
  onEdit: (message: DirectChatMessageView) => void;
  onDelete: (messageId: string) => void;
  onScrollToReply?: (id: string) => void;
  onOpenImage?: (attachmentId: string) => void;
  compact?: boolean;
}) {
  const deleted = Boolean(m.deletedAt);
  const hasText = Boolean(m.body.trim());
  const images = m.attachments.filter((a) => isDirectChatImageMime(a.mimeType));
  const videos = m.attachments.filter((a) => isDirectChatVideoMime(a.mimeType));
  const files = m.attachments.filter(
    (a) => !isDirectChatImageMime(a.mimeType) && !isDirectChatVideoMime(a.mimeType),
  );

  const meta = (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 text-[10px] leading-none tabular-nums",
        own ? "text-primary-foreground/70" : "text-muted-foreground",
      )}
    >
      {m.editedAt && !deleted ? <span className="italic">diedit</span> : null}
      <time dateTime={m.createdAt}>{formatDirectChatClock(m.createdAt)}</time>
    </span>
  );

  return (
    <div
      className={cn(
        "group/msg flex flex-col",
        own ? "items-end" : "items-start",
        compact ? "mt-0" : "mt-2",
      )}
    >
      <div
        className={cn(
          "flex max-w-[88%] items-start gap-1 sm:max-w-[min(78%,40rem)]",
          own ? "flex-row-reverse" : "flex-row",
        )}
      >
        <div
          className={cn(
            "min-w-0 rounded-[1.15rem] p-1 transition-shadow duration-500",
            chatText,
            own
              ? "bg-primary text-primary-foreground"
              : "border-border bg-card text-card-foreground border",
            !compact && (own ? "rounded-tr-md" : "rounded-tl-md"),
            deleted && "opacity-70",
            highlighted &&
              "ring-ring ring-offset-background ring-2 ring-offset-2",
          )}
        >
          {m.replyTo ? (
            <button
              type="button"
              onClick={() => onScrollToReply?.(m.replyTo!.id)}
              className={cn(
                "mb-0.5 block w-full rounded-[0.9rem] border-l-[3px] px-2.5 py-1.5 text-left transition-colors",
                own
                  ? "border-primary-foreground/60 bg-primary-foreground/12 hover:bg-primary-foreground/20"
                  : "border-primary/50 bg-muted/60 hover:bg-muted",
              )}
            >
              <span className={cn("block font-semibold", chatMeta)}>
                {directChatAuthorLabel(
                  m.replyTo.author.name,
                  m.replyTo.author.email,
                )}
              </span>
              <span
                className={cn(
                  "block truncate",
                  chatMeta,
                  own ? "text-primary-foreground/75" : "text-muted-foreground",
                )}
              >
                {directChatReplySnippet({
                  body: m.replyTo.body,
                  gifUrl: m.replyTo.gifUrl,
                  deletedAt: m.replyTo.deletedAt,
                  attachmentCount: m.replyTo.attachmentCount,
                })}
              </span>
            </button>
          ) : null}

          {deleted ? (
            <p className="flex items-end gap-3 px-2.5 py-1 italic">
              <span className="min-w-0 flex-1">Pesan dihapus</span>
              {meta}
            </p>
          ) : (
            <>
              {images.length > 0 ? (
                <div
                  className={cn(
                    "grid gap-0.5 overflow-hidden rounded-[0.9rem]",
                    images.length > 1 ? "grid-cols-2" : "grid-cols-1",
                  )}
                >
                  {images.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onOpenImage?.(a.id)}
                      className="focus-visible:ring-ring/60 block outline-none focus-visible:ring-3"
                      aria-label={`Lihat gambar ${a.fileName}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.publicPath}
                        alt={a.fileName}
                        className={cn(
                          "w-full object-cover",
                          images.length > 1 ? "aspect-square" : "max-h-80",
                        )}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              {m.gifUrl ? (
                <div className="overflow-hidden rounded-[0.9rem]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.gifUrl}
                    alt="GIF"
                    className="max-h-56 w-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ) : null}
              {videos.map((a) => (
                <video
                  key={a.id}
                  src={a.publicPath}
                  controls
                  preload="metadata"
                  className="mt-0.5 max-h-80 w-full rounded-[0.9rem] bg-black first:mt-0"
                />
              ))}
              {files.length > 0 ? (
                <ul className="space-y-0.5">
                  {files.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={a.fileName}
                        className={cn(
                          "flex min-w-52 items-center gap-2.5 rounded-[0.9rem] px-2 py-1.5 transition-colors",
                          own
                            ? "bg-primary-foreground/12 hover:bg-primary-foreground/20"
                            : "bg-muted/60 hover:bg-muted",
                        )}
                      >
                        <DirectChatFileBadge
                          fileName={a.fileName}
                          mimeType={a.mimeType}
                          className={own ? "bg-primary-foreground text-primary" : undefined}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {a.fileName}
                          </span>
                          <span
                            className={cn(
                              chatMeta,
                              own
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatDirectChatFileSize(a.sizeBytes)}
                          </span>
                        </span>
                        <Download className="mr-1 size-3.5 shrink-0 opacity-70" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-end justify-end gap-x-3 gap-y-0.5 px-2.5 pt-1 pb-1">
                {hasText ? (
                  <ChatLinkifiedText
                    text={m.body}
                    className="min-w-0 grow"
                    linkClassName={
                      own
                        ? "text-primary-foreground hover:text-primary-foreground/80 dark:text-primary-foreground dark:hover:text-primary-foreground/80"
                        : undefined
                    }
                  />
                ) : null}
                {meta}
              </div>
            </>
          )}
        </div>

        {!deleted ? (
          <div
            className={cn(
              "flex shrink-0 items-center pt-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100",
              own ? "flex-row-reverse" : "flex-row",
            )}
          >
            <button
              type="button"
              className={cn(actionButton, "[@media(hover:none)]:hidden")}
              onClick={() => onReply(m)}
              aria-label="Balas pesan"
              title="Balas"
            >
              <Reply className="size-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className={actionButton} aria-label="Aksi pesan">
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align={own ? "end" : "start"}>
                <DropdownMenuItem onClick={() => onReply(m)}>
                  <Reply className="size-3.5" />
                  Balas
                </DropdownMenuItem>
                {hasText ? (
                  <DropdownMenuItem onClick={() => void copyMessageText(m.body)}>
                    <Copy className="size-3.5" />
                    Salin teks
                  </DropdownMenuItem>
                ) : null}
                {own ? (
                  <>
                    <DropdownMenuItem onClick={() => onEdit(m)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(m.id)}
                    >
                      <Trash2 className="size-3.5" />
                      Hapus
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {own && readReceipt && !deleted ? (
        <span
          className={cn(
            "mt-1 mr-1 flex items-center gap-1 font-medium",
            chatMeta,
            readReceipt === "read" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {readReceipt === "read" ? (
            <>
              <CheckCheck className="size-3.5" aria-hidden />
              Dibaca
            </>
          ) : (
            <>
              <Check className="size-3.5" aria-hidden />
              Terkirim
            </>
          )}
        </span>
      ) : null}
    </div>
  );
});
