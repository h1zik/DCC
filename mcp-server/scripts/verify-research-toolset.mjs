import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const EXPECTED_TOOLS = [
  "analyze_competitor_pricing",
  "evaluate_product_with_research",
  "get_competitor_product_category",
  "get_keyword_intel_query",
  "get_product_concept",
  "get_product_discovery_query",
  "get_research_competitor",
  "get_research_hub_dashboard",
  "get_research_report",
  "get_review_intel_source",
  "get_social_listening_monitor",
  "get_trend_digest",
  "get_usp_gap_analysis",
  "list_competitor_product_categories",
  "list_keyword_intel_queries",
  "list_product_concepts",
  "list_product_discovery_queries",
  "list_research_competitors",
  "list_research_recommendations",
  "list_research_reports",
  "list_review_intel_sources",
  "list_social_listening_monitors",
  "list_trend_digests",
  "list_usp_gap_analyses",
  "search_competitor_products",
].sort();

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close((error) => {
        if (error) reject(error);
        else if (port === null) reject(new Error("Tidak mendapat port test."));
        else resolve(port);
      });
    });
  });
}

async function waitUntilHealthy(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server masih booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server MCP Research tidak sehat setelah 3 detik.");
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = await getAvailablePort();
const path = "/mcp-research-isolation-test";
const child = spawn(process.execPath, [join(root, "dist", "index.js")], {
  cwd: root,
  env: {
    ...process.env,
    DCC_AI_API_URL: "http://127.0.0.1:9",
    DCC_AI_READ_API_TOKEN: "research-test-token",
    MCP_TOOLSET: "research",
    MCP_HTTP_HOST: "127.0.0.1",
    MCP_HTTP_PORT: String(port),
    MCP_HTTP_PATH: path,
  },
  stdio: "ignore",
});

let client;
try {
  await waitUntilHealthy(`http://127.0.0.1:${port}/health`);
  client = new Client({ name: "research-isolation-test", version: "1" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${port}${path}`),
  );
  await client.connect(transport);

  const result = await client.listTools();
  const actual = result.tools.map((tool) => tool.name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_TOOLS)) {
    const unexpected = actual.filter((name) => !EXPECTED_TOOLS.includes(name));
    const missing = EXPECTED_TOOLS.filter((name) => !actual.includes(name));
    throw new Error(
      `Toolset Research tidak terisolasi. unexpected=${JSON.stringify(unexpected)} missing=${JSON.stringify(missing)}`,
    );
  }

  console.log(
    JSON.stringify({
      toolset: "research",
      toolCount: actual.length,
      unexpectedTools: [],
    }),
  );
} finally {
  if (client) await client.close().catch(() => undefined);
  child.kill();
}
