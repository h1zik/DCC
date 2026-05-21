import {
  buildWikiHtmlDocument,
  buildWikiPdfIframeDocument,
  htmlToMarkdown,
  htmlToPlainText,
  sanitizeWikiFilename,
  stripThemeClassesFromHtml,
  wikiDownloadApiPath,
  type WikiExportFormat,
} from "@/lib/wiki-export";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return null;
    }
  }
  return null;
}

export async function downloadWikiPageFromApi(
  roomId: string,
  viewId: string,
  pageId: string,
  format: "html" | "md" | "txt" | "docx",
): Promise<void> {
  const res = await fetch(wikiDownloadApiPath(roomId, viewId, pageId, format), {
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Gagal mengunduh.");
  }
  const blob = await res.blob();
  const name =
    filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    `wiki.${format}`;
  triggerBlobDownload(blob, name);
}

async function waitForIframeReady(
  iframe: HTMLIFrameElement,
): Promise<Document> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Waktu habis saat menyiapkan PDF."));
      }
    }, 20_000);
    iframe.addEventListener("load", finish, { once: true });
    requestAnimationFrame(() => {
      try {
        const doc = iframe.contentDocument;
        if (
          doc?.readyState === "complete" &&
          doc.body?.querySelector(".wiki-body")
        ) {
          finish();
        }
      } catch {
        /* abaikan */
      }
    });
  });

  const doc = iframe.contentDocument;
  if (!doc?.body) {
    throw new Error("Tidak dapat merender konten untuk PDF.");
  }

  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );

  const contentHeight = Math.max(
    doc.documentElement.scrollHeight,
    doc.body.scrollHeight,
    200,
  );
  iframe.style.height = `${contentHeight}px`;

  const images = Array.from(doc.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );

  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );

  return doc;
}

/**
 * Paksa warna hex inline agar html2canvas tidak mem-parse lab()/oklch() dari computed style.
 */
function freezeStylesForPdfCapture(root: HTMLElement) {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of nodes) {
    el.style.setProperty("color", "#111111", "important");
    el.style.setProperty(
      "background-color",
      el === root ? "#ffffff" : "transparent",
      "important",
    );
    el.style.setProperty("border-color", "#e4e4e7", "important");
    el.style.setProperty("outline", "none", "important");
    el.style.setProperty("box-shadow", "none", "important");
    el.style.setProperty("text-decoration-color", "#111111", "important");
  }
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    a.style.setProperty("color", "#2563eb", "important");
    a.style.setProperty("text-decoration", "underline", "important");
  });
  root.querySelectorAll<HTMLElement>("blockquote").forEach((b) => {
    b.style.setProperty("color", "#52525b", "important");
    b.style.setProperty("border-left-color", "#d4d4d8", "important");
  });
  root.querySelectorAll<HTMLElement>("pre").forEach((pre) => {
    pre.style.setProperty("background-color", "#f4f4f5", "important");
    pre.style.setProperty("color", "#111111", "important");
  });
  root.querySelectorAll<HTMLElement>("code").forEach((code) => {
    if (!code.closest("pre")) {
      code.style.setProperty("background-color", "#f4f4f5", "important");
    }
  });
}

/** Potong gambar panjang ke beberapa halaman A4 (pola offset Y negatif jsPDF). */
function addCanvasToPdf(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
  marginPt: number,
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = pageWidth - marginPt * 2;
  const printableHeight = pageHeight - marginPt * 2;

  const imgWidth = printableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL("image/png");
  let heightLeft = imgHeight;
  let position = marginPt;

  pdf.addImage(imgData, "PNG", marginPt, position, imgWidth, imgHeight);
  heightLeft -= printableHeight;

  while (heightLeft > 0) {
    position = marginPt - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "PNG", marginPt, position, imgWidth, imgHeight);
    heightLeft -= printableHeight;
  }
}

/**
 * PDF: iframe terisolasi → inline hex → html2canvas → jsPDF (tanpa doc.html).
 */
export async function downloadWikiPageAsPdf(title: string, contentHtml: string) {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  const html2canvas = html2canvasMod.default;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Pratinjau PDF");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;min-height:200px;border:0;visibility:hidden;pointer-events:none;";
  document.body.appendChild(iframe);

  iframe.srcdoc = buildWikiPdfIframeDocument(
    stripThemeClassesFromHtml(contentHtml),
  );

  try {
    const doc = await waitForIframeReady(iframe);
    const win = iframe.contentWindow;
    const captureRoot = doc.querySelector<HTMLElement>(".wiki-body");
    if (!captureRoot) {
      throw new Error("Tidak dapat merender konten untuk PDF.");
    }

    freezeStylesForPdfCapture(captureRoot);

    const captureWidth = Math.max(captureRoot.scrollWidth, 794);
    const captureHeight = Math.max(captureRoot.scrollHeight, 200);

    const canvas = await html2canvas(captureRoot, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      foreignObjectRendering: false,
      width: captureWidth,
      height: captureHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const clonedRoot = clonedDoc.querySelector<HTMLElement>(".wiki-body");
        if (clonedRoot) freezeStylesForPdfCapture(clonedRoot);
      },
      // html2canvas mendukung opsi ini untuk elemen di dalam iframe
      ...(win ? { window: win } : {}),
    } as Parameters<typeof html2canvas>[1]);

    if (canvas.width < 2 || canvas.height < 2) {
      throw new Error("Konten kosong atau gagal di-render ke PDF.");
    }

    const pdf = new jsPDF({
      unit: "pt",
      format: "a4",
      orientation: "portrait",
    });
    addCanvasToPdf(pdf, canvas, 36);
    pdf.save(`${sanitizeWikiFilename(title, "wiki")}.pdf`);
  } finally {
    iframe.remove();
  }
}

export function downloadWikiPageLocally(
  title: string,
  contentHtml: string,
  format: WikiExportFormat,
  roomId: string,
  viewId: string,
  pageId: string,
): Promise<void> {
  if (format === "pdf") {
    return downloadWikiPageAsPdf(title, contentHtml);
  }
  if (format === "docx") {
    return downloadWikiPageFromApi(roomId, viewId, pageId, "docx");
  }
  if (format === "html") {
    const html = buildWikiHtmlDocument(title, contentHtml);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    triggerBlobDownload(blob, `${sanitizeWikiFilename(title, "wiki")}.html`);
    return Promise.resolve();
  }
  if (format === "md") {
    const md = `# ${title}\n\n${htmlToMarkdown(contentHtml)}`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    triggerBlobDownload(blob, `${sanitizeWikiFilename(title, "wiki")}.md`);
    return Promise.resolve();
  }
  if (format === "txt") {
    const txt = `${title}\n\n${htmlToPlainText(contentHtml)}`;
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    triggerBlobDownload(blob, `${sanitizeWikiFilename(title, "wiki")}.txt`);
    return Promise.resolve();
  }
  return downloadWikiPageFromApi(roomId, viewId, pageId, format);
}
