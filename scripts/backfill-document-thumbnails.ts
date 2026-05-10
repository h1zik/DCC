/**
 * Backfill `RoomDocument.thumbPath` untuk berkas lama (gambar + video) yang
 * sudah ada SEBELUM fitur thumbnail dirilis.
 *
 * Jalankan:
 *   npx tsx scripts/backfill-document-thumbnails.ts
 *
 * Aman dijalankan berulang — kita hanya memproses baris yang `thumbPath`
 * masih NULL. Bila ekstraksi gagal (file hilang, codec aneh), baris di-skip
 * dan kita lanjut ke berikutnya.
 *
 * Mendukung opsi:
 *   --type=video      hanya proses video
 *   --type=image      hanya proses gambar
 *   --limit=100       batasi jumlah baris (default semua)
 *   --dry-run         hanya log, tidak menulis DB / file
 */

import { stat } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { regenerateThumbnailForExistingFile } from "../src/lib/document-thumbnail";
import { absolutePathFromStoredPublicPath } from "../src/lib/upload-storage";

type Cli = { type: "image" | "video" | "all"; limit: number | null; dry: boolean };

function parseArgs(): Cli {
  const args = process.argv.slice(2);
  let type: Cli["type"] = "all";
  let limit: number | null = null;
  let dry = false;
  for (const a of args) {
    if (a === "--dry-run") dry = true;
    else if (a.startsWith("--type=")) {
      const v = a.slice(7);
      if (v === "image" || v === "video" || v === "all") type = v;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice(8));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { type, limit, dry };
}

async function main() {
  const cli = parseArgs();
  const mimeFilter =
    cli.type === "image"
      ? { startsWith: "image/" }
      : cli.type === "video"
        ? { startsWith: "video/" }
        : undefined;

  const docs = await prisma.roomDocument.findMany({
    where: {
      thumbPath: null,
      publicPath: { startsWith: "/uploads/rooms/" },
      ...(mimeFilter ? { mimeType: mimeFilter } : {}),
    },
    select: {
      id: true,
      mimeType: true,
      publicPath: true,
      size: true,
      fileName: true,
    },
    orderBy: { createdAt: "desc" },
    take: cli.limit ?? undefined,
  });

  console.log(
    `Memproses ${docs.length} dokumen (type=${cli.type}, limit=${cli.limit ?? "∞"}, dry=${cli.dry})`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    const tag = `[${i + 1}/${docs.length}] ${doc.fileName}`;

    const isImage = doc.mimeType.startsWith("image/");
    const isVideo = doc.mimeType.startsWith("video/");
    if (!isImage && !isVideo) {
      skipped += 1;
      continue;
    }

    const absSource = absolutePathFromStoredPublicPath(doc.publicPath);
    if (!absSource) {
      console.warn(`${tag} — path public tidak valid (${doc.publicPath})`);
      failed += 1;
      continue;
    }

    let exists = false;
    try {
      const s = await stat(absSource);
      exists = s.isFile();
    } catch {
      exists = false;
    }
    if (!exists) {
      console.warn(`${tag} — file di disk tidak ada (${absSource})`);
      failed += 1;
      continue;
    }

    if (cli.dry) {
      console.log(`${tag} — (dry) akan generate thumbnail`);
      continue;
    }

    try {
      const thumbPath = await regenerateThumbnailForExistingFile({
        absSourceFile: absSource,
        publicPath: doc.publicPath,
        mimeType: doc.mimeType,
        sizeBytes: doc.size,
      });
      if (!thumbPath) {
        console.warn(`${tag} — ekstraksi gagal / di-skip`);
        skipped += 1;
        continue;
      }
      await prisma.roomDocument.update({
        where: { id: doc.id },
        data: { thumbPath },
      });
      console.log(`${tag} → ${thumbPath}`);
      ok += 1;
    } catch (err) {
      console.error(`${tag} — error:`, err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  console.log(`\nSelesai. ok=${ok} skipped=${skipped} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
