export type AttachmentCommentAnchor =
  | {
      kind: "text";
      selectedText: string;
      startOffset: number;
      endOffset: number;
      page?: number;
    }
  | {
      kind: "region";
      page?: number;
      rect: { x: number; y: number; w: number; h: number };
      selectedText?: string;
    };

export type TextAnchor = Extract<AttachmentCommentAnchor, { kind: "text" }>;

export type TextHighlightSpan = {
  id: string;
  start: number;
  end: number;
  resolved: boolean;
  active: boolean;
};

export function parseAttachmentCommentAnchor(
  raw: string | null | undefined,
): AttachmentCommentAnchor | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as AttachmentCommentAnchor;
    if (parsed.kind === "text") {
      if (
        typeof parsed.selectedText !== "string" ||
        typeof parsed.startOffset !== "number" ||
        typeof parsed.endOffset !== "number"
      ) {
        return null;
      }
      return parsed;
    }
    if (parsed.kind === "region") {
      const r = parsed.rect;
      if (
        !r ||
        typeof r.x !== "number" ||
        typeof r.y !== "number" ||
        typeof r.w !== "number" ||
        typeof r.h !== "number"
      ) {
        return null;
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeAttachmentCommentAnchor(
  anchor: AttachmentCommentAnchor | null | undefined,
): string | null {
  if (!anchor) return null;
  return JSON.stringify(anchor);
}

/* ------------------------------------------------------------------ */
/* PDF text layer — canonical text                                     */
/* ------------------------------------------------------------------ */

/**
 * Span "daun" pada text layer pdf.js. PDF ber-tag (marked content)
 * menghasilkan span bersarang; mengambil semua span menghitung teks
 * dua kali (induk + anak) dan merusak seluruh offset.
 */
export function getPdfLeafSpans(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll("span")).filter(
    (span) => !span.querySelector("span"),
  );
}

export function getPdfSpanTexts(root: HTMLElement): string[] {
  return getPdfLeafSpans(root).map(
    (span) => span.getAttribute("data-pdf-span-text") ?? span.textContent ?? "",
  );
}

/** Kanonik PDF: teks span daun digabung dengan satu spasi. */
export function buildCanonicalPdfText(parts: string[]): string {
  return parts.join(" ");
}

function offsetWithinSpan(
  span: HTMLElement,
  container: Node,
  offset: number,
): number {
  const prefix = document.createRange();
  prefix.selectNodeContents(span);
  prefix.setEnd(container, offset);
  return prefix.toString().length;
}

/** Offset eksak dari Range DOM ke string kanonik PDF. */
export function getExactCanonicalSelectionRange(
  root: HTMLElement,
  range: Range,
): { start: number; end: number; text: string } | null {
  const spans = getPdfLeafSpans(root);
  if (spans.length === 0) return null;

  const parts = spans.map(
    (span) => span.getAttribute("data-pdf-span-text") ?? span.textContent ?? "",
  );
  const canonical = buildCanonicalPdfText(parts);

  let start = -1;
  let end = -1;
  let cursor = 0;

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]!;

    if (
      start < 0 &&
      (span === range.startContainer || span.contains(range.startContainer))
    ) {
      start =
        cursor + offsetWithinSpan(span, range.startContainer, range.startOffset);
    }
    if (
      end < 0 &&
      (span === range.endContainer || span.contains(range.endContainer))
    ) {
      end = cursor + offsetWithinSpan(span, range.endContainer, range.endOffset);
    }

    cursor += parts[i]!.length;
    if (i < spans.length - 1) cursor += 1;
  }

  if (start < 0 || end < 0 || end <= start) return null;
  return {
    start,
    end: Math.min(end, canonical.length),
    text: canonical.slice(start, Math.min(end, canonical.length)),
  };
}

/* ------------------------------------------------------------------ */
/* Anchor resolution                                                   */
/* ------------------------------------------------------------------ */

/**
 * Temukan offset kutipan dalam `fullText`.
 * 1. Offset tersimpan masih valid → pakai langsung (eksak).
 * 2. Tidak valid (teks kanonik berubah) → cari kemunculan kutipan
 *    yang paling dekat dengan offset tersimpan.
 */
export function resolveTextAnchorOffsets(
  fullText: string,
  anchor: TextAnchor,
): { start: number; end: number } | null {
  const quote = anchor.selectedText.trim();
  if (!quote || !fullText) return null;

  const storedSlice = fullText.slice(anchor.startOffset, anchor.endOffset);
  if (storedSlice === quote) {
    return { start: anchor.startOffset, end: anchor.endOffset };
  }
  if (storedSlice.trim() === quote) {
    const trimFront = storedSlice.length - storedSlice.trimStart().length;
    const trimBack = storedSlice.length - storedSlice.trimEnd().length;
    return {
      start: anchor.startOffset + trimFront,
      end: anchor.endOffset - trimBack,
    };
  }

  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let searchFrom = 0;
  while (searchFrom <= fullText.length - quote.length) {
    const idx = fullText.indexOf(quote, searchFrom);
    if (idx < 0) break;
    const distance = Math.abs(idx - anchor.startOffset);
    if (distance < bestDistance) {
      best = idx;
      bestDistance = distance;
    }
    if (idx > anchor.startOffset) break; // kemunculan berikutnya pasti lebih jauh
    searchFrom = idx + 1;
  }

  if (best < 0) return null;
  return { start: best, end: best + quote.length };
}

/* ------------------------------------------------------------------ */
/* Selection → anchor                                                  */
/* ------------------------------------------------------------------ */

export function textAnchorFromSelection(
  root: HTMLElement,
  fullText: string,
  page?: number,
): AttachmentCommentAnchor | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  if (root.classList.contains("textLayer")) {
    const exact = getExactCanonicalSelectionRange(root, range);
    if (!exact || !exact.text.trim()) return null;
    const trimFront = exact.text.length - exact.text.trimStart().length;
    const trimBack = exact.text.length - exact.text.trimEnd().length;
    return {
      kind: "text",
      selectedText: exact.text.trim(),
      startOffset: exact.start + trimFront,
      endOffset: exact.end - trimBack,
      ...(page != null ? { page } : {}),
    };
  }

  const selectedText = range.toString().trim();
  if (!selectedText) return null;

  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  const hint = prefix.toString().length;

  const resolved = resolveTextAnchorOffsets(fullText, {
    kind: "text",
    selectedText,
    startOffset: hint,
    endOffset: hint + selectedText.length,
  });
  if (!resolved) return null;

  return {
    kind: "text",
    selectedText,
    startOffset: resolved.start,
    endOffset: resolved.end,
    ...(page != null ? { page } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Highlight segmentation (text/DOCX preview)                          */
/* ------------------------------------------------------------------ */

export function textHighlightSpans(
  fullText: string,
  anchors: {
    id: string;
    anchor: AttachmentCommentAnchor;
    resolved: boolean;
    active: boolean;
  }[],
): Array<{ type: "text"; value: string } | TextHighlightSpan> {
  const textAnchors = anchors
    .filter((a): a is typeof a & { anchor: TextAnchor } => a.anchor.kind === "text")
    .flatMap((a) => {
      const resolved = resolveTextAnchorOffsets(fullText, a.anchor);
      if (!resolved) return [];
      return [
        {
          id: a.id,
          start: resolved.start,
          end: resolved.end,
          resolved: a.resolved,
          active: a.active,
        },
      ];
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  if (textAnchors.length === 0) {
    return fullText ? [{ type: "text", value: fullText }] : [];
  }

  const segments: Array<{ type: "text"; value: string } | TextHighlightSpan> =
    [];
  let cursor = 0;
  for (const mark of textAnchors) {
    // Klip anchor yang tumpang-tindih agar teks tidak dirender ganda.
    const start = Math.max(mark.start, cursor);
    if (start >= mark.end) continue;
    if (start > cursor) {
      segments.push({ type: "text", value: fullText.slice(cursor, start) });
    }
    segments.push({ ...mark, start });
    cursor = mark.end;
  }
  if (cursor < fullText.length) {
    segments.push({ type: "text", value: fullText.slice(cursor) });
  }
  return segments;
}

export function clampRect(rect: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const x = Math.max(0, Math.min(1, rect.x));
  const y = Math.max(0, Math.min(1, rect.y));
  const w = Math.max(0.01, Math.min(1 - x, rect.w));
  const h = Math.max(0.01, Math.min(1 - y, rect.h));
  return { x, y, w, h };
}
