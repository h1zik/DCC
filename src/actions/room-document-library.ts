"use server";

import { z } from "zod";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { queryRoomDocumentLibrary } from "@/lib/room-document-library";

const querySchema = z.object({
  roomId: z.string().min(1),
  folderId: z.string().min(1).nullable().optional(),
  search: z.string().max(200).optional(),
  tag: z.string().max(40).optional(),
  type: z.enum(["all", "image", "video", "audio", "pdf", "document", "archive"]).optional(),
  uploaderId: z.string().optional(),
  date: z.enum(["all", "today", "week", "month"]).optional(),
  scope: z.enum(["browse", "favorites", "recent", "trash"]).optional(),
  sort: z.enum(["newest", "oldest", "name", "name_desc", "size", "size_asc", "type", "uploader"]).optional(),
  offset: z.number().int().min(0).max(1_000_000).optional(),
});

export async function listRoomDocumentLibrary(input: z.infer<typeof querySchema>) {
  const session = await requireTasksRoomHubSession();
  const data = querySchema.parse(input);
  await assertRoomMember(data.roomId, session.user.id);
  return queryRoomDocumentLibrary({ ...data, userId: session.user.id });
}
