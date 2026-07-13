import "server-only";

import { createSign } from "node:crypto";

/**
 * Klien Google Search Console via service account (tanpa dependensi baru):
 * JWT RS256 ditandatangani `node:crypto` → tukar access token → Search
 * Analytics API. Setup: buat service account di Google Cloud, aktifkan
 * "Search Console API", lalu tambahkan email service account sebagai user
 * (Full/Restricted) di properti Search Console.
 *
 * Env:
 * - GSC_SERVICE_ACCOUNT_EMAIL  — email service account.
 * - GSC_PRIVATE_KEY            — private key PEM (newline boleh "\n").
 * - GSC_SITE_URL               — properti default, mis. "sc-domain:brand.com"
 *                                atau "https://brand.com/".
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";

export class GscError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GscError";
  }
}

function getCredentials(): { email: string; privateKey: string } | null {
  const email = process.env.GSC_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GSC_PRIVATE_KEY?.trim();
  if (!email || !rawKey) return null;
  return { email, privateKey: rawKey.replace(/\\n/g, "\n") };
}

export function isGscConfigured(): boolean {
  return !!getCredentials() && !!process.env.GSC_SITE_URL?.trim();
}

export function getGscSiteUrl(): string | null {
  return process.env.GSC_SITE_URL?.trim() || null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Cache access token in-memory (berlaku ~1 jam). */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const creds = getCredentials();
  if (!creds) {
    throw new GscError(
      "GSC belum dikonfigurasi (set GSC_SERVICE_ACCOUNT_EMAIL & GSC_PRIVATE_KEY).",
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: creds.email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = base64url(signer.sign(creds.privateKey));
  const assertion = `${header}.${payload}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;
  if (!res.ok || !json?.access_token) {
    throw new GscError(
      `Gagal tukar token GSC: ${json?.error_description ?? json?.error ?? `HTTP ${res.status}`}`,
    );
  }

  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscQueryOptions = {
  siteUrl?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dimensions: ("query" | "page" | "date" | "device" | "country")[];
  rowLimit?: number;
};

/** Panggil Search Analytics API (`searchAnalytics/query`). */
export async function gscSearchAnalytics(
  opts: GscQueryOptions,
): Promise<GscRow[]> {
  const siteUrl = opts.siteUrl ?? getGscSiteUrl();
  if (!siteUrl) throw new GscError("GSC_SITE_URL belum diset.");

  const token = await getAccessToken();
  const res = await fetch(
    `${API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: opts.startDate,
        endDate: opts.endDate,
        dimensions: opts.dimensions,
        rowLimit: Math.min(25000, Math.max(1, opts.rowLimit ?? 1000)),
        dataState: "final",
      }),
    },
  );
  const json = (await res.json().catch(() => null)) as {
    rows?: GscRow[];
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    throw new GscError(
      `GSC API error: ${json?.error?.message ?? `HTTP ${res.status}`}`,
    );
  }
  return json?.rows ?? [];
}

/** Format tanggal YYYY-MM-DD (UTC). */
export function gscDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
