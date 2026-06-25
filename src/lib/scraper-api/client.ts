import "server-only";

const DEFAULT_TIMEOUT_MS = 900_000;

export function getScraperApiUrl(): string | null {
  const raw = process.env.SCRAPER_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function getScraperApiKey(): string | null {
  return process.env.SCRAPER_API_KEY?.trim() || null;
}

export function isScraperApiConfigured(): boolean {
  return !!getScraperApiUrl() && !!getScraperApiKey();
}

export type VpsRunResponse = {
  run_id: string;
  actor_id: string;
  status: string;
  count: number;
  input?: Record<string, unknown> | null;
  error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  dataset_url?: string | null;
  items?: Record<string, unknown>[] | null;
};

export type VpsActorRunOptions = {
  wait?: boolean;
  timeout?: number;
  /** Jika false, run berstatus failed dikembalikan tanpa throw (untuk retry). */
  throwOnFailed?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serialisasi + cooldown gate khusus run Shopee VPS.
 *
 * VPS memberlakukan cooldown (~1 menit) setelah sebuah job Shopee selesai.
 * Tanpa koordinasi, scrape kedua yang dikirim back-to-back ditolak VPS dan
 * langsung gagal. Gate ini menyerialkan semua run `shopee-*` di proses ini dan
 * menunggu sisa cooldown sebelum memulai run berikutnya — jadi scrape kedua
 * "mengantre" (In Queue), bukan gagal.
 *
 * Catatan: state ini per-proses Node. Di Railway dengan satu instance sudah
 * cukup; bila scale-out multi-instance, retry busy/cooldown di bawah jadi
 * jaring pengaman lintas-instance.
 */
const SHOPEE_VPS_COOLDOWN_MS = (() => {
  const raw = Number(process.env.SCRAPER_SHOPEE_COOLDOWN_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 70_000;
})();

let shopeeVpsGateChain: Promise<unknown> = Promise.resolve();
let shopeeVpsLastFinishedAt = 0;

function runWithShopeeVpsGate<T>(task: () => Promise<T>): Promise<T> {
  const run = shopeeVpsGateChain.then(async () => {
    const sinceLast = Date.now() - shopeeVpsLastFinishedAt;
    const remaining = SHOPEE_VPS_COOLDOWN_MS - sinceLast;
    if (shopeeVpsLastFinishedAt > 0 && remaining > 0) {
      console.info(
        `[scraper-api/shopee] cooldown VPS — antre ${Math.ceil(remaining / 1000)}s sebelum run berikutnya…`,
      );
      await sleep(remaining);
    }
    try {
      return await task();
    } finally {
      // Tandai waktu selesai supaya run berikutnya menghitung sisa cooldown.
      shopeeVpsLastFinishedAt = Date.now();
    }
  });
  // Rantai berikutnya menunggu run ini selesai; `.catch` mencegah satu run yang
  // gagal memutus antrean untuk run setelahnya.
  shopeeVpsGateChain = run.catch(() => {});
  return run;
}

/** VPS sibuk (job lain jalan) atau sedang cooldown — layak ditunggu & retry. */
function isVpsBusyOrCooldownResponse(status: number, body: string): boolean {
  if (status === 429 || status === 503) return true;
  if (status !== 409) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes("already running") ||
    lower.includes("shopee scrape job") ||
    lower.includes("cooldown") ||
    lower.includes("cool down") ||
    lower.includes("please wait") ||
    lower.includes("too many")
  );
}

/** Panggil actor di VPS scraper (Apify-style). */
export async function startVpsActorRun(
  actorId: string,
  input: Record<string, unknown>,
  opts: VpsActorRunOptions = {},
): Promise<VpsRunResponse> {
  const baseUrl = getScraperApiUrl();
  const apiKey = getScraperApiKey();
  if (!baseUrl || !apiKey) {
    throw new Error(
      "SCRAPER_API_URL dan SCRAPER_API_KEY belum diset di environment.",
    );
  }

  const wait = opts.wait ?? true;
  const timeoutSec = opts.timeout ?? 900;
  const requestTimeoutMs = wait
    ? Math.min(Math.max(timeoutSec * 1000 + 15_000, 30_000), DEFAULT_TIMEOUT_MS)
    : 60_000;
  const isShopee = actorId.startsWith("shopee-");
  const maxBusyWaits = isShopee ? 36 : 0;

  const url = `${baseUrl}/api/v1/actors/${encodeURIComponent(actorId)}/runs`;

  const performRun = async (): Promise<VpsRunResponse> => {
    let busyWaits = 0;
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input,
            wait,
            timeout: timeoutSec,
          }),
          signal: controller.signal,
          cache: "no-store",
        });

        const text = await res.text();
        if (isShopee && isVpsBusyOrCooldownResponse(res.status, text)) {
          if (busyWaits < maxBusyWaits) {
            busyWaits += 1;
            console.info(
              `[scraper-api/shopee] VPS sibuk/cooldown (${busyWaits}/${maxBusyWaits}) — tunggu 5s…`,
            );
            await sleep(5000);
            continue;
          }
          throw new Error(
            `VPS Shopee masih sibuk/cooldown setelah ${maxBusyWaits * 5}s: ${text.slice(0, 200)}`,
          );
        }

        if (!res.ok) {
          throw new Error(
            `VPS scraper gagal (${res.status}): ${text.slice(0, 400) || res.statusText}`,
          );
        }

        let payload: VpsRunResponse;
        try {
          payload = JSON.parse(text) as VpsRunResponse;
        } catch {
          throw new Error(
            `VPS scraper mengembalikan JSON tidak valid: ${text.slice(0, 200)}`,
          );
        }

        if (payload.status === "failed" && opts.throwOnFailed !== false) {
          throw new Error(
            payload.error ?? "Scrape VPS gagal tanpa pesan error.",
          );
        }

        return payload;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            `VPS scraper timeout setelah ${Math.round(requestTimeoutMs / 1000)} detik.`,
          );
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
  };

  return isShopee ? runWithShopeeVpsGate(performRun) : performRun();
}

export async function getVpsRunStatus(runId: string): Promise<VpsRunResponse> {
  const baseUrl = getScraperApiUrl();
  const apiKey = getScraperApiKey();
  if (!baseUrl || !apiKey) {
    throw new Error(
      "SCRAPER_API_URL dan SCRAPER_API_KEY belum diset di environment.",
    );
  }

  const res = await fetch(
    `${baseUrl}/api/v1/runs/${encodeURIComponent(runId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `VPS scraper status gagal (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  return JSON.parse(text) as VpsRunResponse;
}

export async function fetchVpsRunDataset(
  runId: string,
): Promise<Record<string, unknown>[]> {
  const baseUrl = getScraperApiUrl();
  const apiKey = getScraperApiKey();
  if (!baseUrl || !apiKey) {
    throw new Error(
      "SCRAPER_API_URL dan SCRAPER_API_KEY belum diset di environment.",
    );
  }

  const res = await fetch(
    `${baseUrl}/api/v1/runs/${encodeURIComponent(runId)}/dataset/items?limit=1000`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `VPS scraper dataset gagal (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const payload = JSON.parse(text) as { items?: Record<string, unknown>[] };
  return payload.items ?? [];
}

/** Ambil semua item run — inline response VPS sering terpotong vs `count`. */
export async function loadAllVpsRunItems(
  run: Pick<VpsRunResponse, "run_id" | "count" | "items">,
): Promise<Record<string, unknown>[]> {
  const inline = run.items ?? [];
  const expected = run.count ?? inline.length;
  if (!run.run_id) return inline;
  if (expected > inline.length) {
    return fetchVpsRunDataset(run.run_id);
  }
  return inline;
}
