/**
 * Aturan murni (tanpa I/O) untuk menjaga fetch URL yang berasal dari pengguna
 * agar tidak menyasar jaringan internal (SSRF): loopback, link-local
 * (metadata cloud 169.254.169.254), RFC1918, CGNAT, ULA IPv6, dan hostname
 * internal. Dipakai oleh `safe-fetch.ts` dan bisa di-test tanpa server-only.
 */

const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  ".localhost",
  ".local",
  ".internal",
  ".railway.internal",
  ".home.arpa",
];

/** True bila hostname literal jelas-jelas internal. */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  return BLOCKED_HOST_SUFFIXES.some(
    (s) => h === s.replace(/^\./, "") || h.endsWith(s),
  );
}

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
  return nums;
}

/** True bila alamat IPv4 berada di rentang privat/khusus. */
export function isPrivateIpv4(ip: string): boolean {
  const o = parseIpv4(ip);
  if (!o) return false;
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + metadata cloud
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 192 && b === 0 && o[2] === 0) return true; // IETF 192.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/** True bila alamat IPv6 berada di rentang privat/khusus (termasuk IPv4-mapped). */
export function isPrivateIpv6(ip: string): boolean {
  let v = ip.trim().toLowerCase();
  // Buang zone id (fe80::1%eth0) dan kurung siku.
  v = v.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (v === "::" || v === "::1") return true;
  // IPv4-mapped (::ffff:a.b.c.d) → nilai IPv4-nya.
  const mapped = v.match(/^(?:0*:)*ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const mappedHex = v.match(/^(?:0*:)*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIpv4(
      `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`,
    );
  }
  const first = v.split(":")[0] ?? "";
  const n = first ? parseInt(first, 16) : 0;
  if (!Number.isFinite(n)) return false;
  if ((n & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((n & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((n & 0xff00) === 0xff00) return true; // multicast
  if (n === 0x2001 && (v.split(":")[1] ?? "") === "db8") return true; // dokumentasi
  return false;
}

/** True bila string adalah IP privat (v4 atau v6). */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) return isPrivateIpv6(ip);
  return isPrivateIpv4(ip);
}

export type UrlGuardVerdict = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Validasi sintaksis URL yang boleh di-fetch server: hanya http(s), tanpa
 * kredensial di URL, hostname bukan internal, dan bila hostname berupa IP
 * literal → bukan IP privat. Resolusi DNS dilakukan di `safe-fetch.ts`.
 */
export function checkPublicUrlSyntax(raw: string): UrlGuardVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "URL tidak valid." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Hanya URL http(s) yang didukung." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URL dengan kredensial tidak didukung." };
  }
  const host = url.hostname;
  if (isBlockedHostname(host)) {
    return { ok: false, reason: "Host internal tidak diizinkan." };
  }
  const bare = host.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(bare) || bare.includes(":")) {
    if (isPrivateIp(bare)) {
      return { ok: false, reason: "Alamat IP privat tidak diizinkan." };
    }
  }
  return { ok: true, url };
}
