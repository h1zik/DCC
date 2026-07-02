import "server-only";

/**
 * Throttle brute-force login. In-memory per-instance (cukup untuk 1 instance
 * Railway; untuk multi-instance ganti ke store bersama seperti Redis).
 * Kunci digabung dari email + IP agar tidak mudah dilewati.
 */

type Attempt = { count: number; firstAt: number; blockedUntil: number };

const attempts = new Map<string, Attempt>();

const WINDOW_MS = 15 * 60_000; // jendela hitung kegagalan
const MAX_FAILURES = 8; // kegagalan sebelum diblokir
const BLOCK_MS = 15 * 60_000; // durasi blokir

function prune(now: number) {
  if (attempts.size < 1000) return;
  for (const [key, a] of attempts) {
    if (a.blockedUntil <= now && now - a.firstAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function loginKey(email: string, ip: string): string {
  return `${email.toLowerCase()}|${ip}`;
}

/** True bila percobaan login masih diizinkan. */
export function isLoginAllowed(key: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  prune(now);
  const a = attempts.get(key);
  if (!a) return { allowed: true };
  if (a.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((a.blockedUntil - now) / 1000),
    };
  }
  return { allowed: true };
}

export function registerLoginFailure(key: string): void {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  a.count += 1;
  if (a.count >= MAX_FAILURES) {
    a.blockedUntil = now + BLOCK_MS;
  }
}

export function resetLogin(key: string): void {
  attempts.delete(key);
}
