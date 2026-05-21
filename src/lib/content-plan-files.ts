import path from "node:path";

/** Path publik `/uploads/...` yang disimpan di baris content planning. */
export function listContentPlanStoredFilePaths(row: {
  copywritingFilePath: string | null;
  designFilePaths: string[];
}): string[] {
  const out: string[] = [];
  const cw = row.copywritingFilePath?.trim();
  if (cw?.startsWith("/uploads/")) out.push(cw);
  for (const p of row.designFilePaths ?? []) {
    const t = p?.trim();
    if (t?.startsWith("/uploads/")) out.push(t);
  }
  return out;
}

export function contentPlanHasStoredFiles(row: {
  copywritingFilePath: string | null;
  designFilePaths: string[];
}): boolean {
  return listContentPlanStoredFilePaths(row).length > 0;
}

export function contentPlanDownloadApiPath(roomId: string, itemId: string): string {
  return `/api/rooms/${roomId}/content-plan/${itemId}/download`;
}

/** Nama file di dalam zip — hindari tabrakan nama. */
export function zipEntryNameForContentPlanFile(
  publicPath: string,
  role: "copywriting" | "design",
  designIndex?: number,
): string {
  const base = path.basename(publicPath.split("?")[0] ?? "file");
  if (role === "copywriting") return `copywriting-${base}`;
  const idx =
    designIndex != null && designIndex >= 0
      ? String(designIndex + 1).padStart(2, "0")
      : "01";
  return `design-${idx}-${base}`;
}

export function sanitizeContentPlanDownloadLabel(konten: string, itemId: string): string {
  const trimmed = konten.trim();
  const base =
    trimmed.replace(/[^\w\s.-]/g, "_").replace(/\s+/g, "_").slice(0, 80) ||
    `content-plan-${itemId.slice(0, 8)}`;
  return base || "content-plan";
}
