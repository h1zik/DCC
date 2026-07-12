import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
import { FilesClient } from "./files-client";

export default async function PersonalFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const ownerId = await requirePersonalOwnerId();
  const { folder } = await searchParams;

  // Folder aktif harus milik user; folder asing diperlakukan seperti root.
  const currentFolder = folder
    ? await prisma.personalFileFolder.findFirst({
        where: { id: folder, ownerId },
        select: { id: true, name: true, parentId: true },
      })
    : null;
  const currentFolderId = currentFolder?.id ?? null;

  const [allFolders, files] = await Promise.all([
    prisma.personalFileFolder.findMany({
      where: { ownerId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    prisma.personalFile.findMany({
      where: { ownerId, folderId: currentFolderId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    }),
  ]);

  // Breadcrumb: telusuri rantai parent dari folder aktif.
  const byId = new Map(allFolders.map((f) => [f.id, f]));
  const breadcrumb: { id: string; name: string }[] = [];
  let cursor = currentFolder;
  while (cursor) {
    breadcrumb.unshift({ id: cursor.id, name: cursor.name });
    cursor = cursor.parentId ? (byId.get(cursor.parentId) ?? null) : null;
  }

  return (
    <FilesClient
      currentFolderId={currentFolderId}
      breadcrumb={breadcrumb}
      folders={allFolders.filter((f) => f.parentId === currentFolderId)}
      allFolders={allFolders}
      files={files.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      }))}
    />
  );
}
