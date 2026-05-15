/**
 * Ambil pesan error yang ditampilkan ke user setelah Server Action / fetch async.
 * Di klien Next.js, nilai reject tidak selalu `instanceof Error` meskipun server
 * melempar `Error` — sering berupa objek biasa dengan `message` saja.
 */
export function actionErrorMessage(err: unknown, fallback: string): string {
  const pick = (u: unknown): string | null => {
    if (typeof u === "string") {
      const t = u.trim();
      return t.length > 0 ? t : null;
    }
    if (u instanceof Error) {
      const t = u.message?.trim() ?? "";
      return t.length > 0 ? t : null;
    }
    if (u && typeof u === "object") {
      const o = u as Record<string, unknown>;
      if (typeof o.message === "string") {
        const t = o.message.trim();
        if (t.length > 0) return t;
      }
      const inner = o.error;
      if (inner && typeof inner === "object") {
        const m = (inner as Record<string, unknown>).message;
        if (typeof m === "string") {
          const t = m.trim();
          if (t.length > 0) return t;
        }
      }
    }
    return null;
  };

  const direct = pick(err);
  if (direct) return direct;

  if (err && typeof err === "object" && "cause" in err) {
    const fromCause = pick((err as { cause?: unknown }).cause);
    if (fromCause) return fromCause;
  }

  return fallback;
}
