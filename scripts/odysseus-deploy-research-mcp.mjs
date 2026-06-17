import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const [host, password] = process.argv.slice(2);
const base = "/root/odysseus/integrations/dcc-mcp";
const skillsBase = "/root/odysseus/data/skills/general";

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      let errOut = "";
      stream.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(errOut || out || `exit ${code}`));
      });
      stream.on("data", (d) => {
        out += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on("data", (d) => {
        errOut += d.toString();
        process.stderr.write(d);
      });
    });
  });
}

function uploadText(conn, remotePath, content) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const ws = sftp.createWriteStream(remotePath);
      ws.on("close", resolve);
      ws.on("error", reject);
      ws.end(content);
    });
  });
}

async function mkdirp(conn, dir) {
  await exec(conn, `mkdir -p "${dir}"`);
}

const conn = new Client();
conn
  .on("ready", async () => {
    try {
      const researchTools = readFileSync(
        join(__dirname, "../mcp-server/src/register-research-tools.ts"),
        "utf8",
      );
      await uploadText(conn, `${base}/src/register-research-tools.ts`, researchTools);
      console.log("Uploaded register-research-tools.ts");

      let createServer = await exec(conn, `cat ${base}/src/create-server.ts`);
      createServer = createServer.replace(/version: "3\.\d+\.\d+"/, 'version: "3.3.0"');
      await uploadText(conn, `${base}/src/create-server.ts`, createServer);
      console.log("Bumped create-server.ts to 3.3.0");

      const buildCmd = [
        `cd ${base}`,
        "docker run --rm -v $(pwd):/app -w /app node:20-alpine sh -c 'npm install --silent && npm run build'",
      ].join(" && ");
      await exec(conn, buildCmd);
      console.log("Built dcc-mcp via Docker");

      const toolCheck = await exec(
        conn,
        `grep -c evaluate_product_with_research ${base}/dist/register-research-tools.js && grep -c analyze_competitor_pricing ${base}/dist/register-research-tools.js`,
      );
      console.log(`Tool check (evaluate + pricing): ${toolCheck.trim()}`);

      const skillDir = `${skillsBase}/validate-product-with-dcc-research`;
      const skillContent = readFileSync(
        join(__dirname, "odysseus-skills/validate-product-with-dcc-research/SKILL.md"),
        "utf8",
      );
      await mkdirp(conn, skillDir);
      await uploadText(conn, `${skillDir}/SKILL.md`, skillContent);
      console.log("Uploaded validate-product-with-dcc-research skill");

      const updatedQuerySkill = `---
name: query-dcc-research-hub-for-product-market-intelligence
description: "Query DCC Research Hub untuk intelijen pasar produk — harga kompetitor, review, tren, validasi launch"
version: 2.0.0
category: general
tags: [DCC, Research Hub, market intelligence, MCP tools, product analysis, pricing, make sense]
status: published
confidence: 0.95
source: manual
owner: admin
created: "2026-06-17T12:00:00Z"
---

## When to Use

Gather market intelligence atau validasi produk/harga dari DCC Research Hub — body lotion, skincare, pricing, competitor analysis, "apakah make sense".

## Procedure

1. Untuk validasi produk/harga/launch → **mulai dengan evaluate_product_with_research** (bukan list manual).
2. Untuk pertanyaan harga kompetitor → **analyze_competitor_pricing** dengan productQuery.
3. Overview KPI → get_research_hub_dashboard.
4. Detail tambahan: list_review_intel_sources → get_review_intel_source, list_usp_gap_analyses → get_usp_gap_analysis.
5. Berikan verdict + bukti, jangan dump JSON mentah.
`;
      await mkdirp(conn, `${skillsBase}/query-dcc-research-hub-for-product-market-intelligence`);
      await uploadText(
        conn,
        `${skillsBase}/query-dcc-research-hub-for-product-market-intelligence/SKILL.md`,
        updatedQuerySkill,
      );
      console.log("Updated query-dcc-research-hub skill v2");

      await exec(
        conn,
        "docker exec odysseus-dominatus-1 python3 /app/scripts/sync_dcc_mcp_env.py 2>/dev/null || true",
      );
      await exec(conn, "docker restart odysseus-dominatus-1");
      console.log("Done: MCP v3.3.0 deployed, skills updated, Odysseus restarted");
      conn.end();
    } catch (e) {
      console.error(e);
      conn.end();
      process.exit(1);
    }
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect({
    host,
    port: 22,
    username: "root",
    password,
    readyTimeout: 20000,
  });
