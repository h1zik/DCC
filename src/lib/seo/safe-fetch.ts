import "server-only";

import { lookup } from "node:dns/promises";
import { checkPublicUrlSyntax, isPrivateIp } from "@/lib/seo/safe-fetch-rules";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Pastikan URL aman untuk di-fetch dari server: sintaksis publik DAN semua
 * alamat hasil resolusi DNS bukan IP privat (mencegah DNS rebinding ke
 * 127.0.0.1 / 169.254.169.254 / service internal Railway).
 *
 * @throws UnsafeUrlError bila tidak lolos.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const verdict = checkPublicUrlSyntax(raw);
  if (!verdict.ok) throw new UnsafeUrlError(verdict.reason);
  const host = verdict.url.hostname.replace(/^\[|\]$/g, "");
  // IP literal sudah dicek di sintaksis.
  if (/^[\d.]+$/.test(host) || host.includes(":")) return verdict.url;

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("Host tidak dapat di-resolve.");
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError("Host tidak dapat di-resolve.");
  }
  for (const a of addresses) {
    if (isPrivateIp(a.address)) {
      throw new UnsafeUrlError("Host mengarah ke alamat jaringan internal.");
    }
  }
  return verdict.url;
}

export type SafeFetchOptions = {
  /** Maksimum redirect yang diikuti (default 5); setiap hop divalidasi ulang. */
  maxRedirects?: number;
};

/**
 * `fetch` untuk URL yang berasal dari pengguna/sumber eksternal. Mengikuti
 * redirect secara manual agar setiap tujuan divalidasi `assertPublicUrl`.
 *
 * @throws UnsafeUrlError bila URL awal atau salah satu redirect tidak aman.
 */
export async function safeFetch(
  input: string,
  init: RequestInit = {},
  opts: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 5;
  let current = input;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop === maxRedirects) {
        throw new UnsafeUrlError("Terlalu banyak redirect.");
      }
      // Buang body supaya koneksi bisa dipakai ulang.
      await res.body?.cancel().catch(() => undefined);
      current = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Terlalu banyak redirect.");
}

/** Baca body sebagai teks dengan batas byte (default 2 MB). */
export async function readTextCapped(
  res: Response,
  maxBytes = 2 * 1024 * 1024,
): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = maxBytes - total;
    if (value.byteLength >= remaining) {
      chunks.push(value.subarray(0, Math.max(0, remaining)));
      total = maxBytes;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}
