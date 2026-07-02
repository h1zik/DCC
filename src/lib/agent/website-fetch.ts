import { assertPublicUrl, safeFetch } from "@/lib/security/ssrf";

const MAX_BYTES = 512_000;
const TIMEOUT_MS = 12_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWebsiteContent(url: string): Promise<{
  url: string;
  title: string | null;
  content: string;
  truncated: boolean;
}> {
  // Validasi awal (protokol + host publik via resolusi DNS).
  const parsed = await assertPublicUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // safeFetch memvalidasi ulang setiap hop redirect (anti bypass redirect).
    const res = await safeFetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "DCC-Agent/1.0 (+https://dominatuscenter.com)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil halaman (HTTP ${res.status}).`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    const bytes = new TextEncoder().encode(raw).length;
    const truncated = bytes > MAX_BYTES;
    const slice = truncated ? raw.slice(0, MAX_BYTES) : raw;

    let title: string | null = null;
    let content: string;

    if (contentType.includes("text/html")) {
      const titleMatch = slice.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
      content = stripHtml(slice);
    } else {
      content = slice.replace(/\s+/g, " ").trim();
    }

    const maxChars = 8000;
    const contentTruncated = content.length > maxChars;
    if (contentTruncated) {
      content = content.slice(0, maxChars);
    }

    return {
      url: parsed.toString(),
      title,
      content,
      truncated: truncated || contentTruncated,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Waktu habis saat mengambil halaman web.");
    }
    throw err instanceof Error ? err : new Error("Gagal mengambil halaman web.");
  } finally {
    clearTimeout(timer);
  }
}
