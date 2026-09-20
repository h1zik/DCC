"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  MessageSquareText,
  Paperclip,
  Play,
  Search,
  X,
} from "lucide-react";
import type {
  DirectChatSearchHit,
  DirectChatSearchPage,
  DirectChatSharedAttachment,
  DirectChatSharedItem,
  DirectChatSharedKind,
  DirectChatSharedLink,
  DirectChatSharedPage,
} from "@/lib/direct-chat-shared";
import {
  formatDirectChatFileSize,
  isDirectChatImageMime,
} from "@/lib/direct-chat-attachments-shared";
import {
  formatDirectChatDate,
  formatDirectChatMonth,
} from "@/lib/direct-chat-format";
import type { DirectChatLightboxImage } from "@/components/direct-chat/direct-chat-lightbox";
import { DirectChatFileBadge } from "@/components/direct-chat/direct-chat-file-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type DirectChatArchiveTab = "search" | DirectChatSharedKind;

/** Sama dengan `DIRECT_CHAT_SEARCH_MIN_QUERY` di server. */
const SEARCH_MIN_QUERY = 2;

const jumpButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3";

type PanelContext = {
  conversationId: string;
  currentUserId: string;
  /** Nama depan lawan bicara, untuk keterangan pengirim yang ringkas. */
  peerShortName: string;
  onJump: (messageId: string) => void;
};

function senderLabel(ctx: PanelContext, authorId: string) {
  return authorId === ctx.currentUserId ? "Anda" : ctx.peerShortName;
}

function groupByMonth<T extends { createdAt: string }>(items: T[]) {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = formatDirectChatMonth(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/**
 * Satu bulan di arsip. Garis vertikal + titik membentuk rel waktu yang
 * menyambung antarbulan, jadi posisi sebuah berkas di riwayat terbaca sekilas.
 */
function MonthGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative pl-5">
      <span className="bg-border absolute top-4 bottom-0 left-[5px] w-px" aria-hidden />
      <h3 className="bg-card sticky top-0 z-[1] py-2 text-xs font-semibold">
        <span
          className="bg-primary ring-card absolute top-1/2 -left-5 ml-[2px] size-[7px] -translate-y-1/2 rounded-full ring-4"
          aria-hidden
        />
        {label}
      </h3>
      <div className="pb-4">{children}</div>
    </section>
  );
}

function PaneMessage({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-2 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {body ? (
        <p className="text-muted-foreground mx-auto mt-1 max-w-[30ch] text-xs leading-relaxed">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cari                                                                */
/* ------------------------------------------------------------------ */

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Potongan teks di sekitar kecocokan pertama, dengan kecocokan disorot. */
function HighlightedExcerpt({ text, query }: { text: string; query: string }) {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  const start = at > 48 ? at - 36 : 0;
  const excerpt = `${start > 0 ? "…" : ""}${flat.slice(start, start + 150)}${
    flat.length > start + 150 ? "…" : ""
  }`;
  const parts = excerpt.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-accent text-accent-foreground rounded-[3px] px-0.5 font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function SearchHitRow({
  hit,
  query,
  ctx,
}: {
  hit: DirectChatSearchHit;
  query: string;
  ctx: PanelContext;
}) {
  const needle = query.toLowerCase();
  const bodyMatches = hit.body.toLowerCase().includes(needle);
  const matchedFile = hit.attachmentNames.find((n) =>
    n.toLowerCase().includes(needle),
  );
  return (
    <li>
      <button
        type="button"
        onClick={() => ctx.onJump(hit.id)}
        className="hover:bg-muted/70 focus-visible:ring-ring/50 block w-full rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-3"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold">
            {senderLabel(ctx, hit.author.id)}
          </span>
          <time
            dateTime={hit.createdAt}
            className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
          >
            {formatDirectChatDate(hit.createdAt)}
          </time>
        </span>
        {bodyMatches || !matchedFile ? (
          <span className="text-muted-foreground mt-0.5 line-clamp-3 text-[13px] leading-snug break-words">
            <HighlightedExcerpt text={hit.body} query={query} />
          </span>
        ) : null}
        {matchedFile ? (
          <span className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <Paperclip className="size-3 shrink-0" aria-hidden />
            <span className="truncate">
              <HighlightedExcerpt text={matchedFile} query={query} />
            </span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

function SearchPane({
  ctx,
  query,
  onQueryChange,
  focusToken,
}: {
  ctx: PanelContext;
  query: string;
  onQueryChange: (value: string) => void;
  /** Naik tiap kali pencarian diminta dari luar (tombol header / Ctrl+F). */
  focusToken: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const searchable = q.length >= SEARCH_MIN_QUERY;

  const [result, setResult] = useState<{
    q: string;
    hits: DirectChatSearchHit[];
    nextCursor: string | null;
    failed: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  /** Ditunda sejenak: sheet/tab memindahkan fokus sendiri saat baru terbuka. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(t);
  }, [focusToken]);

  const { conversationId } = ctx;
  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/direct-chat/${conversationId}/search?q=${encodeURIComponent(q)}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const page = (await res.json()) as DirectChatSearchPage;
        setResult({ q, ...page, failed: false });
      } catch {
        if (controller.signal.aborted) return;
        setResult({ q, hits: [], nextCursor: null, failed: true });
      }
    }, 300);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [conversationId, q, searchable, retryToken]);

  /** Hasil milik kueri lama tidak pernah ditampilkan untuk kueri baru. */
  const current = searchable && result?.q === q ? result : null;

  async function loadMore() {
    if (!current?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/direct-chat/${conversationId}/search?q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(current.nextCursor)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const page = (await res.json()) as DirectChatSearchPage;
      setResult((prev) =>
        prev && prev.q === q
          ? {
              ...prev,
              hits: [...prev.hits, ...page.hits],
              nextCursor: page.nextCursor,
            }
          : prev,
      );
    } catch {
      /* tombol tetap tersedia untuk dicoba lagi */
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 px-3 pb-2">
        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-5.5 size-3.5" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cari kata atau nama file…"
          aria-label="Cari di percakapan ini"
          className="bg-background h-9 rounded-full pr-8 pl-8 text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground absolute top-2 right-5 inline-flex size-5 items-center justify-center rounded-full"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
            aria-label="Hapus pencarian"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-3"
        aria-live="polite"
      >
        {!searchable ? (
          <PaneMessage
            title="Cari di seluruh riwayat"
            body="Pesan lama ikut dicari, termasuk nama file lampiran. Ketik minimal 2 huruf."
          />
        ) : !current ? (
          <ul className="space-y-3 px-2.5 pt-2" aria-label="Mencari…">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
              </li>
            ))}
          </ul>
        ) : current.failed ? (
          <PaneMessage
            title="Pencarian gagal dimuat"
            body="Periksa koneksi, lalu coba lagi."
            action={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setRetryToken((n) => n + 1);
                }}
              >
                Coba lagi
              </Button>
            }
          />
        ) : current.hits.length === 0 ? (
          <PaneMessage
            title={`Tidak ada pesan yang memuat "${q}"`}
            body="Coba kata lain atau potongan kata yang lebih pendek."
          />
        ) : (
          <>
            <ul>
              {current.hits.map((hit) => (
                <SearchHitRow key={hit.id} hit={hit} query={q} ctx={ctx} />
              ))}
            </ul>
            {current.nextCursor ? (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Memuat…" : "Tampilkan hasil lebih lama"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Media / File / Tautan                                               */
/* ------------------------------------------------------------------ */

const EMPTY_COPY: Record<DirectChatSharedKind, { title: string; body: string }> = {
  media: {
    title: "Belum ada foto atau video",
    body: "Gambar dan video yang dikirim di chat ini terkumpul di sini.",
  },
  files: {
    title: "Belum ada file",
    body: "Dokumen yang dikirim di chat ini terkumpul di sini, jadi tidak perlu menggulir untuk mencarinya.",
  },
  links: {
    title: "Belum ada tautan",
    body: "Tautan yang dibagikan di chat ini terkumpul di sini.",
  },
};

function MediaTile({
  item,
  ctx,
  onOpen,
}: {
  item: DirectChatSharedAttachment;
  ctx: PanelContext;
  onOpen: () => void;
}) {
  const isImage = isDirectChatImageMime(item.mimeType);
  const tile =
    "bg-muted focus-visible:ring-ring/60 relative block aspect-square w-full overflow-hidden rounded-md outline-none focus-visible:ring-3";
  return (
    <li className="group/tile relative">
      {isImage ? (
        <button
          type="button"
          className={tile}
          onClick={onOpen}
          aria-label={`Lihat gambar ${item.fileName}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.publicPath}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-200 group-hover/tile:scale-105 motion-reduce:transition-none"
          />
        </button>
      ) : (
        <a
          href={item.publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(tile, "flex flex-col items-center justify-center gap-1 bg-black p-1.5 text-white")}
          aria-label={`Buka video ${item.fileName}`}
        >
          <Play className="size-5 fill-current" aria-hidden />
          <span className="w-full truncate text-center text-[10px] text-white/70">
            {item.fileName}
          </span>
        </a>
      )}
      <button
        type="button"
        onClick={() => ctx.onJump(item.messageId)}
        className="absolute right-1 bottom-1 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 outline-none transition-opacity group-hover/tile:opacity-100 hover:bg-black/80 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-white/70 [@media(hover:none)]:opacity-100"
        aria-label="Lihat di chat"
        title="Lihat di chat"
      >
        <MessageSquareText className="size-3.5" />
      </button>
    </li>
  );
}

function FileRow({
  item,
  ctx,
}: {
  item: DirectChatSharedAttachment;
  ctx: PanelContext;
}) {
  return (
    <li className="hover:bg-muted/70 -ml-1.5 flex items-center gap-1 rounded-lg pr-1 transition-colors">
      <a
        href={item.publicPath}
        target="_blank"
        rel="noopener noreferrer"
        download={item.fileName}
        className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 pl-1.5 outline-none focus-visible:ring-3"
      >
        <DirectChatFileBadge fileName={item.fileName} mimeType={item.mimeType} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">
            {item.fileName}
          </span>
          <span className="text-muted-foreground flex justify-between gap-2 text-[11px] tabular-nums">
            <span>{formatDirectChatFileSize(item.sizeBytes)}</span>
            <span className="truncate">
              {senderLabel(ctx, item.authorId)}, {formatDirectChatDate(item.createdAt)}
            </span>
          </span>
        </span>
        <Download className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      </a>
      <button
        type="button"
        onClick={() => ctx.onJump(item.messageId)}
        className={jumpButton}
        aria-label={`Lihat ${item.fileName} di chat`}
        title="Lihat di chat"
      >
        <MessageSquareText className="size-3.5" />
      </button>
    </li>
  );
}

function splitHref(href: string) {
  try {
    const url = new URL(href);
    const rest = `${url.pathname}${url.search}`.replace(/\/$/, "");
    return { host: url.hostname.replace(/^www\./, ""), rest };
  } catch {
    return { host: href, rest: "" };
  }
}

function LinkRow({ item, ctx }: { item: DirectChatSharedLink; ctx: PanelContext }) {
  const { host, rest } = splitHref(item.href);
  const showContext = item.context.replace(/\s+/g, "") !== item.href.replace(/\s+/g, "");
  return (
    <li className="hover:bg-muted/70 -ml-1.5 flex items-start gap-1 rounded-lg pr-1 transition-colors">
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-visible:ring-ring/50 min-w-0 flex-1 rounded-lg py-2 pl-1.5 outline-none focus-visible:ring-3"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold">{host}</span>
          <ExternalLink className="text-muted-foreground size-3 shrink-0" aria-hidden />
        </span>
        {rest ? (
          <span className="text-muted-foreground block truncate text-xs">{rest}</span>
        ) : null}
        {showContext ? (
          <span className="text-muted-foreground/90 border-border mt-1 line-clamp-2 block border-l-2 pl-2 text-xs leading-snug break-words">
            {item.context}
          </span>
        ) : null}
        <span className="text-muted-foreground mt-1 block text-[11px] tabular-nums">
          {senderLabel(ctx, item.authorId)}, {formatDirectChatDate(item.createdAt)}
        </span>
      </a>
      <button
        type="button"
        onClick={() => ctx.onJump(item.messageId)}
        className={cn(jumpButton, "mt-1")}
        aria-label="Lihat tautan ini di chat"
        title="Lihat di chat"
      >
        <MessageSquareText className="size-3.5" />
      </button>
    </li>
  );
}

function SharedPane({
  kind,
  ctx,
  refreshToken,
  onOpenImages,
}: {
  kind: DirectChatSharedKind;
  ctx: PanelContext;
  /** Berubah saat ada pesan baru — halaman pertama dimuat ulang diam-diam. */
  refreshToken: string | null;
  onOpenImages: (images: DirectChatLightboxImage[], index: number) => void;
}) {
  const { conversationId } = ctx;
  const [state, setState] = useState<{
    items: DirectChatSharedItem[];
    nextCursor: string | null;
    status: "loading" | "ready" | "failed";
  }>({ items: [], nextCursor: null, status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  /** Setelah pengguna memuat halaman lanjutan, refresh diam-diam dihentikan. */
  const extendedRef = useRef(false);

  useEffect(() => {
    if (extendedRef.current) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/direct-chat/${conversationId}/shared?kind=${kind}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const page = (await res.json()) as DirectChatSharedPage;
        if (extendedRef.current) return;
        setState({ ...page, status: "ready" });
      } catch {
        if (controller.signal.aborted) return;
        setState((prev) =>
          prev.status === "ready" ? prev : { ...prev, status: "failed" },
        );
      }
    })();
    return () => controller.abort();
  }, [conversationId, kind, refreshToken, retryToken]);

  async function loadMore() {
    if (!state.nextCursor || loadingMore) return;
    extendedRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/direct-chat/${conversationId}/shared?kind=${kind}&cursor=${encodeURIComponent(state.nextCursor)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const page = (await res.json()) as DirectChatSharedPage;
      setState((prev) => ({
        items: [...prev.items, ...page.items],
        nextCursor: page.nextCursor,
        status: "ready",
      }));
    } catch {
      /* tombol tetap tersedia untuk dicoba lagi */
    } finally {
      setLoadingMore(false);
    }
  }

  const groups = useMemo(() => groupByMonth(state.items), [state.items]);

  const lightboxImages = useMemo<DirectChatLightboxImage[]>(
    () =>
      state.items.flatMap((item) =>
        item.type === "attachment" && isDirectChatImageMime(item.mimeType)
          ? [
              {
                id: item.id,
                src: item.publicPath,
                fileName: item.fileName,
                messageId: item.messageId,
              },
            ]
          : [],
      ),
    [state.items],
  );

  if (state.status === "loading") {
    return (
      <div className="px-4 pt-3" aria-label="Memuat…">
        {kind === "media" ? (
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <PaneMessage
        title="Arsip gagal dimuat"
        body="Periksa koneksi, lalu coba lagi."
        action={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setState({ items: [], nextCursor: null, status: "loading" });
              setRetryToken((n) => n + 1);
            }}
          >
            Coba lagi
          </Button>
        }
      />
    );
  }

  if (state.items.length === 0 && !state.nextCursor) {
    return <PaneMessage {...EMPTY_COPY[kind]} />;
  }

  return (
    <div className="px-3 pb-3">
      {groups.map((group) => (
        <MonthGroup key={group.label} label={group.label}>
          {kind === "media" ? (
            <ul className="grid grid-cols-3 gap-1">
              {group.items.map((item) =>
                item.type === "attachment" ? (
                  <MediaTile
                    key={item.id}
                    item={item}
                    ctx={ctx}
                    onOpen={() =>
                      onOpenImages(
                        lightboxImages,
                        Math.max(
                          0,
                          lightboxImages.findIndex((img) => img.id === item.id),
                        ),
                      )
                    }
                  />
                ) : null,
              )}
            </ul>
          ) : (
            <ul className="space-y-0.5">
              {group.items.map((item) =>
                item.type === "link" ? (
                  <LinkRow key={item.id} item={item} ctx={ctx} />
                ) : (
                  <FileRow key={item.id} item={item} ctx={ctx} />
                ),
              )}
            </ul>
          )}
        </MonthGroup>
      ))}
      {state.nextCursor ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-full"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Memuat…" : "Tampilkan yang lebih lama"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

const TABS: { value: DirectChatArchiveTab; label: string }[] = [
  { value: "search", label: "Cari" },
  { value: "media", label: "Media" },
  { value: "files", label: "File" },
  { value: "links", label: "Tautan" },
];

/**
 * Arsip percakapan: cari isi chat dan lihat semua media, file, serta tautan
 * yang pernah dikirim — tanpa menggulir riwayat. Tiap entri bisa melompat ke
 * pesan asalnya.
 */
export function DirectChatArchivePanel({
  conversationId,
  currentUserId,
  peerLabel,
  tab,
  onTabChange,
  onClose,
  onJump,
  onOpenImages,
  refreshToken,
  searchFocusToken,
  className,
}: {
  conversationId: string;
  currentUserId: string;
  peerLabel: string;
  tab: DirectChatArchiveTab;
  onTabChange: (tab: DirectChatArchiveTab) => void;
  onClose: () => void;
  onJump: (messageId: string) => void;
  onOpenImages: (images: DirectChatLightboxImage[], index: number) => void;
  refreshToken: string | null;
  searchFocusToken: number;
  className?: string;
}) {
  /** Kueri disimpan di sini agar tidak hilang saat berpindah tab. */
  const [query, setQuery] = useState("");

  const ctx = useMemo<PanelContext>(
    () => ({
      conversationId,
      currentUserId,
      peerShortName: peerLabel.split(/[\s@]/)[0] || peerLabel,
      onJump,
    }),
    [conversationId, currentUserId, peerLabel, onJump],
  );

  const handleTabChange = useCallback(
    (value: unknown) => onTabChange(value as DirectChatArchiveTab),
    [onTabChange],
  );

  return (
    <div className={cn("bg-card flex h-full min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">Arsip percakapan</h2>
          <p className="text-muted-foreground truncate text-xs">
            dengan {peerLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Tutup arsip"
        >
          <X className="size-4" />
        </Button>
      </div>
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList variant="line" className="border-border w-full shrink-0 justify-start border-b px-3">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-none px-2.5 text-[13px]">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="search" className="flex min-h-0 flex-col pt-3">
          <SearchPane
            ctx={ctx}
            query={query}
            onQueryChange={setQuery}
            focusToken={searchFocusToken}
          />
        </TabsContent>
        {(["media", "files", "links"] as const).map((kind) => (
          <TabsContent
            key={kind}
            value={kind}
            className="min-h-0 overflow-y-auto overscroll-contain pt-1"
          >
            <SharedPane
              key={`${conversationId}:${kind}`}
              kind={kind}
              ctx={ctx}
              refreshToken={refreshToken}
              onOpenImages={onOpenImages}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
