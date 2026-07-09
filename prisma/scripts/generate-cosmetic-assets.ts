/**
 * Generate placeholder animated WebP + poster statis untuk kosmetik earned.
 * Output: `public/cosmetics/`. Aman diulang; ganti file manual untuk aset final.
 *
 *   npx tsx prisma/scripts/generate-cosmetic-assets.ts
 */
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  COSMETIC_BG_ASSETS,
  COSMETIC_BORDER_ASSETS,
} from "../../src/lib/gamification/cosmetic-assets";

const OUT = path.join(process.cwd(), "public", "cosmetics");
const W = 960;
const H = 540;
const FRAME = 20;
const DELAY_MS = 80;

type BgKind = keyof typeof COSMETIC_BG_ASSETS;

async function replaceFile(
  outPath: string,
  writeTemp: (tempPath: string) => Promise<void>,
): Promise<void> {
  const tempPath = `${outPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeTemp(tempPath);
    await rename(tempPath, outPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

function bgSvg(kind: BgKind, t: number): string {
  const phase = t * Math.PI * 2;
  const palettes: Record<BgKind, [string, string, string]> = {
    aurora: ["#3b1f8c", "#0e7490", "#7c3aed"],
    bokeh: ["#0f172a", "#1e3a5f", "#fbbf24"],
    parallax: ["#1a0533", "#4c1d95", "#ec4899"],
    "shader-flux": ["#0c0a1a", "#312e81", "#22d3ee"],
  };
  const [c1, c2, c3] = palettes[kind];
  const ox = Math.sin(phase) * 0.12;
  const oy = Math.cos(phase * 0.7) * 0.1;

  if (kind === "bokeh") {
    const circles = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2 + phase;
      const cx = 50 + Math.cos(a) * (28 + (i % 3) * 8);
      const cy = 50 + Math.sin(a * 0.9) * (22 + (i % 4) * 6);
      const r = 6 + (i % 5) * 3;
      const op = 0.15 + (i % 4) * 0.06;
      return `<circle cx="${cx}%" cy="${cy}%" r="${r}%" fill="${i % 2 ? c3 : c2}" opacity="${op}"/>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 100 56">
      <rect width="100" height="56" fill="${c1}"/>
      ${circles}
    </svg>`;
  }

  if (kind === "parallax") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 100 56">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="100" height="56" fill="url(#g1)"/>
      <ellipse cx="${45 + ox * 30}" cy="${30 + oy * 20}" rx="42" ry="28" fill="${c2}" opacity="0.55"/>
      <ellipse cx="${60 - ox * 25}" cy="${38 - oy * 15}" rx="35" ry="22" fill="${c3}" opacity="0.35"/>
      <ellipse cx="${25 + ox * 18}" cy="${42}" rx="28" ry="18" fill="${c3}" opacity="0.25"/>
    </svg>`;
  }

  if (kind === "shader-flux") {
    const angle = 35 + Math.sin(phase) * 25;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 100 56">
      <rect width="100" height="56" fill="${c1}"/>
      <rect width="140" height="140" x="-20" y="-40"
        fill="url(#flux)" transform="rotate(${angle} 50 28)" opacity="0.85"/>
      <defs>
        <linearGradient id="flux" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${c2}" stop-opacity="0"/>
          <stop offset="40%" stop-color="${c3}" stop-opacity="0.7"/>
          <stop offset="60%" stop-color="${c2}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
        </linearGradient>
      </defs>
    </svg>`;
  }

  // aurora (default)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 100 56">
    <rect width="100" height="56" fill="${c1}"/>
    <ellipse cx="${30 + ox * 40}" cy="${25 + oy * 30}" rx="38" ry="30" fill="${c2}" opacity="0.65"/>
    <ellipse cx="${72 - ox * 30}" cy="${35 - oy * 20}" rx="32" ry="26" fill="${c3}" opacity="0.5"/>
    <ellipse cx="${50 + ox * 20}" cy="${48}" rx="45" ry="18" fill="${c3}" opacity="0.3"/>
  </svg>`;
}

function borderHoloSvg(t: number): string {
  const angle = t * 360;
  const S = 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="holo" gradientTransform="rotate(${angle} 0.5 0.5)">
        <stop offset="0%" stop-color="#22d3ee"/>
        <stop offset="25%" stop-color="#a78bfa"/>
        <stop offset="50%" stop-color="#f472b6"/>
        <stop offset="75%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#holo)" stroke-width="5" opacity="0.95"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="white" stroke-width="1.5" opacity="0.25"/>
  </svg>`;
}

async function animatedWebp(
  frames: Buffer[],
  outPath: string,
): Promise<void> {
  await replaceFile(outPath, async (tempPath) => {
    const result = await sharp(frames, { join: { animated: true } })
      .webp({ quality: 82, effort: 4, delay: DELAY_MS, loop: 0 })
      .toFile(tempPath);

    if (result.pages !== frames.length || !result.pageHeight) {
      throw new Error(
        `Expected ${path.basename(outPath)} to be animated (${frames.length} frames), got pages=${result.pages ?? 1}`,
      );
    }
  });
}

async function staticWebp(svg: string, outPath: string): Promise<void> {
  await replaceFile(outPath, async (tempPath) => {
    await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(tempPath);
  });
}

async function generateBg(kind: BgKind, asset: (typeof COSMETIC_BG_ASSETS)[BgKind]) {
  const frames: Buffer[] = [];
  for (let i = 0; i < FRAME; i++) {
    frames.push(Buffer.from(bgSvg(kind, i / FRAME)));
  }
  const srcName = path.basename(asset.src);
  const posterName = path.basename(asset.poster);
  await animatedWebp(frames, path.join(OUT, srcName));
  await staticWebp(bgSvg(kind, 0), path.join(OUT, posterName));
  console.log(`  ✓ ${srcName} + ${posterName}`);
}

async function generateBorderHolo() {
  const asset = COSMETIC_BORDER_ASSETS.holo;
  const frames: Buffer[] = [];
  for (let i = 0; i < FRAME; i++) {
    frames.push(Buffer.from(borderHoloSvg(i / FRAME)));
  }
  const srcName = path.basename(asset.src);
  const posterName = path.basename(asset.poster);
  await animatedWebp(frames, path.join(OUT, srcName));
  await staticWebp(borderHoloSvg(0), path.join(OUT, posterName));
  console.log(`  ✓ ${srcName} + ${posterName}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("Generating cosmetic assets → public/cosmetics/");

  for (const [kind, asset] of Object.entries(COSMETIC_BG_ASSETS) as [
    BgKind,
    (typeof COSMETIC_BG_ASSETS)[BgKind],
  ][]) {
    await generateBg(kind, asset);
  }
  await generateBorderHolo();

  const readme = `# Cosmetic assets (earned profile rewards)

Generated placeholder animated WebP files. Replace with curated WebM/WebP for production.

Regenerate placeholders:
  npx tsx prisma/scripts/generate-cosmetic-assets.ts
`;
  await writeFile(path.join(OUT, "README.md"), readme, "utf8");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
