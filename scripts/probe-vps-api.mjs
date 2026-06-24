import "dotenv/config";

const base = process.env.SCRAPER_API_URL?.replace(/\/+$/, "");
const key = process.env.SCRAPER_API_KEY;

if (!base || !key) {
  console.error("SCRAPER_API_URL / SCRAPER_API_KEY missing");
  process.exit(1);
}

const paths = [
  "/health",
  "/api/v1/actors",
  "/api/v1/runs?limit=10",
  "/api/v1/runs?status=running",
  "/api/v1/shopee/active",
];

for (const path of paths) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const text = await res.text();
    console.log(`\n=== ${path} [${res.status}] ===`);
    console.log(text.slice(0, 4000));
  } catch (err) {
    console.log(`\n=== ${path} FAIL ===`, err.message);
  }
}
