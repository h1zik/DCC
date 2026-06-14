"use client";

const PDF_SCALE = 2;
const PAGE_WIDTH_PX = 794;
/** Extra canvas px below each block — html2canvas often paints past getBoundingClientRect().bottom */
const BLOCK_BOTTOM_SLACK_CSS = 10;

function cropCanvasRegion(
  source: HTMLCanvasElement,
  topPx: number,
  heightPx: number,
): HTMLCanvasElement {
  const safeTop = Math.max(0, Math.min(topPx, source.height - 1));
  const safeHeight = Math.min(heightPx, source.height - safeTop);
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = safeHeight;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas context gagal.");
  ctx.drawImage(
    source,
    0,
    safeTop,
    source.width,
    safeHeight,
    0,
    0,
    source.width,
    safeHeight,
  );
  return out;
}

/** Map each pdf-block to a canvas band tall enough to include full line boxes. */
function measureBlockBandsPx(
  blocks: HTMLElement[],
  body: HTMLElement,
  scale: number,
  canvasHeight: number,
): Array<{ topPx: number; heightPx: number }> {
  const bodyTop = body.getBoundingClientRect().top;
  const slackPx = Math.ceil(BLOCK_BOTTOM_SLACK_CSS * scale);

  return blocks.map((block, index) => {
    const rect = block.getBoundingClientRect();
    const topPx = Math.max(0, Math.floor((rect.top - bodyTop) * scale));
    const layoutBottomPx = Math.ceil((rect.bottom - bodyTop) * scale) + slackPx;
    const nextTopPx =
      index + 1 < blocks.length
        ? Math.floor(
            (blocks[index + 1]!.getBoundingClientRect().top - bodyTop) * scale,
          )
        : canvasHeight;
    // Prefer layout bottom + slack, but never shrink below the gap to the next block.
    const bottomPx = Math.min(
      canvasHeight,
      Math.max(layoutBottomPx, nextTopPx + slackPx),
    );
    return {
      topPx,
      heightPx: Math.max(1, bottomPx - topPx),
    };
  });
}

function pxToPt(px: number, canvasWidth: number, printableWidth: number): number {
  return (px * printableWidth) / canvasWidth;
}

function addCanvasToPdf(
  pdf: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  slice: HTMLCanvasElement,
  opts: {
    margin: number;
    printableWidth: number;
    printableHeight: number;
    cursorY: number;
    isFirstImage: boolean;
  },
): { cursorY: number; isFirstImage: boolean } {
  const sliceHeightPt = pxToPt(slice.height, slice.width, opts.printableWidth);
  let { cursorY, isFirstImage } = opts;
  const remainingPt = opts.printableHeight - (cursorY - opts.margin);

  const maxSlicePx = Math.floor(
    (opts.printableHeight / opts.printableWidth) * slice.width,
  );

  if (sliceHeightPt <= remainingPt) {
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      opts.margin,
      cursorY,
      opts.printableWidth,
      sliceHeightPt,
    );
    return {
      cursorY: cursorY + sliceHeightPt + 4,
      isFirstImage: false,
    };
  }

  if (sliceHeightPt <= opts.printableHeight) {
    if (!isFirstImage) pdf.addPage();
    cursorY = opts.margin;
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      opts.margin,
      cursorY,
      opts.printableWidth,
      sliceHeightPt,
    );
    return {
      cursorY: cursorY + sliceHeightPt + 4,
      isFirstImage: false,
    };
  }

  let yOffset = 0;
  while (yOffset < slice.height) {
    const chunkH = Math.min(maxSlicePx, slice.height - yOffset);
    const chunkCanvas = cropCanvasRegion(slice, yOffset, chunkH);
    const chunkPt = pxToPt(chunkH, slice.width, opts.printableWidth);

    if (!isFirstImage) pdf.addPage();
    isFirstImage = false;

    pdf.addImage(
      chunkCanvas.toDataURL("image/png"),
      "PNG",
      opts.margin,
      opts.margin,
      opts.printableWidth,
      chunkPt,
    );

    yOffset += chunkH;
    cursorY = opts.margin + chunkPt + 4;
  }

  return { cursorY, isFirstImage };
}

/** Download HTML document as PDF — one full render, crop per block band, paginate cleanly. */
export async function downloadHtmlAsPdf(
  title: string,
  html: string,
  filename?: string,
): Promise<void> {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  const html2canvas = html2canvasMod.default;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:794px;height:1200px;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  iframe.srcdoc = html;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Timeout menyiapkan PDF.")),
      30_000,
    );
    iframe.addEventListener(
      "load",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });

  try {
    const doc = iframe.contentDocument;
    const body = doc?.body;
    if (!body) throw new Error("Gagal merender dokumen.");

    const layoutHeight = body.scrollHeight;
    const captureHeight = layoutHeight + BLOCK_BOTTOM_SLACK_CSS * 2;
    iframe.style.height = `${captureHeight}px`;

    await doc.fonts?.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const masterCanvas = await html2canvas(body, {
      backgroundColor: "#ffffff",
      scale: PDF_SCALE,
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_PX,
      windowWidth: PAGE_WIDTH_PX,
      scrollX: 0,
      scrollY: 0,
      windowHeight: captureHeight,
      height: captureHeight,
    });

    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const margin = 36;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const blocks = Array.from(
      body.querySelectorAll<HTMLElement>("[data-pdf-block]"),
    );

    let cursorY = margin;
    let isFirstImage = true;

    if (blocks.length > 0) {
      const bands = measureBlockBandsPx(
        blocks,
        body,
        PDF_SCALE,
        masterCanvas.height,
      );

      for (const { topPx, heightPx } of bands) {
        const blockCanvas = cropCanvasRegion(masterCanvas, topPx, heightPx);

        const result = addCanvasToPdf(pdf, blockCanvas, {
          margin,
          printableWidth,
          printableHeight,
          cursorY,
          isFirstImage,
        });
        cursorY = result.cursorY;
        isFirstImage = result.isFirstImage;
      }
    } else {
      const sliceHeightPx = Math.floor(
        (printableHeight / printableWidth) * masterCanvas.width,
      );
      let yOffset = 0;
      while (yOffset < masterCanvas.height) {
        const sliceH = Math.min(sliceHeightPx, masterCanvas.height - yOffset);
        const slice = cropCanvasRegion(masterCanvas, yOffset, sliceH);
        const result = addCanvasToPdf(pdf, slice, {
          margin,
          printableWidth,
          printableHeight,
          cursorY: margin,
          isFirstImage,
        });
        isFirstImage = result.isFirstImage;
        yOffset += sliceH;
      }
    }

    const safeName = (filename ?? title)
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
    pdf.save(`${safeName || "document"}.pdf`);
  } finally {
    iframe.remove();
  }
}
