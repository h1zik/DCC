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

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    return true;
  }
  return false;
}

export async function fetchWebsiteContent(url: string): Promise<{
  url: string;
  title: string | null;
  content: string;
  truncated: boolean;
}> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL tidak valid.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Hanya URL http/https yang didukung.");
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error("URL internal/private tidak diizinkan.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "DCC-Agent/1.0 (+https://dominatuscenter.com)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
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
