"use client";

/** Download HTML document as PDF via html2canvas + jspdf. */
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
    "position:fixed;left:-10000px;top:0;width:794px;min-height:200px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  iframe.srcdoc = html;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Timeout menyiapkan PDF.")),
      20_000,
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

    const canvas = await html2canvas(body, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      width: 794,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const margin = 36;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= printableHeight;
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
