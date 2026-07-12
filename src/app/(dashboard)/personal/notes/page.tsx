import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
import { NotesClient } from "./notes-client";

export default async function PersonalNotesPage() {
  const ownerId = await requirePersonalOwnerId();
  const notes = await prisma.personalNote.findMany({
    where: { ownerId },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      parentId: true,
      title: true,
      content: true,
      tags: true,
      revision: true,
      updatedAt: true,
    },
  });
  return (
    <NotesClient
      notes={notes.map((n) => ({
        ...n,
        updatedAt: n.updatedAt.toISOString(),
      }))}
    />
  );
}
