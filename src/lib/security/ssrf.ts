import "server-only";

import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Proteksi SSRF: validasi bahwa sebuah URL menunjuk ke host publik sebelum
 * di-fetch server-side. Menutup celah metadata endpoint cloud
 * (169.254.169.254), loopback, private range, link-local, IPv6, serta IPv4
 * ter-encode (desimal/oktal/hex) — karena validasi dilakukan pada IP hasil
 * resolusi DNS, bukan pada string hostname.
 */

const DEFAULT_MAX_REDIRECTS = 3;

/** True bila IP (v4/v6) berada di rentang yang tidak boleh dijangkau. */
export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  // Bukan IP valid → anggap berbahaya (fail-closed).
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 & 192.0.2.0/24 (test)
  if (a >= 224) return true; // multicast/reserved 224.0.0.0/3
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const h = ip.toLowerCase().split("%")[0]; // buang zone id
  if (h === "::1" || h === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) → periksa bagian IPv4-nya.
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (h.startsWith("fe80")) return true; // link-local fe80::/10
  const first = parseInt(h.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  return false;
}

/**
 * Validasi hostname: resolve DNS lalu tolak bila SEMUA (atau salah satu) alamat
 * hasil resolusi berada di rentang terblokir. Melempar Error bila tidak aman.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, ""); // strip bracket IPv6

  // Bila hostname sudah berupa IP literal, cek langsung.
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new Error("URL internal/private tidak diizinkan.");
    }
    return;
  }

  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error("Host tidak dapat diresolusi.");
  }
  if (addrs.length === 0) {
    throw new Error("Host tidak dapat diresolusi.");
  }
  // Tolak bila ADA satu saja alamat internal (cegah DNS rebinding parsial).
  for (const { address } of addrs) {
    if (isBlockedIp(address)) {
      throw new Error("URL internal/private tidak diizinkan.");
    }
  }
}

/** Parse + validasi protokol & host. Melempar bila tidak aman. Return URL final. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL tidak valid.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Hanya URL http/https yang didukung.");
  }
  await assertPublicHost(parsed.hostname);
  return parsed;
}

/**
 * `fetch` yang aman-SSRF: memvalidasi URL awal DAN setiap hop redirect
 * (redirect: "manual") sehingga URL publik yang me-redirect ke host internal
 * tetap tertutup.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = DEFAULT_MAX_REDIRECTS,
): Promise<Response> {
  let current = await assertPublicUrl(rawUrl);

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current.toString(), {
      ...init,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, current);
      await assertPublicUrl(next.toString());
      current = next;
      continue;
    }
    return res;
  }
  throw new Error("Terlalu banyak redirect.");
}
