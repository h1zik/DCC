import "server-only";
import type { Browser } from "puppeteer-core";

/**
 * Chromium penuh (dev, cross-platform) vs `@sparticuz/chromium` self-contained
 * (produksi — aman di container Linux minimal Railway/Nixpacks tanpa perlu
 * shared lib sistem tambahan). Keduanya dikendalikan lewat `puppeteer-core`.
 */
async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")) as typeof import("puppeteer-core");

  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const fullPuppeteer = (await import("puppeteer")) as unknown as {
    executablePath: () => Promise<string>;
  };
  return puppeteer.launch({
    executablePath: await fullPuppeteer.executablePath(),
    headless: true,
  });
}

const APP_ORIGIN = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/**
 * `page.setContent` tidak punya origin (`about:blank`) — path relatif seperti
 * upload wiki (`/uploads/...`) tidak akan resolve. Tulis ulang jadi absolute
 * URL memakai origin app sendiri sebelum discapture.
 */
function resolveRelativeUrls(html: string): string {
  return html.replace(
    /((?:src|href)=")(\/(?!\/)[^"]*)(")/gi,
    (_match, prefix: string, path: string, suffix: string) => `${prefix}${APP_ORIGIN}${path}${suffix}`,
  );
}

/**
 * Render dokumen HTML standalone menjadi PDF vektor asli lewat headless
 * Chromium — pengganti pipeline lama (html2canvas raster → jsPDF paste PNG)
 * yang menghasilkan file puluhan MB untuk konten teks/tabel biasa.
 */
export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Defense-in-depth: semua template PDF statis, tidak butuh JS sama sekali.
    await page.setJavaScriptEnabled(false);
    await page.setContent(resolveRelativeUrls(html), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
