function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCreativeGuidelinePdfHtml(input: {
  guideline: {
    colorPalette: unknown;
    typography: unknown;
    designReferences: unknown;
    aiSummary: string | null;
  };
  moodboardAssets: { imageUrl: string; title: string | null }[];
}): string {
  const palette = (input.guideline.colorPalette ?? {}) as {
    primary?: string;
    secondary?: string;
    accent?: string;
    neutrals?: string[];
    rationale?: string;
  };
  const typography = (input.guideline.typography ?? {}) as {
    heading?: string;
    body?: string;
    accent?: string;
    stylingNotes?: string;
  };

  const moodboardHtml = input.moodboardAssets
    .map(
      (a) =>
        `<div style="display:inline-block;width:120px;margin:4px;"><img src="${esc(a.imageUrl)}" style="width:100%;border-radius:8px;" alt="" /><p style="font-size:10px;">${esc(a.title ?? "")}</p></div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Creative Guideline</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; line-height: 1.6; color: #111; }
    h2 { font-size: 14px; margin-top: 24px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
    .swatch { display:inline-block;width:48px;height:48px;border-radius:8px;margin:4px;border:1px solid #ddd; }
  </style>
</head>
<body>
  <h1>Creative Guideline</h1>
  <p>${esc(input.guideline.aiSummary ?? "")}</p>
  <h2>Moodboard</h2>
  <div>${moodboardHtml}</div>
  <h2>Color Palette</h2>
  <div>
    <span class="swatch" style="background:${esc(palette.primary ?? "#ccc")}"></span>
    <span class="swatch" style="background:${esc(palette.secondary ?? "#ccc")}"></span>
    <span class="swatch" style="background:${esc(palette.accent ?? "#ccc")}"></span>
  </div>
  <p>${esc(palette.rationale ?? "")}</p>
  <h2>Typography</h2>
  <p><strong>Heading:</strong> ${esc(typography.heading ?? "—")}</p>
  <p><strong>Body:</strong> ${esc(typography.body ?? "—")}</p>
  <p><strong>Accent:</strong> ${esc(typography.accent ?? "—")}</p>
  <p>${esc(typography.stylingNotes ?? "")}</p>
</body>
</html>`;
}
