/**
 * Runtime env reader (hindari inline env saat bundling).
 */
function envStr(key: string): string | undefined {
  const v = process.env[key];
  return typeof v === "string" ? v.trim() : undefined;
}

/** Nomor internasional tanpa spasi, diawali + (contoh: +6281234567890). */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function normalizeWhatsAppE164(
  input: string | null | undefined,
): string | null {
  if (!input?.trim()) return null;
  const raw = input.trim().replace(/[^\d+]/g, "");
  const s = raw.replace(/\s/g, "");
  if (E164_REGEX.test(s)) return s;

  // Toleransi input umum Indonesia: 08..., 8..., 62...
  if (/^0\d{8,14}$/.test(s)) {
    const next = `+62${s.slice(1)}`;
    return E164_REGEX.test(next) ? next : null;
  }
  if (/^8\d{7,13}$/.test(s)) {
    const next = `+62${s}`;
    return E164_REGEX.test(next) ? next : null;
  }
  if (/^62\d{8,14}$/.test(s)) {
    const next = `+${s}`;
    return E164_REGEX.test(next) ? next : null;
  }
  return null;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(envStr("FONNTE_API_KEY"));
}

function toFonnteTargetNumber(e164: string): string {
  const t = e164.trim();
  return t.startsWith("+") ? t.slice(1) : t;
}

export async function sendWhatsAppMessage(options: {
  toE164: string;
  message: string;
}): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  const token = envStr("FONNTE_API_KEY")!;
  const target = toFonnteTargetNumber(options.toE164);
  const message = options.message.trim();
  if (!message) return;

  const body = new URLSearchParams();
  body.set("target", target);
  body.set("message", message);

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fonnte API ${res.status}: ${text.slice(0, 280)}`);
  }
}
