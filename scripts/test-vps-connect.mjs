import "dotenv/config";

const base = process.env.SCRAPER_API_URL?.replace(/\/+$/, "");
const key = process.env.SCRAPER_API_KEY;

console.log("SCRAPER_API_URL:", base);
console.log("SCRAPER_API_KEY set:", !!key);

async function probe(path, opts = {}) {
  const url = `${base}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        Accept: "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(opts.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    console.log(`\n[OK ${res.status}] ${path} (${Date.now() - t0}ms)`);
    console.log(text.slice(0, 500));
    return true;
  } catch (err) {
    console.log(`\n[FAIL] ${path} (${Date.now() - t0}ms)`);
    console.log("  name:", err.name);
    console.log("  message:", err.message);
    if (err.cause) {
      console.log("  cause:", err.cause);
      if (err.cause instanceof Error) {
        console.log("  cause.code:", err.cause.code);
      }
    }
    return false;
  }
}

if (!base) {
  console.error("SCRAPER_API_URL not set");
  process.exit(1);
}

await probe("/health");
await probe("/api/v1/actors/shopee-search/runs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: {
      keyword: "deodorant",
      page: 0,
      limit: 3,
      download_images: false,
      include_exact_sold: true,
    },
    wait: true,
    timeout: 120,
  }),
});
