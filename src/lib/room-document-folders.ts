/** Utilitas navigasi folder dokumen ruangan (model mirip Google Drive). */

export type RoomFolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type FolderBreadcrumb = { id: string | null; name: string };

const ROOT_CRUMB: FolderBreadcrumb = { id: null, name: "Semua file" };

export function buildFolderMap<T extends RoomFolderNode>(
  folders: T[],
): Map<string, T> {
  return new Map(folders.map((f) => [f.id, f]));
}

/** Rantai breadcrumb dari root hingga folder aktif. */
export function getFolderBreadcrumbs(
  folderId: string | null,
  folders: RoomFolderNode[],
): FolderBreadcrumb[] {
  if (!folderId) return [ROOT_CRUMB];
  const map = buildFolderMap(folders);
  const chain: RoomFolderNode[] = [];
  let cur = map.get(folderId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return [ROOT_CRUMB, ...chain.map((f) => ({ id: f.id, name: f.name }))];
}

/** Subfolder langsung di bawah `parentId` (null = root). */
export function getChildFolders<T extends RoomFolderNode>(
  folders: T[],
  parentId: string | null,
): T[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, "id", { sensitivity: "base" }),
    );
}

/** Label jalur penuh, mis. `Semua file / Legal / Kontrak`. */
export function formatFolderPath(
  folderId: string | null,
  folders: RoomFolderNode[],
): string {
  return getFolderBreadcrumbs(folderId, folders)
    .map((c) => c.name)
    .join(" / ");
}

export type FolderPickerEntry = { id: string; label: string; depth: number };

/** Daftar rata untuk menu pindah — dengan kedalaman indent. */
export function flattenFoldersForPicker(
  folders: RoomFolderNode[],
  parentId: string | null = null,
  depth = 0,
): FolderPickerEntry[] {
  const out: FolderPickerEntry[] = [];
  for (const f of getChildFolders(folders, parentId)) {
    out.push({ id: f.id, label: f.name, depth });
    out.push(...flattenFoldersForPicker(folders, f.id, depth + 1));
  }
  return out;
}
