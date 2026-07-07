"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Music,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import { cn } from "@/lib/utils";
import { extractDocxTextFromUrl, isDocxMime } from "@/lib/docx-client-text";
import {
  type AttachmentCommentAnchor,
  type TextAnchor,
  buildCanonicalPdfText,
  clampRect,
  getPdfLeafSpans,
  getPdfSpanTexts,
  parseAttachmentCommentAnchor,
  resolveTextAnchorOffsets,
  textAnchorFromSelection,
  textHighlightSpans,
} from "@/lib/attachment-comment-anchor";

const EXTERNAL_LINK_MIME = "text/x-task-external-url";

if (typeof window !== "undefined") {
  // Worker dibundel lokal — CDN eksternal gagal saat offline/firewall.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

export type AnchoredCommentPin = {
  id: string;
  body: string;
  selectedText: string | null;
  anchorPage: number | null;
  anchorJson: string | null;
  resolvedAt: Date | string | null;
  createdAt?: Date | string;
};

export type PendingSelection = {
  anchor: AttachmentCommentAnchor;
  quote: string;
  clientRect: { top: number; left: number; width: number; height: number };
};

export type PreviewAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  publicPath: string | null;
  linkUrl: string | null;
  /** Thumbnail WebP for progressive image preview (Documents module). */
  thumbPath?: string | null;
};

type RegionPin = {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  resolved: boolean;
  active: boolean;
};

type HighlightSegment = ReturnType<typeof textHighlightSpans>[number];

function isHighlightSpan(
  seg: HighlightSegment,
): seg is Exclude<HighlightSegment, { type: "text"; value: string }> {
  return !("type" in seg);
}

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

/** SVG has no generated thumb and often needs a light canvas + explicit sizing. */
function isSvgImage(mime: string, fileName: string) {
  const lower = mime.toLowerCase();
  if (lower === "image/svg+xml" || lower === "image/svg") return true;
  return fileName.toLowerCase().endsWith(".svg");
}

/** Upscale tiny assets (SVG icons, small PNG) so preview is readable. */
const PREVIEW_SMALL_IMAGE_MAX_EDGE = 240;

function shouldUpscalePreviewImage(
  svgPreview: boolean,
  naturalWidth: number,
  naturalHeight: number,
) {
  if (svgPreview) return true;
  const maxEdge = Math.max(naturalWidth, naturalHeight);
  return maxEdge > 0 && maxEdge < PREVIEW_SMALL_IMAGE_MAX_EDGE;
}

function isTextMime(mime: string) {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml"
  );
}

/** Ensures preview children fill the dialog pane and can shrink (flex min-h-0). */
function PreviewFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

function usePreloadImageSources(sources: string[]) {
  const key = sources.join("\0");
  useEffect(() => {
    const unique = [...new Set(sources.filter(Boolean))];
    const images: HTMLImageElement[] = [];
    for (const src of unique) {
      const img = new window.Image();
      img.decoding = "async";
      img.src = src;
      images.push(img);
    }
    return () => {
      for (const img of images) {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      }
    };
  }, [key, sources]);
}

function useTextAnchorMeta(
  comments: AnchoredCommentPin[],
  activeCommentId: string | null,
) {
  return useMemo(
    () =>
      comments.flatMap((c) => {
        const anchor = parseAttachmentCommentAnchor(c.anchorJson);
        if (!anchor || anchor.kind !== "text") return [];
        return [
          {
            id: c.id,
            anchor,
            resolved: Boolean(c.resolvedAt),
            active: c.id === activeCommentId,
          },
        ];
      }),
    [comments, activeCommentId],
  );
}

function useRegionPins(
  comments: AnchoredCommentPin[],
  activeCommentId: string | null,
): RegionPin[] {
  return useMemo(
    () =>
      comments.flatMap((c) => {
        const anchor = parseAttachmentCommentAnchor(c.anchorJson);
        if (!anchor || anchor.kind !== "region") return [];
        return [
          {
            id: c.id,
            rect: anchor.rect,
            resolved: Boolean(c.resolvedAt),
            active: c.id === activeCommentId,
          },
        ];
      }),
    [comments, activeCommentId],
  );
}

function selectionToPending(
  anchor: AttachmentCommentAnchor,
  quote: string,
): PendingSelection {
  const sel = window.getSelection();
  const rect =
    sel && sel.rangeCount > 0
      ? sel.getRangeAt(0).getBoundingClientRect()
      : { top: 0, left: 0, width: 0, height: 0 };
  return {
    anchor,
    quote,
    clientRect: {
      top: rect.top,
      left: rect.left + rect.width / 2,
      width: rect.width,
      height: rect.height,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Region drag (shared: PDF page + image)                              */
/* ------------------------------------------------------------------ */

function startRegionDrag(
  e: React.PointerEvent,
  boundsEl: HTMLElement,
  onComplete: (
    rect: { x: number; y: number; w: number; h: number },
    ev: PointerEvent,
  ) => void,
) {
  const startX = e.clientX;
  const startY = e.clientY;
  const bounds = boundsEl.getBoundingClientRect();
  const overlay = boundsEl.querySelector(
    "[data-draft-region]",
  ) as HTMLElement | null;
  let moved = false;

  const onMove = (ev: PointerEvent) => {
    if (
      !moved &&
      Math.abs(ev.clientX - startX) < 3 &&
      Math.abs(ev.clientY - startY) < 3
    ) {
      return; // abaikan jitter klik biasa
    }
    moved = true;
    if (overlay) {
      const x0 = Math.min(startX, ev.clientX) - bounds.left;
      const y0 = Math.min(startY, ev.clientY) - bounds.top;
      overlay.style.left = `${(x0 / bounds.width) * 100}%`;
      overlay.style.top = `${(y0 / bounds.height) * 100}%`;
      overlay.style.width = `${(Math.abs(ev.clientX - startX) / bounds.width) * 100}%`;
      overlay.style.height = `${(Math.abs(ev.clientY - startY) / bounds.height) * 100}%`;
      overlay.style.display = "block";
    }
  };

  const onUp = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (overlay) overlay.style.display = "none";
    if (!moved) return;
    onComplete(
      clampRect({
        x: (Math.min(startX, ev.clientX) - bounds.left) / bounds.width,
        y: (Math.min(startY, ev.clientY) - bounds.top) / bounds.height,
        w: Math.abs(ev.clientX - startX) / bounds.width,
        h: Math.abs(ev.clientY - startY) / bounds.height,
      }),
      ev,
    );
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function RegionPinButtons({
  pins,
  onCommentPinClick,
}: {
  pins: RegionPin[];
  onCommentPinClick: (id: string) => void;
}) {
  return (
    <>
      {pins.map((pin) => (
        <button
          key={pin.id}
          type="button"
          data-comment-id={pin.id}
          aria-label="Komentar area"
          className={cn(
            "absolute z-10 border-2 transition-colors",
            pin.active
              ? "border-amber-600 bg-amber-400/40"
              : pin.resolved
                ? "border-muted-foreground/40 bg-muted/30"
                : "border-amber-500 bg-amber-300/35 hover:bg-amber-300/50",
          )}
          style={{
            left: `${pin.rect.x * 100}%`,
            top: `${pin.rect.y * 100}%`,
            width: `${pin.rect.w * 100}%`,
            height: `${pin.rect.h * 100}%`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onCommentPinClick(pin.id);
          }}
        />
      ))}
    </>
  );
}

function DraftRegionOverlay() {
  return (
    <div
      data-draft-region
      className="pointer-events-none absolute z-10 hidden border-2 border-amber-500 bg-amber-300/25"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Text & DOCX preview (satu komponen, loader berbeda)                 */
/* ------------------------------------------------------------------ */

async function loadPlainText(src: string): Promise<string> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Gagal memuat file.");
  return res.text();
}

function SelectableTextPreview({
  src,
  kind,
  fileName,
  comments,
  activeCommentId,
  commentMode,
  onPendingSelection,
  onCommentPinClick,
}: {
  src: string;
  kind: "text" | "docx";
  fileName: string;
  comments: AnchoredCommentPin[];
  activeCommentId: string | null;
  commentMode: boolean;
  onPendingSelection: (sel: PendingSelection | null) => void;
  onCommentPinClick: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<{
    src: string;
    status: "loading" | "ready" | "error";
    text: string;
  }>({ src, status: "loading", text: "" });

  // Reset saat sumber berganti — pola "adjust state during render".
  if (load.src !== src) {
    setLoad({ src, status: "loading", text: "" });
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loader = kind === "docx" ? extractDocxTextFromUrl : loadPlainText;
    void (async () => {
      try {
        if (kind === "text") {
          const res = await fetch(src, { signal: controller.signal });
          if (!res.ok) throw new Error("Gagal memuat file.");
          const body = await res.text();
          if (!cancelled) setLoad({ src, status: "ready", text: body });
          return;
        }
        const body = await loader(src);
        if (!cancelled) setLoad({ src, status: "ready", text: body });
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setLoad({ src, status: "error", text: "" });
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [src, kind]);

  const text = load.text;
  const loading = load.status === "loading";
  const failed = load.status === "error";

  const anchorMeta = useTextAnchorMeta(
    commentMode ? comments : [],
    commentMode ? activeCommentId : null,
  );
  const segments = useMemo(
    () =>
      commentMode
        ? textHighlightSpans(text, anchorMeta)
        : text
          ? [{ type: "text" as const, value: text }]
          : [],
    [text, anchorMeta, commentMode],
  );

  useEffect(() => {
    if (!commentMode || !activeCommentId || !rootRef.current) return;
    rootRef.current
      .querySelector(`[data-comment-id="${activeCommentId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeCommentId, text, commentMode]);

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!commentMode) return;
      const root = rootRef.current;
      if (!root) return;
      const sel = window.getSelection();
      const selected = sel?.toString().trim() ?? "";
      if (!selected) {
        const popover = document.querySelector(
          "[data-anchored-selection-popover]",
        );
        if (
          popover?.contains(e.target as Node) ||
          document.activeElement?.closest("[data-anchored-selection-popover]")
        ) {
          return;
        }
        onPendingSelection(null);
        return;
      }
      const anchor = textAnchorFromSelection(root, text);
      if (!anchor) return;
      onPendingSelection(selectionToPending(anchor, selected));
    },
    [commentMode, onPendingSelection, text],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (failed || !text) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <FileText className="text-muted-foreground size-10" />
        <p className="text-sm font-medium">{fileName}</p>
        <p className="text-muted-foreground text-xs">
          {failed
            ? "Gagal memuat isi file."
            : "File tidak berisi teks yang bisa dipilih."}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "h-full overflow-auto text-sm leading-relaxed whitespace-pre-wrap select-text",
        kind === "docx" ? "p-6" : "p-4",
      )}
      onMouseUp={commentMode ? onMouseUp : undefined}
    >
      {segments.map((seg, i) =>
        commentMode && isHighlightSpan(seg) ? (
          <mark
            key={`${seg.id}-${seg.start}`}
            data-comment-id={seg.id}
            className={cn(
              "cursor-pointer rounded-sm px-0.5",
              seg.active
                ? "bg-amber-300/70 ring-2 ring-amber-500"
                : seg.resolved
                  ? "bg-muted/70 text-muted-foreground line-through"
                  : "bg-amber-200/60",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onCommentPinClick(seg.id);
            }}
          >
            {text.slice(seg.start, seg.end)}
          </mark>
        ) : (
          <span key={`t-${i}`}>
            {"type" in seg ? seg.value : text.slice(seg.start, seg.end)}
          </span>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PDF — stabilo painting                                              */
/* ------------------------------------------------------------------ */

type PdfSpanHighlightRange = {
  start: number;
  end: number;
  id: string;
  active: boolean;
  resolved: boolean;
};

/** Warna stabilo transparan — teks tetap dari canvas PDF di bawahnya. */
function pdfStabiloColor(active: boolean, resolved: boolean) {
  if (active) return "rgba(251, 191, 36, 0.45)";
  if (resolved) return "rgba(160, 160, 160, 0.25)";
  return "rgba(253, 224, 71, 0.35)";
}

function resetPdfSpanHighlightStyles(span: HTMLElement) {
  if (span.hasAttribute("data-comment-id")) {
    span.removeAttribute("data-comment-id");
  }
  span.style.background = "";
  span.style.backgroundColor = "";
  span.style.borderRadius = "";
  span.style.boxShadow = "";
  span.style.cursor = "";
}

let pdfMeasureCtx: CanvasRenderingContext2D | null = null;

/**
 * Fraksi lebar substring diukur dengan font span (canvas measureText).
 * Font PDF proporsional — fraksi berbasis jumlah karakter membuat
 * stabilo terpotong atau melebar.
 */
function measureTextFractions(
  span: HTMLElement,
  text: string,
  start: number,
  end: number,
): { startFrac: number; endFrac: number } {
  const fallback = {
    startFrac: start / text.length,
    endFrac: end / text.length,
  };
  try {
    pdfMeasureCtx ??= document.createElement("canvas").getContext("2d");
    const ctx = pdfMeasureCtx;
    if (!ctx) return fallback;
    const cs = window.getComputedStyle(span);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const total = ctx.measureText(text).width;
    if (!total) return fallback;
    const before = ctx.measureText(text.slice(0, start)).width;
    const width = ctx.measureText(text.slice(start, end)).width;
    return { startFrac: before / total, endFrac: (before + width) / total };
  } catch {
    return fallback;
  }
}

function applyPdfStabiloBackground(
  span: HTMLElement,
  text: string,
  ranges: PdfSpanHighlightRange[],
) {
  if (ranges.length === 0 || text.length === 0) return;

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const primary = sorted.find((r) => r.active) ?? sorted[sorted.length - 1]!;
  const color = pdfStabiloColor(primary.active, primary.resolved);

  span.setAttribute("data-comment-id", primary.id);
  span.style.cursor = "pointer";
  span.style.borderRadius = "2px";

  const fullSpan =
    sorted.length === 1 &&
    sorted[0]!.start === 0 &&
    sorted[0]!.end === text.length;

  if (fullSpan) {
    span.style.backgroundColor = color;
    if (primary.active) {
      span.style.boxShadow = "0 0 0 1px rgba(245, 158, 11, 0.6)";
    }
    return;
  }

  const stops: string[] = [];
  for (const range of sorted) {
    const { startFrac, endFrac } = measureTextFractions(
      span,
      text,
      range.start,
      range.end,
    );
    stops.push(`transparent ${startFrac * 100}%`);
    stops.push(`${color} ${startFrac * 100}%`, `${color} ${endFrac * 100}%`);
    stops.push(`transparent ${endFrac * 100}%`);
  }
  stops.push("transparent 100%");
  span.style.background = `linear-gradient(to right, ${stops.join(", ")})`;
  if (primary.active) {
    span.style.boxShadow = "0 0 0 1px rgba(245, 158, 11, 0.4)";
  }
}

function applyPdfTextHighlights(
  container: HTMLElement,
  fullText: string,
  anchors: {
    id: string;
    anchor: TextAnchor;
    active: boolean;
    resolved: boolean;
  }[],
) {
  const spans = getPdfLeafSpans(container);
  if (spans.length === 0) return;

  const parts = spans.map(
    (span) => span.getAttribute("data-pdf-span-text") ?? span.textContent ?? "",
  );

  for (const span of spans) resetPdfSpanHighlightStyles(span);

  const spanRanges: PdfSpanHighlightRange[][] = spans.map(() => []);

  for (const item of anchors) {
    const resolved = resolveTextAnchorOffsets(fullText, item.anchor);
    if (!resolved) continue;
    let cursor = 0;
    for (let i = 0; i < spans.length; i++) {
      const spanStart = cursor;
      const spanEnd = cursor + parts[i]!.length;
      const overlapStart = Math.max(resolved.start, spanStart);
      const overlapEnd = Math.min(resolved.end, spanEnd);
      if (overlapStart < overlapEnd) {
        spanRanges[i]!.push({
          start: overlapStart - spanStart,
          end: overlapEnd - spanStart,
          id: item.id,
          active: item.active,
          resolved: item.resolved,
        });
      }
      cursor = spanEnd + (i < spans.length - 1 ? 1 : 0);
      if (spanStart > resolved.end) break;
    }
  }

  for (let i = 0; i < spans.length; i++) {
    if (spanRanges[i]!.length === 0) continue;
    applyPdfStabiloBackground(spans[i]!, parts[i]!, spanRanges[i]!);
  }
}

/* ------------------------------------------------------------------ */
/* PDF page                                                            */
/* ------------------------------------------------------------------ */

const PDF_MAX_DPR = 2;

function PdfPage({
  pageNumber,
  pdf,
  pageWidth,
  comments,
  activeCommentId,
  commentMode,
  onPendingSelection,
  onCommentPinClick,
}: {
  pageNumber: number;
  pdf: pdfjs.PDFDocumentProxy;
  pageWidth: number;
  comments: AnchoredCommentPin[];
  activeCommentId: string | null;
  commentMode: boolean;
  onPendingSelection: (sel: PendingSelection | null) => void;
  onCommentPinClick: (id: string) => void;
}) {
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [baseDims, setBaseDims] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [visible, setVisible] = useState(
    () =>
      pageNumber === 1 ||
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined",
  );
  const [pageReady, setPageReady] = useState(false);
  const [text, setText] = useState("");
  // Bertambah setiap text layer selesai dirender ulang (mis. resize) —
  // teks kanonik tidak berubah tapi span DOM baru perlu di-highlight ulang.
  const [renderVersion, setRenderVersion] = useState(0);

  const pageComments = useMemo(
    () => comments.filter((c) => (c.anchorPage ?? 1) === pageNumber),
    [comments, pageNumber],
  );
  const anchorMeta = useTextAnchorMeta(
    commentMode ? pageComments : [],
    commentMode ? activeCommentId : null,
  );
  const regionPins = useRegionPins(
    commentMode ? pageComments : [],
    commentMode ? activeCommentId : null,
  );

  // Halaman dengan komentar aktif dipaksa render agar scroll-to-anchor
  // berfungsi — pola "adjust state during render".
  if (
    commentMode &&
    !visible &&
    activeCommentId &&
    pageComments.some((c) => c.id === activeCommentId)
  ) {
    setVisible(true);
  }

  // Dimensi dasar halaman (murah, tanpa rasterisasi) untuk placeholder.
  useEffect(() => {
    let cancelled = false;
    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const vp = page.getViewport({ scale: 1 });
        setBaseDims({ w: vp.width, h: vp.height });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  // Render malas: canvas baru dirasterisasi saat halaman mendekati viewport.
  useEffect(() => {
    if (visible) return;
    const el = pageBoxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !baseDims || pageWidth <= 0) return;
    let cancelled = false;
    let renderTask: ReturnType<pdfjs.PDFPageProxy["render"]> | null = null;
    let textLayer: InstanceType<typeof pdfjs.TextLayer> | null = null;

    setPageReady(false);

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const scale = pageWidth / baseDims.w;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const textContainer = textLayerRef.current;
        if (!canvas || !textContainer || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, PDF_MAX_DPR);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textContainer.style.width = `${viewport.width}px`;
        textContainer.style.height = `${viewport.height}px`;
        textContainer.style.setProperty("--scale-factor", String(scale));
        textContainer.innerHTML = "";

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await renderTask.promise;
        if (cancelled) return;
        setPageReady(true);

        try {
          const content = await page.getTextContent();
          if (cancelled) return;
          textLayer = new pdfjs.TextLayer({
            textContentSource: content,
            container: textContainer,
            viewport,
          });
          await textLayer.render();
          if (cancelled) return;

          for (const span of getPdfLeafSpans(textContainer)) {
            span.setAttribute("data-pdf-span-text", span.textContent ?? "");
          }
          setText(buildCanonicalPdfText(getPdfSpanTexts(textContainer)));
          setRenderVersion((v) => v + 1);
        } catch {
          // Text layer opsional — canvas sudah tampil, komentar teks mungkin
          // tidak tersedia di halaman ini.
        }
      } catch {
        // Render dibatalkan (scroll cepat / unmount) atau halaman korup.
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, visible, baseDims, pageWidth]);

  useEffect(() => {
    if (!commentMode || !textLayerRef.current || !text) return;
    applyPdfTextHighlights(textLayerRef.current, text, anchorMeta);
  }, [text, anchorMeta, renderVersion, commentMode]);

  useEffect(() => {
    if (!commentMode || !activeCommentId || !pageBoxRef.current) return;
    pageBoxRef.current
      .querySelector(`[data-comment-id="${activeCommentId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeCommentId, text, commentMode]);

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!commentMode) return;
      const root = textLayerRef.current;
      if (!root) return;
      const sel = window.getSelection();
      const selected = sel?.toString().trim() ?? "";
      if (!selected) {
        const popover = document.querySelector(
          "[data-anchored-selection-popover]",
        );
        if (
          popover?.contains(e.target as Node) ||
          document.activeElement?.closest("[data-anchored-selection-popover]")
        ) {
          return;
        }
        onPendingSelection(null);
        return;
      }
      const anchor = textAnchorFromSelection(root, text, pageNumber);
      if (!anchor) return;
      onPendingSelection(
        selectionToPending(
          anchor,
          anchor.kind === "text" ? anchor.selectedText : selected,
        ),
      );
    },
    [commentMode, onPendingSelection, pageNumber, text],
  );

  const onRegionPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!commentMode) return;
      const pageBox = pageBoxRef.current;
      if (!pageBox || e.button !== 0) return;
      // Drag area hanya dari area kosong (bukan teks) agar tidak bentrok
      // dengan seleksi teks. Text layer menutupi canvas, jadi target area
      // kosong = container text layer itu sendiri.
      if (e.target !== textLayerRef.current && e.target !== canvasRef.current) {
        return;
      }
      e.preventDefault();
      startRegionDrag(e, pageBox, (rect, ev) => {
        onPendingSelection({
          anchor: { kind: "region", page: pageNumber, rect },
          quote: `Area halaman ${pageNumber}`,
          clientRect: { top: ev.clientY, left: ev.clientX, width: 0, height: 0 },
        });
      });
    },
    [commentMode, onPendingSelection, pageNumber],
  );

  const placeholderHeight = baseDims
    ? (pageWidth / baseDims.w) * baseDims.h
    : pageWidth * 1.35;

  return (
    <div className="mx-auto mb-6 max-w-full" style={{ width: pageWidth }}>
      <div
        ref={pageBoxRef}
        className={cn(
          "relative bg-white shadow-md",
          commentMode && "touch-none",
        )}
        style={{ minHeight: placeholderHeight }}
        onPointerDown={commentMode ? onRegionPointerDown : undefined}
      >
        {!pageReady ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : null}
        <canvas ref={canvasRef} className="block" />
        <div
          ref={textLayerRef}
          className="textLayer select-text"
          onMouseUp={commentMode ? onMouseUp : undefined}
          onClick={
            commentMode
              ? (e) => {
                  const target = (e.target as HTMLElement).closest(
                    "[data-comment-id]",
                  );
                  if (target) {
                    e.stopPropagation();
                    onCommentPinClick(target.getAttribute("data-comment-id")!);
                  }
                }
              : undefined
          }
        />
        {commentMode ? <DraftRegionOverlay /> : null}
        {commentMode ? (
          <RegionPinButtons
            pins={regionPins}
            onCommentPinClick={onCommentPinClick}
          />
        ) : null}
      </div>
      {commentMode ? (
        <p className="text-muted-foreground mt-1 text-center text-[10px]">
          Halaman {pageNumber} — pilih teks, atau drag area kosong untuk
          komentar area
        </p>
      ) : null}
    </div>
  );
}

const PDF_PAGE_GUTTER = 32;
const PDF_DEFAULT_PAGE_WIDTH = 320;

function PdfSelectablePreview({
  src,
  comments,
  activeCommentId,
  commentMode,
  onPendingSelection,
  onCommentPinClick,
}: {
  src: string;
  comments: AnchoredCommentPin[];
  activeCommentId: string | null;
  commentMode: boolean;
  onPendingSelection: (sel: PendingSelection | null) => void;
  onCommentPinClick: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [docState, setDocState] = useState<{
    src: string;
    pdf: pdfjs.PDFDocumentProxy | null;
    failed: boolean;
  }>({ src, pdf: null, failed: false });
  const [pageWidth, setPageWidth] = useState(PDF_DEFAULT_PAGE_WIDTH);

  // Reset saat sumber berganti — pola "adjust state during render".
  if (docState.src !== src) {
    setDocState({ src, pdf: null, failed: false });
  }

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ url: src, disableAutoFetch: false });
    task.promise
      .then((doc) => {
        if (!cancelled) setDocState({ src, pdf: doc, failed: false });
      })
      .catch(() => {
        if (!cancelled) setDocState({ src, pdf: null, failed: true });
      });
    return () => {
      cancelled = true;
      // destroy() melepas dokumen + worker — tanpa ini preview PDF bocor
      // memori setiap kali dialog dibuka/tutup.
      void task.destroy().catch(() => undefined);
    };
  }, [src]);

  const pdf = docState.pdf;
  const failed = docState.failed;
  const loading = !pdf && !failed;
  const pageCount = pdf?.numPages ?? 0;

  const measurePageWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = Math.max(280, Math.floor(el.clientWidth) - PDF_PAGE_GUTTER);
    // Histeresis kecil agar resize 1-2px tidak memicu render ulang semua
    // halaman.
    setPageWidth((prev) => (Math.abs(prev - next) > 8 ? next : prev));
  }, []);

  useLayoutEffect(() => {
    measurePageWidth();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measurePageWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [src, measurePageWidth]);

  useEffect(() => {
    if (!pdf) return;
    measurePageWidth();
    const id = window.requestAnimationFrame(measurePageWidth);
    return () => window.cancelAnimationFrame(id);
  }, [pdf, measurePageWidth]);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <CircleAlert className="text-destructive size-8" />
        <p className="text-sm font-medium">PDF tidak dapat dimuat</p>
        <p className="text-muted-foreground text-xs">
          File mungkin rusak. Unduh untuk membukanya secara lokal.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto bg-muted/40 p-4">
      {loading || !pdf ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : (
        <>
          {commentMode ? (
            <p className="text-muted-foreground mb-3 text-center text-xs">
              Pilih teks atau drag area kosong pada halaman untuk menambah
              komentar
            </p>
          ) : null}
          {Array.from({ length: pageCount }, (_, i) => i + 1).map(
            (pageNumber) => (
              <PdfPage
                key={pageNumber}
                pageNumber={pageNumber}
                pdf={pdf}
                pageWidth={pageWidth}
                comments={comments}
                activeCommentId={activeCommentId}
                commentMode={commentMode}
                onPendingSelection={onPendingSelection}
                onCommentPinClick={onCommentPinClick}
              />
            ),
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Image                                                               */
/* ------------------------------------------------------------------ */

function ImageRegionPreview({
  src,
  thumbSrc,
  mimeType,
  fileName,
  comments,
  activeCommentId,
  commentMode,
  onPendingSelection,
  onCommentPinClick,
}: {
  src: string;
  thumbSrc?: string | null;
  mimeType: string;
  fileName: string;
  comments: AnchoredCommentPin[];
  activeCommentId: string | null;
  commentMode: boolean;
  onPendingSelection: (sel: PendingSelection | null) => void;
  onCommentPinClick: (id: string) => void;
}) {
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const regionPins = useRegionPins(
    commentMode ? comments : [],
    commentMode ? activeCommentId : null,
  );
  const svgPreview = isSvgImage(mimeType, fileName);
  const previewThumb =
    svgPreview || !thumbSrc || thumbSrc === src ? null : thumbSrc;
  const [hdReady, setHdReady] = useState(!previewThumb);
  const [loadError, setLoadError] = useState(false);
  const [upscalePreview, setUpscalePreview] = useState(svgPreview);

  useEffect(() => {
    setLoadError(false);
    setUpscalePreview(svgPreview);
    if (!previewThumb) {
      setHdReady(true);
      return;
    }
    setHdReady(false);
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => setHdReady(true);
    img.onerror = () => setHdReady(true);
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, previewThumb, svgPreview]);

  const displaySrc = hdReady ? src : previewThumb!;

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoadError(false);
      const el = e.currentTarget;
      setUpscalePreview(
        shouldUpscalePreviewImage(
          svgPreview,
          el.naturalWidth,
          el.naturalHeight,
        ),
      );
    },
    [svgPreview],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!commentMode) return;
      const box = imageBoxRef.current;
      if (!box || e.button !== 0) return;
      e.preventDefault();
      startRegionDrag(e, box, (rect, ev) => {
        onPendingSelection({
          anchor: { kind: "region", rect },
          quote: "Area gambar",
          clientRect: { top: ev.clientY, left: ev.clientX, width: 0, height: 0 },
        });
      });
    },
    [commentMode, onPendingSelection],
  );

  /* ---- Zoom & pan (hanya mode lihat; di mode komentar transform dimatikan
     agar koordinat anchor komentar tetap presisi seperti semula). ---- */
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const zoomActive = !commentMode;

  // Reset zoom saat gambar berganti atau saat masuk/keluar mode komentar
  // (pola "adjust state during render").
  const zoomKey = `${src}|${commentMode}`;
  const [prevZoomKey, setPrevZoomKey] = useState(zoomKey);
  if (prevZoomKey !== zoomKey) {
    setPrevZoomKey(zoomKey);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setPanning(false);
  }

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => {
      const next = Math.min(5, Math.max(1, Math.round((s + delta) * 100) / 100));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 0.2 : -0.2);
    },
    [zoomBy],
  );

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (scale <= 1 || e.button !== 0) return;
      e.preventDefault();
      panRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      setPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [scale, offset],
  );

  const onPanPointerMove = useCallback((e: React.PointerEvent) => {
    const start = panRef.current;
    if (!start) return;
    setOffset({
      x: start.ox + (e.clientX - start.x),
      y: start.oy + (e.clientY - start.y),
    });
  }, []);

  const onPanPointerUp = useCallback((e: React.PointerEvent) => {
    if (!panRef.current) return;
    panRef.current = null;
    setPanning(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  if (loadError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <CircleAlert className="text-muted-foreground size-10" />
        <p className="text-sm font-medium">Gagal memuat pratinjau gambar</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium"
        >
          Buka file asli
        </a>
      </div>
    );
  }

  const zoomed = zoomActive && scale > 1;

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(125%_100%_at_50%_0%,#221826_0%,#100b14_68%,#080509_100%)] p-3 sm:p-6"
      onWheel={zoomActive ? onWheelZoom : undefined}
    >
      <div
        ref={imageBoxRef}
        className={cn(
          "bg-background relative flex max-h-full max-w-full items-center justify-center rounded-xl p-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)] ring-1 ring-white/10 sm:p-3",
          commentMode && "touch-none",
          upscalePreview && "min-w-[min(80vw,640px)]",
          zoomed && (panning ? "cursor-grabbing" : "cursor-grab"),
        )}
        style={
          zoomActive
            ? {
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transition: panning ? "none" : "transform 0.15s ease",
                touchAction: zoomed ? "none" : undefined,
              }
            : undefined
        }
        onPointerDown={commentMode ? onPointerDown : onPanPointerDown}
        onPointerMove={commentMode ? undefined : onPanPointerMove}
        onPointerUp={commentMode ? undefined : onPanPointerUp}
        onPointerCancel={commentMode ? undefined : onPanPointerUp}
        onDoubleClick={
          commentMode
            ? undefined
            : () => (scale > 1 ? resetZoom() : setScale(2))
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={fileName}
          draggable={false}
          decoding="async"
          onLoad={onImageLoad}
          onError={() => setLoadError(true)}
          className={cn(
            "block object-contain select-none",
            upscalePreview
              ? "h-auto w-[min(80vw,640px)] max-h-[min(65vh,680px)]"
              : "max-h-[min(65vh,680px)] max-w-[min(calc(100vw-3rem),900px)] h-auto w-auto",
            previewThumb && !hdReady && "scale-[1.01] blur-[2px]",
          )}
        />
        {previewThumb && !hdReady ? (
          <div className="bg-background/60 pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : null}
        {commentMode ? <DraftRegionOverlay /> : null}
        {commentMode ? (
          <RegionPinButtons
            pins={regionPins}
            onCommentPinClick={onCommentPinClick}
          />
        ) : null}
      </div>

      {zoomActive ? (
        <div
          className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/15 bg-black/60 p-1 text-white shadow-lg backdrop-blur-md"
          role="group"
          aria-label="Zoom gambar"
        >
          <button
            type="button"
            aria-label="Perkecil"
            disabled={scale <= 1}
            onClick={() => zoomBy(-0.25)}
            className="grid size-8 place-items-center rounded-full transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="min-w-[3.25rem] rounded-full px-2 py-1 text-center text-xs font-semibold tabular-nums transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
            title="Reset ke ukuran pas"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            aria-label="Perbesar"
            disabled={scale >= 5}
            onClick={() => zoomBy(0.25)}
            className="grid size-8 place-items-center rounded-full transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <ZoomIn className="size-4" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/20" aria-hidden />
          <button
            type="button"
            aria-label="Ukuran pas"
            onClick={resetZoom}
            className="grid size-8 place-items-center rounded-full transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export function AnchoredFilePreview({
  attachment,
  imageAttachments,
  imageIndex,
  onImageIndexChange,
  comments,
  activeCommentId,
  commentMode = false,
  onPendingSelection,
  onCommentPinClick,
  className,
}: {
  attachment: PreviewAttachment;
  imageAttachments: PreviewAttachment[];
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  comments: AnchoredCommentPin[];
  activeCommentId: string | null;
  commentMode?: boolean;
  onPendingSelection: (sel: PendingSelection | null) => void;
  onCommentPinClick: (id: string) => void;
  className?: string;
}) {
  const m = attachment.mimeType;
  const src = attachment.publicPath ?? attachment.linkUrl ?? "";

  const adjacentImageSources = useMemo(() => {
    if (imageAttachments.length <= 1) return [] as string[];
    const out: string[] = [];
    for (const offset of [-1, 1]) {
      const item = imageAttachments[imageIndex + offset];
      if (item?.publicPath) {
        out.push(item.thumbPath ?? item.publicPath);
      }
    }
    return out;
  }, [imageAttachments, imageIndex]);
  usePreloadImageSources(adjacentImageSources);

  if (attachment.linkUrl && m === EXTERNAL_LINK_MIME) {
    return (
      <PreviewFrame className={className}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <ExternalLink className="text-muted-foreground size-10" />
          <p className="text-sm font-medium">{attachment.fileName}</p>
          <a
            href={attachment.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium"
          >
            Buka tautan
          </a>
        </div>
      </PreviewFrame>
    );
  }

  if (isImageMime(m) && attachment.publicPath) {
    const hasCarousel = imageAttachments.length > 1;
    const current = imageAttachments[imageIndex] ?? attachment;
    return (
      <PreviewFrame className={cn("group/stage relative", className)}>
        {hasCarousel ? (
          <>
            <button
              type="button"
              aria-label="Gambar sebelumnya"
              disabled={imageIndex <= 0}
              onClick={() => onImageIndexChange(imageIndex - 1)}
              className="absolute top-1/2 left-3 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Gambar berikutnya"
              disabled={imageIndex >= imageAttachments.length - 1}
              onClick={() => onImageIndexChange(imageIndex + 1)}
              className="absolute top-1/2 right-3 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
        <ImageRegionPreview
          key={current.id}
          src={current.publicPath!}
          thumbSrc={current.thumbPath}
          mimeType={current.mimeType}
          fileName={current.fileName}
          comments={comments}
          activeCommentId={activeCommentId}
          commentMode={commentMode}
          onPendingSelection={onPendingSelection}
          onCommentPinClick={onCommentPinClick}
        />
      </PreviewFrame>
    );
  }

  if (m === "application/pdf" && attachment.publicPath) {
    return (
      <PreviewFrame className={className}>
        <PdfSelectablePreview
          src={attachment.publicPath}
          comments={comments}
          activeCommentId={activeCommentId}
          commentMode={commentMode}
          onPendingSelection={onPendingSelection}
          onCommentPinClick={onCommentPinClick}
        />
      </PreviewFrame>
    );
  }

  if (isDocxMime(m, attachment.fileName) && attachment.publicPath) {
    return (
      <PreviewFrame className={className}>
        <SelectableTextPreview
          src={attachment.publicPath}
          kind="docx"
          fileName={attachment.fileName}
          comments={comments}
          activeCommentId={activeCommentId}
          commentMode={commentMode}
          onPendingSelection={onPendingSelection}
          onCommentPinClick={onCommentPinClick}
        />
      </PreviewFrame>
    );
  }

  if (isTextMime(m) && attachment.publicPath) {
    return (
      <PreviewFrame className={className}>
        <SelectableTextPreview
          src={attachment.publicPath}
          kind="text"
          fileName={attachment.fileName}
          comments={comments}
          activeCommentId={activeCommentId}
          commentMode={commentMode}
          onPendingSelection={onPendingSelection}
          onCommentPinClick={onCommentPinClick}
        />
      </PreviewFrame>
    );
  }

  if (m.startsWith("video/") && attachment.publicPath) {
    return (
      <PreviewFrame className={className}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-auto bg-black p-2 sm:p-4">
          <video
            key={attachment.id}
            src={attachment.publicPath}
            controls
            playsInline
            className="max-h-full max-w-full object-contain"
            preload="metadata"
          />
          {commentMode ? (
            <p className="text-background/70 shrink-0 px-4 text-center text-xs">
              Video: gunakan komentar umum di panel kanan. Dukungan anchor waktu
              menyusul.
            </p>
          ) : null}
        </div>
      </PreviewFrame>
    );
  }

  if (m.startsWith("audio/") && attachment.publicPath) {
    return (
      <PreviewFrame className={className}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
          <Music className="text-muted-foreground size-12" />
          <p className="text-sm font-medium">{attachment.fileName}</p>
          <audio src={attachment.publicPath} controls className="w-full max-w-md" preload="metadata" />
        </div>
      </PreviewFrame>
    );
  }

  return (
    <PreviewFrame className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileText className="text-muted-foreground size-12" />
        <p className="text-sm font-medium">{attachment.fileName}</p>
        {commentMode ? (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <MessageSquarePlus className="size-3.5" />
            Pilih teks tidak tersedia — gunakan komentar umum di panel kanan
          </p>
        ) : null}
        {src ? (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium"
          >
            Buka file
          </a>
        ) : null}
      </div>
    </PreviewFrame>
  );
}
