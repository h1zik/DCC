import "server-only";

const APIFY_BASE = "https://api.apify.com/v2";

export function getApifyToken(): string | null {
  return process.env.APIFY_API_TOKEN?.trim() || null;
}

export function isApifyConfigured(): boolean {
  return !!getApifyToken();
}

type ApifyRunResponse = {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
};

type ApifyRunStatus = {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
};

/** Terima `gio21/shopee-scraper` atau `gio21~shopee-scraper`. */
export function normalizeApifyActorId(actorId: string): string {
  return actorId.trim().replace(/\//g, "~");
}

export async function startApifyActor(
  actorId: string,
  input: Record<string, unknown>,
): Promise<{ runId: string; datasetId: string }> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("APIFY_API_TOKEN belum diset di environment.");
  }

  const act = normalizeApifyActorId(actorId);
  const res = await fetch(
    `${APIFY_BASE}/acts/${act}/runs?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify start run gagal (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as ApifyRunResponse;
  return {
    runId: json.data.id,
    datasetId: json.data.defaultDatasetId,
  };
}

export async function getApifyRunStatus(runId: string): Promise<{
  status: string;
  datasetId: string;
}> {
  const token = getApifyToken();
  if (!token) throw new Error("APIFY_API_TOKEN belum diset.");

  const res = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) {
    throw new Error(`Apify get run gagal (${res.status})`);
  }
  const json = (await res.json()) as ApifyRunStatus;
  return {
    status: json.data.status,
    datasetId: json.data.defaultDatasetId,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Tunggu run Apify selesai (dipakai saat cron belum jalan, mis. dev lokal). */
export async function waitForApifyRun(
  runId: string,
  opts?: { maxWaitMs?: number; pollIntervalMs?: number },
): Promise<{ status: string; datasetId: string }> {
  const maxWaitMs = opts?.maxWaitMs ?? 600_000;
  const pollIntervalMs = opts?.pollIntervalMs ?? 5_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const { status, datasetId } = await getApifyRunStatus(runId);
    if (
      status === "SUCCEEDED" ||
      status === "FAILED" ||
      status === "ABORTED" ||
      status === "TIMED-OUT"
    ) {
      return { status, datasetId };
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    "Apify run belum selesai dalam batas waktu. Coba refresh halaman atau jalankan cron research-sync.",
  );
}

export async function fetchApifyDataset<T = Record<string, unknown>>(
  datasetId: string,
): Promise<T[]> {
  const token = getApifyToken();
  if (!token) throw new Error("APIFY_API_TOKEN belum diset.");

  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&format=json`,
  );
  if (!res.ok) {
    throw new Error(`Apify dataset fetch gagal (${res.status})`);
  }
  return (await res.json()) as T[];
}
