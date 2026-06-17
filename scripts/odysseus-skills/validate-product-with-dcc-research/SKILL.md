---
name: validate-product-with-dcc-research
description: "Validasi ide produk, harga, dan launch pakai DCC Research Hub MCP — make sense, layak, worth it, pricing kompetitor"
version: 1.0.0
category: general
tags: [DCC, Research Hub, MCP, product validation, pricing, competitor, make sense, body lotion, skincare]
status: published
confidence: 0.95
source: manual
owner: admin
created: "2026-06-17T12:00:00Z"
---

## When to Use

User bertanya apakah ide produk/harga/launch **make sense**, **layak**, **worth it**, atau minta validasi pasar — misalnya: "jual body lotion 39rb instant whitening 250ml, apakah masuk akal?"

Juga untuk: bandingkan harga vs kompetitor, cek positioning, validasi claim produk.

## Procedure (proaktif — jangan tanya modul mana)

1. Verifikasi MCP DCC tersedia (`mcp__029b2437__*` atau prefix serupa).
2. **Langkah pertama WAJIB:** panggil `evaluate_product_with_research` dengan:
   - `productQuery`: kategori/produk (mis. "body lotion")
   - `proposedPrice`: harga IDR jika user menyebutkan (mis. 39000)
   - `claims`: claim produk (mis. "instant whitening")
   - `sizeMl`: volume jika disebutkan (mis. 250)
   - `packagingNotes`: kemasan jika disebutkan (mis. "stiker design")
3. Jika perlu detail harga tambahan → `analyze_competitor_pricing` dengan `productQuery` yang sama.
4. **Jangan** berhenti di `list_research_competitors` saja — itu ringkasan, bukan analisis.
5. **Jangan** bilang "tidak ada data harga" tanpa memanggil `analyze_competitor_pricing` atau `evaluate_product_with_research`.
6. Setelah data terkumpul, berikan **verdict jelas** (make sense / dengan catatan / kurang make sense) dengan bukti:
   - Harga vs min/max/avg pasar (Competitor Tracker + Product Discovery)
   - Landscape marketplace: price band, top seller, promo (Product Discovery)
   - Claim vs keluhan/pujian di Review Intel
   - Gap positioning dari USP Analyzer
   - Sinyal tren/keyword/social jika relevan

## Tool names (prefix MCP mungkin berbeda)

- `evaluate_product_with_research` — tool composite utama (Competitor Tracker + Product Discovery + Review Intel + tren/keyword/USP/social)
- `analyze_competitor_pricing` — detail harga per SKU kompetitor
- `get_research_hub_dashboard` — overview KPI riset
- `list_research_competitors` / `get_research_competitor` — hanya ringkasan, lanjut ke tool analisis
- `list_review_intel_sources` / `get_review_intel_source`
- `list_trend_digests` / `get_trend_digest`
- `list_keyword_intel_queries` / `get_keyword_intel_query`
- `list_usp_gap_analyses` / `get_usp_gap_analysis`
- `list_product_discovery_queries` / `get_product_discovery_query` — landscape scrape marketplace (juga sudah disertakan di evaluate)
- `list_social_listening_monitors` / `get_social_listening_monitor`
