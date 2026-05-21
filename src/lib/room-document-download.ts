import path from "node:path";
import type { RoomFolderNode } from "@/lib/room-document-folders";
import { getChildFolders } from "@/lib/room-document-folders";

export type RoomDocumentDownloadRow = {
  id: string;
  folderId: string | null;
  fileName: string;
  publicPath: string;
};

/** URL unduh folder sebagai zip. */
export function roomFolderDownloadApiPath(
  roomId: string,
  folderId: string,
): string {
  return `/api/rooms/${roomId}/documents/folders/${folderId}/download`;
}

/** URL unduh banyak file (POST). */
export function roomDocumentsBulkDownloadApiPath(roomId: string): string {
  return `/api/rooms/${roomId}/documents/download`;
}

export function sanitizeZipPathSegment(name: string): string {
  const trimmed = name.trim() || "folder";
  return trimmed
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

export function sanitizeZipArchiveBasename(name: string, fallback: string): string {
  const base = sanitizeZipPathSegment(name).replace(/\s/g, "_") || fallback;
  return base.slice(0, 80);
}

/** Semua id folder di bawah `rootFolderId` (termasuk root). */
export function getDescendantFolderIds(
  rootFolderId: string,
  folders: RoomFolderNode[],
): Set<string> {
  const set = new Set<string>([rootFolderId]);
  const walk = (parentId: string) => {
    for (const child of getChildFolders(folders, parentId)) {
      if (!set.has(child.id)) {
        set.add(child.id);
        walk(child.id);
      }
    }
  };
  walk(rootFolderId);
  return set;
}

/** Map folderId → path relatif di dalam arsip (tanpa trailing slash). */
export function buildFolderPathMap(
  rootFolderId: string,
  folders: RoomFolderNode[],
): Map<string, string> {
  const map = new Map<string, string>();
  const root = folders.find((f) => f.id === rootFolderId);
  if (!root) return map;
  const rootPath = sanitizeZipPathSegment(root.name);
  map.set(rootFolderId, rootPath);
  const walk = (parentId: string, parentPath: string) => {
    for (const child of getChildFolders(folders, parentId)) {
      const childPath = `${parentPath}/${sanitizeZipPathSegment(child.name)}`;
      map.set(child.id, childPath);
      walk(child.id, childPath);
    }
  };
  walk(rootFolderId, rootPath);
  return map;
}

function uniqueZipFileName(
  baseName: string,
  usedInDir: Map<string, number>,
): string {
  const safe = path.basename(baseName.split("?")[0] ?? "file") || "file";
  const count = usedInDir.get(safe) ?? 0;
  usedInDir.set(safe, count + 1);
  if (count === 0) return safe;
  const ext = path.extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  return `${stem} (${count + 1})${ext}`;
}

export type RoomDocumentZipEntry = {
  documentId: string;
  publicPath: string;
  zipName: string;
};

/** Kumpulkan entri zip untuk satu folder (termasuk subfolder & file di dalamnya). */
export function collectFolderZipEntries(
  rootFolderId: string,
  folders: RoomFolderNode[],
  documents: RoomDocumentDownloadRow[],
): RoomDocumentZipEntry[] {
  const folderIds = getDescendantFolderIds(rootFolderId, folders);
  const pathMap = buildFolderPathMap(rootFolderId, folders);
  const usedPerDir = new Map<string, Map<string, number>>();

  const entries: RoomDocumentZipEntry[] = [];
  for (const doc of documents) {
    if (!doc.folderId || !folderIds.has(doc.folderId)) continue;
    if (!doc.publicPath.startsWith("/uploads/")) continue;
    const dirKey = pathMap.get(doc.folderId) ?? "files";
    let used = usedPerDir.get(dirKey);
    if (!used) {
      used = new Map();
      usedPerDir.set(dirKey, used);
    }
    const fileName = uniqueZipFileName(doc.fileName, used);
    entries.push({
      documentId: doc.id,
      publicPath: doc.publicPath,
      zipName: `${dirKey}/${fileName}`,
    });
  }
  return entries;
}

/** Entri zip untuk daftar file (tanpa struktur folder). */
export function collectDocumentZipEntries(
  documents: RoomDocumentDownloadRow[],
): RoomDocumentZipEntry[] {
  const used = new Map<string, number>();
  return documents
    .filter((d) => d.publicPath.startsWith("/uploads/"))
    .map((d) => ({
      documentId: d.id,
      publicPath: d.publicPath,
      zipName: uniqueZipFileName(d.fileName, used),
    }));
}
