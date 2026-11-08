/**
 * Eval golden-set prompt klasifikasi review.
 *
 * Jalankan manual (butuh OLLAMA_API_KEY di env / .env; model = RESEARCH_OLLAMA_MODEL_FLASH
 * atau default kimi-k3.1-pro:cloud):
 *   npx tsx scripts/eval-review-analysis.ts
 *
 * Jalankan SETIAP KALI mengubah prompt di src/lib/research/prompts/review-analysis.ts.
 * Target: sentiment accuracy >= 0.9, theme hit rate >= 0.7. Bila turun setelah
 * perubahan prompt, itu regresi — jangan ship.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RESEARCH_DEFAULT_OLLAMA_MODELS } from "../src/lib/research/llm/defaults";
import { buildReviewBatchPrompt } from "../src/lib/research/prompts/review-analysis";
import { parseExtractedJson } from "../src/lib/research/llm/extract-json";

type GoldenCase = {
  idx: number;
  text: string;
  rating: number | null;
  expectedSentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  expectedThemeKeywords: string[];
  expectedDemographics?: {
    ageBand?: string;
    skinType?: string;
    gender?: string;
  };
};

type ModelReviewResult = {
  reviews?: {
    idx: number;
    sentiment?: string;
    complaintThemes?: string[];
    praiseThemes?: string[];
    keywords?: string[];
    demographicHints?: {
      ageBand?: string | null;
      skinType?: string | null;
      gender?: string | null;
    } | null;
  }[];
};

async function main() {
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (!apiKey) {
    console.error("OLLAMA_API_KEY belum diset — eval butuh akses model nyata.");
    process.exit(1);
  }

  const golden = JSON.parse(
    readFileSync(
      join(__dirname, "../src/lib/research/evals/review-sentiment-golden.json"),
      "utf-8",
    ),
  ) as { promptVersion: string; cases: GoldenCase[] };

  const prompt = buildReviewBatchPrompt(
    "Serum Wajah (Golden Set Eval)",
    golden.cases.map((c) => ({ idx: c.idx, text: c.text, rating: c.rating })),
  );

  const modelName =
    process.env.RESEARCH_OLLAMA_MODEL_FLASH?.trim() ||
    process.env.RESEARCH_OLLAMA_MODEL?.trim() ||
    RESEARCH_DEFAULT_OLLAMA_MODELS.flash;
  const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || "https://ollama.com").replace(/\/+$/, "");

  console.log(
    `Eval prompt v${golden.promptVersion} · model ${modelName} · ${golden.cases.length} kasus…\n`,
  );

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      think: false,
      format: "json",
      options: { temperature: 0.2 },
    }),
  });
  const payload = (await res.json()) as { message?: { content?: string }; error?: string };
  if (!res.ok) {
    console.error(`Ollama Cloud error ${res.status}: ${payload.error ?? res.statusText}`);
    process.exit(1);
  }
  const parsed = parseExtractedJson<ModelReviewResult>(payload.message?.content ?? "");
  const byIdx = new Map((parsed.reviews ?? []).map((r) => [r.idx, r]));

  let sentimentHits = 0;
  let themeHits = 0;
  let themeTotal = 0;
  const failures: string[] = [];

  for (const c of golden.cases) {
    const r = byIdx.get(c.idx);
    if (!r) {
      failures.push(`#${c.idx}: TIDAK ADA di output model`);
      continue;
    }

    if (r.sentiment === c.expectedSentiment) {
      sentimentHits += 1;
    } else {
      failures.push(
        `#${c.idx}: sentiment ${r.sentiment} ≠ ${c.expectedSentiment} — "${c.text.slice(0, 60)}…"`,
      );
    }

    if (c.expectedThemeKeywords.length > 0) {
      const haystack = [
        ...(r.complaintThemes ?? []),
        ...(r.praiseThemes ?? []),
        ...(r.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      for (const kw of c.expectedThemeKeywords) {
        themeTotal += 1;
        if (haystack.includes(kw.toLowerCase())) {
          themeHits += 1;
        } else {
          failures.push(`#${c.idx}: tema "${kw}" tidak tertangkap`);
        }
      }
    }
  }

  const sentimentAcc = sentimentHits / golden.cases.length;
  const themeRate = themeTotal > 0 ? themeHits / themeTotal : 1;

  console.log(`Sentiment accuracy : ${(sentimentAcc * 100).toFixed(1)}% (target ≥ 90%)`);
  console.log(`Theme hit rate     : ${(themeRate * 100).toFixed(1)}% (target ≥ 70%)`);
  if (failures.length > 0) {
    console.log(`\nKegagalan (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f}`);
  }

  const pass = sentimentAcc >= 0.9 && themeRate >= 0.7;
  console.log(`\n${pass ? "✅ PASS" : "❌ FAIL — prompt regresi, jangan ship."}`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
