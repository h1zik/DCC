import type { EvidenceRef, EvidenceSnapshot, StrategyFieldRationale } from "./evidence-types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Stp = {
  segment?: string;
  targeting?: string;
  positioningStatement?: string;
};

type Personality = {
  archetype?: string;
  traits?: string[];
  antiTraits?: string[];
};

type Tone = {
  principles?: string[];
  doExamples?: string[];
  dontExamples?: string[];
};

function parseEvidenceRefs(raw: unknown): EvidenceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is EvidenceRef =>
      typeof r === "object" &&
      r != null &&
      typeof (r as EvidenceRef).field === "string" &&
      typeof (r as EvidenceRef).source === "string" &&
      typeof (r as EvidenceRef).snippet === "string",
  );
}

function parseSnapshot(raw: unknown): EvidenceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as EvidenceSnapshot;
  if (typeof s.gatheredAt !== "string") return null;
  return s;
}

function parseRationales(raw: unknown): StrategyFieldRationale[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is StrategyFieldRationale =>
      typeof r === "object" &&
      r != null &&
      typeof (r as StrategyFieldRationale).field === "string" &&
      typeof (r as StrategyFieldRationale).reasoning === "string",
  );
}

export function buildBrandStrategyPdfHtml(input: {
  brandName: string;
  document: {
    brandPurpose: string | null;
    brandEssence: string | null;
    coreMessage: string | null;
    brandUsp: string | null;
    stp: unknown;
    brandPersonality: unknown;
    toneOfVoice: unknown;
    evidenceRefs?: unknown;
    strategyRationales?: unknown;
    evidenceSnapshot?: unknown;
  };
}): string {
  const stp = (input.document.stp ?? {}) as Stp;
  const personality = (input.document.brandPersonality ?? {}) as Personality;
  const tone = (input.document.toneOfVoice ?? {}) as Tone;
  const refs = parseEvidenceRefs(input.document.evidenceRefs);
  const rationales = parseRationales(input.document.strategyRationales);
  const snapshot = parseSnapshot(input.document.evidenceSnapshot);

  const list = (items: string[] | undefined) =>
    items?.length
      ? items.map((i) => `<li>${esc(i)}</li>`).join("")
      : "<li>—</li>";

  const rationaleSection =
    rationales.length > 0
      ? `
  <h2>Alasan per Komponen</h2>
  ${rationales
    .map(
      (r) => `<div style="margin-bottom:16px">
    <p><strong>${esc(r.label ?? r.field)}</strong>${r.confidence ? ` · ${esc(r.confidence)}` : ""}</p>
    <p>${esc(r.reasoning)}</p>
    ${
      r.evidenceRefs?.length
        ? `<ul>${r.evidenceRefs
            .map(
              (ev: EvidenceRef) =>
                `<li>${esc(ev.source)}: ${esc(ev.snippet)}</li>`,
            )
            .join("")}</ul>`
        : ""
    }
  </div>`,
    )
    .join("")}`
      : "";

  const evidenceSection =
    refs.length > 0 || snapshot
      ? `
  <h2>Evidence Sources</h2>
  ${
    snapshot
      ? `<p><strong>Snapshot:</strong> ${esc(snapshot.gatheredAt)} · ${snapshot.sourceRefs?.length ?? 0} sumber terstruktur</p>
  <ul>${(snapshot.sourceRefs ?? [])
    .map(
      (r) =>
        `<li><strong>${esc(r.label)}</strong> (${esc(r.module)}) — ${esc(r.href)}</li>`,
    )
    .join("") || "<li>—</li>"}</ul>`
      : ""
  }
  ${
    refs.length > 0
      ? `<p><strong>AI evidence refs:</strong></p>
  <ul>${refs
    .map(
      (r) =>
        `<li><strong>${esc(r.field)}</strong> · ${esc(r.source)}${r.sourceId ? ` (${esc(r.sourceId)})` : ""}: ${esc(r.snippet)}</li>`,
    )
    .join("")}</ul>`
      : ""
  }`
      : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Brand Strategy — ${esc(input.brandName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; line-height: 1.6; color: #111; max-width: 720px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
    p { margin: 0 0 12px; }
    ul { margin: 0; padding-left: 20px; }
  </style>
</head>
<body>
  <h1>Brand Strategy — ${esc(input.brandName)}</h1>
  <h2>Brand Purpose</h2>
  <p>${esc(input.document.brandPurpose ?? "—")}</p>
  <h2>Brand Essence</h2>
  <p>${esc(input.document.brandEssence ?? "—")}</p>
  <h2>Core Message</h2>
  <p>${esc(input.document.coreMessage ?? "—")}</p>
  <h2>Brand USP (Branding)</h2>
  <p>${esc(input.document.brandUsp ?? "—")}</p>
  <h2>STP</h2>
  <p><strong>Segment:</strong> ${esc(stp.segment ?? "—")}</p>
  <p><strong>Targeting:</strong> ${esc(stp.targeting ?? "—")}</p>
  <p><strong>Positioning:</strong> ${esc(stp.positioningStatement ?? "—")}</p>
  <h2>Brand Personality</h2>
  <p><strong>Archetype:</strong> ${esc(personality.archetype ?? "—")}</p>
  <ul>${list(personality.traits)}</ul>
  <p><strong>Avoid:</strong></p>
  <ul>${list(personality.antiTraits)}</ul>
  <h2>Tone of Voice</h2>
  <ul>${list(tone.principles)}</ul>
  <p><strong>Do:</strong></p>
  <ul>${list(tone.doExamples)}</ul>
  <p><strong>Don't:</strong></p>
  <ul>${list(tone.dontExamples)}</ul>
  ${rationaleSection}
  ${evidenceSection}
</body>
</html>`;
}
