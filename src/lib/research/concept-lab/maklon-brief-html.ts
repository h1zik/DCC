import type { ConceptData, ValidationScores } from "@/lib/research/concept-lab/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMaklonBriefHtml(input: {
  title: string;
  category: string;
  targetMarket: string | null;
  priceTargetMin: number | null;
  priceTargetMax: number | null;
  conceptData: ConceptData;
  validationScores: ValidationScores;
}): string {
  const name =
    input.conceptData.selectedName ??
    input.conceptData.nameOptions[0] ??
    input.title;
  const priceRange =
    input.priceTargetMin != null && input.priceTargetMax != null
      ? `Rp ${input.priceTargetMin.toLocaleString("id-ID")} – Rp ${input.priceTargetMax.toLocaleString("id-ID")}`
      : "—";
  const cogs = input.conceptData.estimatedCogsRange;
  const cogsStr =
    cogs.min > 0 || cogs.max > 0
      ? `Rp ${cogs.min.toLocaleString("id-ID")} – Rp ${cogs.max.toLocaleString("id-ID")}`
      : "—";

  const ingredients = input.conceptData.heroIngredients
    .map((i) => `<li><strong>${esc(i.name)}</strong> — ${esc(i.reason)}</li>`)
    .join("");

  const claims = input.conceptData.keyClaims
    .map((c) => `<li>${esc(c)}</li>`)
    .join("");

  const risks = input.validationScores.risks
    .map((r) => `<li>${esc(r)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Maklon Brief — ${esc(name)}</title>
  <style>
    @page { margin: 36pt; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #111;
      line-height: 1.6;
      padding: 40px;
      max-width: 714px;
      margin: 0;
      font-size: 14px;
    }
    h1 { font-size: 22px; margin: 0 0 8px; line-height: 1.3; }
    .meta { color: #666; font-size: 13px; margin: 0; line-height: 1.5; }
    h2 {
      font-size: 15px;
      margin: 0 0 10px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 6px;
      line-height: 1.35;
    }
    p { margin: 0 0 10px; line-height: 1.6; }
    p:last-child { margin-bottom: 0; }
    ul {
      margin: 0;
      padding: 0 0 0 1.35em;
      list-style-type: disc;
      list-style-position: outside;
    }
    li {
      display: list-item;
      margin: 0 0 8px;
      line-height: 1.65;
      padding-left: 0.15em;
    }
    li:last-child { margin-bottom: 0; }
    .scores {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin: 0 0 12px;
    }
    .score {
      background: #f4f4f5;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
    }
    .score strong { display: block; font-size: 18px; margin-bottom: 2px; }
    section[data-pdf-block] {
      margin: 0 0 24px;
      padding: 0 0 14px;
      overflow: visible;
    }
    section[data-pdf-block]:last-child { margin-bottom: 0; }
  </style>
</head>
<body>
  <section data-pdf-block class="pdf-block">
    <h1>Maklon Brief: ${esc(name)}</h1>
    <p class="meta">Kategori: ${esc(input.category)} · Target: ${esc(input.targetMarket ?? "—")} · Harga jual: ${priceRange}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Positioning</h2>
    <p>${esc(input.conceptData.positioningStatement || "—")}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Validator Scores</h2>
    <div class="scores">
      <div class="score"><strong>${input.validationScores.marketDemand}</strong>Market Demand</div>
      <div class="score"><strong>${input.validationScores.differentiation}</strong>Differentiation</div>
      <div class="score"><strong>${input.validationScores.pricingFit}</strong>Pricing Fit</div>
      <div class="score"><strong>${input.validationScores.overall}</strong>Overall</div>
    </div>
    <p>${esc(input.validationScores.aiSummary || "")}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Hero Ingredients</h2>
    <ul>${ingredients || "<li>—</li>"}</ul>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Texture & Format</h2>
    <p>${esc(input.conceptData.textureFormat || "—")}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Key Claims</h2>
    <ul>${claims || "<li>—</li>"}</ul>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Packaging Direction</h2>
    <p>${esc(input.conceptData.packagingDirection || "—")}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Estimated COGS</h2>
    <p>${cogsStr}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Competitor Comparison</h2>
    <p>${esc(input.conceptData.competitorComparison || "—")}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Why It Will Win</h2>
    <p>${esc(input.conceptData.whyItWillWin || "—")}</p>
  </section>

  <section data-pdf-block class="pdf-block">
    <h2>Risks</h2>
    <ul>${risks || "<li>—</li>"}</ul>
  </section>

  <section data-pdf-block class="pdf-block">
    <p class="meta" style="margin-top:8px">Generated by DCC Research Hub — Product Concept Lab</p>
  </section>
</body>
</html>`;
}
