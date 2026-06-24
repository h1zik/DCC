/**
 * Uji actor shopee-product di VPS (competitor products single URL).
 * Usage: node scripts/test-vps-competitor-product.mjs "https://shopee.co.id/..."
 */
import "dotenv/config";

const base = process.env.SCRAPER_API_URL?.replace(/\/+$/, "");
const key = process.env.SCRAPER_API_KEY;
const productUrl = process.argv[2];
const actorId = "shopee-product";

if (!base || !key) {
  console.error("SCRAPER_API_URL / SCRAPER_API_KEY belum diset");
  process.exit(1);
}

if (!productUrl) {
  console.error("Usage: node scripts/test-vps-competitor-product.mjs <shopee_product_url>");
  process.exit(1);
}

const timeoutSec = 300;
const url = `${base}/api/v1/actors/${encodeURIComponent(actorId)}/runs`;
const body = {
  input: {
    product_url: productUrl.trim(),
    download_images: false,
  },
  wait: true,
  timeout: timeoutSec,
};

console.log("Actor:", actorId);
console.log("Product URL:", productUrl);
console.log("POST", url);
console.log("Timeout:", timeoutSec, "s\n");

const t0 = Date.now();
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), (timeoutSec + 30) * 1000);

try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const text = await res.text();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`HTTP ${res.status} (${elapsed}s)`);
  if (!res.ok) {
    console.error(text.slice(0, 2000));
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    console.error("Invalid JSON:", text.slice(0, 500));
    process.exit(1);
  }

  console.log("\n--- Run summary ---");
  console.log("status:", payload.status);
  console.log("error:", payload.error ?? "(none)");
  console.log("count:", payload.count);
  console.log("run_id:", payload.run_id);

  const items = payload.items ?? [];
  if (items.length === 0 && payload.run_id) {
    console.log("\nFetching dataset items...");
    const dsRes = await fetch(
      `${base}/api/v1/runs/${encodeURIComponent(payload.run_id)}/dataset/items?limit=10`,
      {
        headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
      },
    );
    const dsText = await dsRes.text();
    if (dsRes.ok) {
      const ds = JSON.parse(dsText);
      const fetched = ds.items ?? [];
      console.log("dataset items:", fetched.length);
      if (fetched[0]) {
        console.log("\n--- First item keys ---");
        console.log(Object.keys(fetched[0]).join(", "));
        console.log("\n--- First item preview ---");
        console.log(JSON.stringify(fetched[0], null, 2).slice(0, 2500));
      }
    } else {
      console.error("Dataset fetch failed:", dsRes.status, dsText.slice(0, 500));
    }
  } else if (items[0]) {
    console.log("\n--- First inline item keys ---");
    console.log(Object.keys(items[0]).join(", "));
    console.log("\n--- First item preview ---");
    console.log(JSON.stringify(items[0], null, 2).slice(0, 2500));
  } else {
    console.log("\nNo items returned.");
  }

  if (payload.status === "failed") {
    process.exit(2);
  }
  if ((payload.count ?? items.length) === 0) {
    process.exit(3);
  }
} catch (err) {
  console.error("\nRequest failed:", err.name, err.message);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
