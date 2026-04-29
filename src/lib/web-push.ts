import webpush from "web-push";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isWebPushConfigured() {
  return ensureConfigured();
}

export function getWebPushPublicKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
}

export async function sendWebPushMessage(params: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: PushPayload;
}) {
  if (!ensureConfigured()) return { ok: false as const, reason: "not_configured" as const };
  const subscription = {
    endpoint: params.endpoint,
    keys: {
      p256dh: params.p256dh,
      auth: params.auth,
    },
  };
  const payload = JSON.stringify(params.payload);
  try {
    await webpush.sendNotification(subscription, payload);
    return { ok: true as const };
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null;
    const reason =
      statusCode === 404 || statusCode === 410 ? "gone" as const : "failed" as const;
    return {
      ok: false as const,
      reason,
      statusCode,
    };
  }
}
