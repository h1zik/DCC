"use server";

import { prisma } from "@/lib/prisma";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import {
  assertRoomMemberHasTaskProcess,
  getTaskRoomContext,
  isRoomHubManagerRole,
} from "@/lib/room-access";

export async function addTaskComment(taskId: string, body: string) {
  const session = await requireTasksRoomHubSession();
  const text = body.trim();
  if (!text) throw new Error("Komentar tidak boleh kosong.");

  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

  await prisma.taskComment.create({
    data: {
      taskId,
      authorId: session.user.id,
      body: text,
    },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteTaskComment(commentId: string) {
  const session = await requireTasksRoomHubSession();
  const c = await prisma.taskComment.findUniqueOrThrow({
    where: { id: commentId },
    select: { authorId: true, taskId: true },
  });
  const { roomId, roomProcess } = await getTaskRoomContext(c.taskId);
  const member = await assertRoomMemberHasTaskProcess(
    roomId,
    session.user.id,
    roomProcess,
  );
  const canModerate = isRoomHubManagerRole(member.role);
  if (c.authorId !== session.user.id && !canModerate) {
    throw new Error("Anda tidak dapat menghapus komentar ini.");
  }
  await prisma.taskComment.delete({ where: { id: commentId } });
  revalidateTasksAndRoomHub();
}
