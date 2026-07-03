/**
 * Eval golden-set prompt klasifikasi review.
 *
 * Jalankan manual (butuh GEMINI_API_KEY di env / .env):
 *   npx tsx scripts/eval-review-analysis.ts
 *
 * Jalankan SETIAP KALI mengubah prompt di src/lib/research/prompts/review-analysis.ts.
 * Target: sentiment accuracy >= 0.9, theme hit rate >= 0.7. Bila turun setelah
 * perubahan prompt, itu regresi — jangan ship.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) {
    console.error("GEMINI_API_KEY belum diset — eval butuh akses model nyata.");
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

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  console.log(
    `Eval prompt v${golden.promptVersion} · model ${modelName} · ${golden.cases.length} kasus…\n`,
  );

  const result = await model.generateContent(prompt);
  const parsed = parseExtractedJson<ModelReviewResult>(result.response.text());
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
