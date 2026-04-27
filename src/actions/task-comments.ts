"use server";

import { prisma } from "@/lib/prisma";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { notifyTaskCommentViaWhatsApp } from "@/lib/task-whatsapp-notify";
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
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      title: true,
      project: { include: { brand: true, room: { select: { name: true } } } },
      assignees: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, whatsappPhone: true } },
        },
      },
    },
  });
  if (task) {
    const recipientMap = new Map<
      string,
      { id: string; name: string | null; whatsappPhone: string | null }
    >();
    for (const a of task.assignees) {
      recipientMap.set(a.user.id, a.user);
    }
    recipientMap.delete(session.user.id);
    const recipients = [...recipientMap.values()];
    if (recipients.length > 0) {
      await notifyTaskCommentViaWhatsApp({
        recipients,
        authorName: session.user.name?.trim() || session.user.email || "Rekan",
        taskTitle: task.title,
        commentBody: text,
        project: task.project,
      });
    }
  }
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
