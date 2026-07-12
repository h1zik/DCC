import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
import { BookmarksClient } from "./bookmarks-client";

export default async function PersonalBookmarksPage() {
  const ownerId = await requirePersonalOwnerId();
  const bookmarks = await prisma.personalBookmark.findMany({
    where: { ownerId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      tags: true,
    },
  });
  return <BookmarksClient bookmarks={bookmarks} />;
}
