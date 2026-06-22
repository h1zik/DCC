import "dotenv/config";

const base = process.env.SCRAPER_API_URL?.replace(/\/+$/, "");
const key = process.env.SCRAPER_API_KEY;
const productUrl =
  process.argv[2] ||
  "https://shopee.co.id/product-i.11245823.50158881370";

console.log("Testing shopee-reviews for:", productUrl);

const t0 = Date.now();
try {
  const res = await fetch(`${base}/api/v1/actors/shopee-reviews/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: {
        product_url: productUrl,
        limit: 50,
        max_pages: 5,
        download_images: false,
      },
      wait: true,
      timeout: 180,
    }),
    signal: AbortSignal.timeout(200_000),
  });
  const text = await res.text();
  console.log("HTTP", res.status, "elapsed", Math.round((Date.now() - t0) / 1000) + "s");
  const data = JSON.parse(text);
  console.log(
    JSON.stringify(
      {
        status: data.status,
        error: data.error,
        count: data.count,
        inlineItems: data.items?.length ?? 0,
        firstItemKeys: data.items?.[0] ? Object.keys(data.items[0]).slice(0, 12) : [],
      },
      null,
      2,
    ),
  );
  if (data.run_id && (data.count ?? 0) > (data.items?.length ?? 0)) {
    const ds = await fetch(
      `${base}/api/v1/runs/${data.run_id}/dataset/items?limit=5`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const dsJson = await ds.json();
    console.log("dataset fetch items:", dsJson.items?.length);
  }
} catch (err) {
  console.error("FAIL", err.message);
  if (err.cause) console.error("cause", err.cause);
}
