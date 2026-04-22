/**
 * Baca env di runtime (hindari masalah bundling/inline `process.env.*` pada beberapa deploy).
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
  const s = input.trim().replace(/\s/g, "");
  if (E164_REGEX.test(s)) return s;
  return null;
}

export function isTwilioWhatsAppConfigured(): boolean {
  return Boolean(
    envStr("TWILIO_ACCOUNT_SID") &&
      envStr("TWILIO_AUTH_TOKEN") &&
      envStr("TWILIO_WHATSAPP_FROM"),
  );
}

function withWhatsAppPrefix(addr: string): string {
  const t = addr.trim();
  return t.toLowerCase().startsWith("whatsapp:") ? t : `whatsapp:${t}`;
}

/** Content SID (Content API) — pola resmi Twilio: `HX` + 32 hex. */
const CONTENT_SID_PATTERN = /^HX[0-9a-fA-F]{32}$/;

type WhatsAppApprovalPayload = {
  whatsapp?: {
    status?: string;
    rejection_reason?: string;
    name?: string;
  };
};

async function fetchWhatsAppApprovalForContent(
  contentSid: string,
): Promise<WhatsAppApprovalPayload> {
  const accountSid = envStr("TWILIO_ACCOUNT_SID")!;
  const authToken = envStr("TWILIO_AUTH_TOKEN")!;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = `https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}/ApprovalRequests`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Gagal membaca status persetujuan template (HTTP ${res.status}). ${text.slice(0, 280)}`,
    );
  }
  return JSON.parse(text) as WhatsAppApprovalPayload;
}

/**
 * Di luar sesi 24 jam, WhatsApp menolak kiriman tanpa template yang **sudah disetujui Meta**.
 * Tanpa langkah "Submit for WhatsApp approval" di Twilio, error umum = 63016.
 */
async function assertContentApprovedForWhatsApp(contentSid: string): Promise<void> {
  if (envStr("TWILIO_SKIP_CONTENT_APPROVAL_CHECK") === "1") {
    return;
  }
  const data = await fetchWhatsAppApprovalForContent(contentSid);

  const wa = data.whatsapp;
  if (!wa) {
    throw new Error(
      `Template ${contentSid.slice(0, 8)}… belum punya data persetujuan WhatsApp. ` +
        `Di Twilio Console: Messaging → Content → pilih template → **Submit for WhatsApp approval** ` +
        `dan tunggu status **approved**. Tanpa itu, Meta menolak kiriman bisnis (sering dilaporkan sebagai error 63016).`,
    );
  }

  const st = (wa.status ?? "").toLowerCase();
  if (st !== "approved") {
    const reason = wa.rejection_reason?.trim();
    const tooManyVars =
      reason &&
      /too many variables|2388293/i.test(reason) &&
      /variable/i.test(reason);
    const hint = tooManyVars
      ? "Aplikasi DCC mengirim **2 variabel** saja per template ({{1}}, {{2}}). Kurangi placeholder di editor Twilio, tambah teks tetap, lalu ajukan ulang persetujuan. "
      : "";
    throw new Error(
      `Template WhatsApp "${wa.name ?? contentSid.slice(0, 8)}" belum disetujui (status: ${wa.status ?? "unknown"}). ` +
        (reason ? `Alasan penolakan: ${reason}. ` : "") +
        hint +
        `Buka Twilio → Messaging → Content → Approval requests sampai status **approved**.`,
    );
  }
}

function assertContentSidForWhatsApp(contentSid: string): void {
  if (!CONTENT_SID_PATTERN.test(contentSid)) {
    throw new Error(
      `ContentSid harus Content Template Builder Twilio (pola HX + 32 hex), dari Messaging → Content. ` +
        `Nilai: "${contentSid.slice(0, 14)}…". Bukan SID pesan SM… / akun AC….`,
    );
  }
}

/**
 * Twilio error 21656: nilai variabel template tidak boleh berisi newline, tab,
 * atau lebih dari empat spasi berturut-turut.
 * @see https://www.twilio.com/docs/api/errors/21656
 */
function sanitizeTwilioContentVariableValue(value: string): string {
  let s = value ?? "";
  s = s.replace(/\r\n|\r|\n|\t/g, " · ");
  s = s.replace(/ {2,}/g, " ");
  s = s.trim();
  return s.length > 0 ? s : "—";
}

/**
 * Kirim pesan bisnis WhatsApp memakai Twilio Content Template (Content SID).
 * Setelah Apr 2025, WhatsApp **wajib** `ContentSid` + `ContentVariables` — jangan kirim `Body`.
 *
 * `TWILIO_WHATSAPP_FROM`: nomor `whatsapp:+1…` / `+1…`, ATAU **Messaging Service SID** `MG…`.
 * Untuk `MG…`, Twilio mendokumentasikan parameter REST **`From`** berisi SID layanan (bukan `whatsapp:MG…`).
 */
export async function sendTwilioWhatsAppTemplate(options: {
  toE164: string;
  contentSid: string;
  variables: Record<string, string>;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) {
    return;
  }
  const { toE164, contentSid: rawSid, variables } = options;
  const contentSid = rawSid.trim();
  if (!contentSid) return;

  assertContentSidForWhatsApp(contentSid);
  await assertContentApprovedForWhatsApp(contentSid);

  const accountSid = envStr("TWILIO_ACCOUNT_SID")!;
  const authToken = envStr("TWILIO_AUTH_TOKEN")!;
  const fromOrMs = envStr("TWILIO_WHATSAPP_FROM")!;

  const to = withWhatsAppPrefix(toE164);

  /** Kunci variabel string — sama seperti `JSON.stringify({ 1: "x" })` di dokumentasi Twilio. */
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    vars[String(k)] = sanitizeTwilioContentVariableValue(v ?? "");
  }
  const contentVariables = JSON.stringify(vars);

  /**
   * Kirim lewat REST form-urlencoded **tanpa** field `Body`.
   * Contoh resmi Twilio untuk Content + WhatsApp memakai `From: MG…` (Messaging Service), bukan `MessagingServiceSid`.
   */
  const params = new URLSearchParams();
  params.set("To", to);
  params.set("ContentSid", contentSid);
  params.set("ContentVariables", contentVariables);
  if (fromOrMs.startsWith("MG")) {
    if (envStr("TWILIO_USE_MESSAGING_SERVICE_SID_PARAM") === "1") {
      params.set("MessagingServiceSid", fromOrMs);
    } else {
      params.set("From", fromOrMs);
    }
  } else {
    params.set("From", withWhatsAppPrefix(fromOrMs));
  }

  if (envStr("TWILIO_DEBUG") === "1") {
    console.info("[twilio-whatsapp] POST Messages.json", {
      contentSid: `${contentSid.slice(0, 6)}…`,
      to: `${to.slice(0, 12)}…`,
      fromIsMessagingService: fromOrMs.startsWith("MG"),
      useMsParam: envStr("TWILIO_USE_MESSAGING_SERVICE_SID_PARAM") === "1",
    });
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { message?: string; code?: number };
      if (j?.message) detail = j.message;
    } catch {
      /* */
    }
    throw new Error(`Twilio Messages API ${res.status}: ${detail}`);
  }
}
